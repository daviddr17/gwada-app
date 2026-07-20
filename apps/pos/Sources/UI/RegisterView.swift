import SwiftUI

/// Kasse öffnen / schließen (Z-Bon) — nur Hub, braucht `pos.kasse.manage`.
struct RegisterView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var status: PosCloudClient.RegisterStatusDto?
    @State private var loading = false
    @State private var busy: String?
    @State private var errorText = ""
    @State private var openingCents = 0
    @State private var closingCents = 0
    @State private var showOpenSheet = false
    @State private var showCloseSheet = false

    private var canManage: Bool {
        PosAuthStore.shared.pinSession?.permissionKeys.contains("pos.kasse.manage") == true
    }

    private var isHub: Bool { runtime.role == .hub }

    var body: some View {
        Group {
            if !isHub {
                ContentUnavailableView {
                    Label("Nur auf der Kasse", systemImage: "lock.ipad")
                } description: {
                    Text("Kasse öffnen und schließen geht nur am iPad-Hub. Das Handgerät nutzt die offene Kassensitzung über LAN.")
                }
            } else if loading && status == nil {
                ProgressView("Lade Kassenstatus …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        HStack {
                            Text("Status")
                            Spacer()
                            Text(status?.isOpen == true ? "Offen" : "Geschlossen")
                                .fontWeight(.semibold)
                                .foregroundStyle(status?.isOpen == true ? Color.green : Color.secondary)
                        }
                        if let openedAt = status?.openedAt, status?.isOpen == true {
                            LabeledContent("Geöffnet seit") {
                                Text(formatDateTime(openedAt))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let opening = status?.openingCashCents, status?.isOpen == true {
                            LabeledContent("Anfangsbestand") {
                                Text(PosMoney.format(opening))
                                    .font(.body.monospacedDigit())
                            }
                        }
                        if let expected = status?.aggregate?.expectedCashCents, status?.isOpen == true {
                            LabeledContent("Soll Bar") {
                                Text(PosMoney.format(expected))
                                    .font(.body.monospacedDigit())
                            }
                        }
                        if let z = status?.lastClosingZNr {
                            LabeledContent("Letzte Z-Nr.") {
                                Text("\(z)")
                                    .font(.body.monospacedDigit())
                            }
                        }
                    } header: {
                        Text("Kassensitzung")
                    } footer: {
                        Text(
                            "Vor dem Verkaufstag: Barbestand zählen und Kasse öffnen. Am Ende: Endbestand zählen und Z-Abschluss — das schließt die Sitzung fiskalisch."
                        )
                    }

                    if !errorText.isEmpty {
                        Section {
                            Text(errorText)
                                .foregroundStyle(.red)
                                .font(.footnote)
                        }
                    }

                    if canManage {
                        Section("Aktionen") {
                            if status?.isOpen != true {
                                Button {
                                    openingCents = status?.suggestedOpeningCashCents ?? 0
                                    showOpenSheet = true
                                } label: {
                                    Label("Kasse öffnen", systemImage: "lock.open")
                                }
                                .disabled(busy != nil)
                            } else {
                                Button(role: .destructive) {
                                    closingCents = status?.aggregate?.expectedCashCents ?? 0
                                    showCloseSheet = true
                                } label: {
                                    Label("Kasse schließen (Z-Bon)", systemImage: "lock")
                                }
                                .disabled(busy != nil)
                            }
                        }
                    } else {
                        Section {
                            Text("Zum Öffnen/Schließen brauchst du die Berechtigung „Kasse öffnen und schließen“.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Kasse")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await reload() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(loading || busy != nil)
            }
        }
        .task { await reload() }
        .refreshable { await reload() }
        .sheet(isPresented: $showOpenSheet) {
            cashSheet(
                title: "Kasse öffnen",
                amountTitle: "Anfangsbestand",
                cents: $openingCents,
                suggestion: status?.suggestedOpeningCashCents,
                confirmLabel: "Öffnen",
                busyKey: "open"
            ) {
                await openRegister()
            }
        }
        .sheet(isPresented: $showCloseSheet) {
            cashSheet(
                title: "Kasse schließen",
                amountTitle: "Endbestand gezählt",
                cents: $closingCents,
                suggestion: status?.aggregate?.expectedCashCents,
                confirmLabel: "Z-Abschluss",
                busyKey: "close"
            ) {
                await closeRegister()
            }
        }
    }

    @ViewBuilder
    private func cashSheet(
        title: String,
        amountTitle: String,
        cents: Binding<Int>,
        suggestion: Int?,
        confirmLabel: String,
        busyKey: String,
        action: @escaping () async -> Void
    ) -> some View {
        NavigationStack {
            Form {
                Section {
                    Text(PosMoney.format(cents.wrappedValue))
                        .font(.largeTitle.monospacedDigit().weight(.semibold))
                        .frame(maxWidth: .infinity)
                    PosCashKeypad(cents: cents)
                } header: {
                    Text(amountTitle)
                } footer: {
                    if let suggestion {
                        Text("Vorschlag: \(PosMoney.format(suggestion))")
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") {
                        showOpenSheet = false
                        showCloseSheet = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmLabel) {
                        Task { await action() }
                    }
                    .disabled(busy == busyKey)
                }
            }
        }
    }

    private func reload() async {
        guard isHub else { return }
        loading = true
        errorText = ""
        defer { loading = false }
        do {
            status = try await PosCloudClient.fetchRegisterStatus()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func openRegister() async {
        busy = "open"
        errorText = ""
        defer { busy = nil }
        do {
            _ = try await PosCloudClient.openRegister(openingCashCents: openingCents)
            showOpenSheet = false
            await runtime.refresh()
            await reload()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func closeRegister() async {
        busy = "close"
        errorText = ""
        defer { busy = nil }
        do {
            _ = try await PosCloudClient.closeRegister(closingCashCents: closingCents)
            showCloseSheet = false
            await runtime.refresh()
            await reload()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func formatDateTime(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
