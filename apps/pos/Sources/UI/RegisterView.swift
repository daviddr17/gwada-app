import SwiftUI

/// Kasse öffnen / schließen (Z-Bon) — Hub, offline mit Nachsignierung.
struct RegisterView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var status: PosCloudClient.RegisterStatusDto?
    @State private var localState: PosLocalRegisterState?
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

    private var isOpen: Bool {
        localState?.isOpen ?? status?.isOpen ?? false
    }

    private var fiscalPending: Bool {
        localState?.fiscalPending == true || localState?.pendingClose == true
    }

    var body: some View {
        Group {
            if !isHub {
                ContentUnavailableView {
                    Label("Nur auf der Kasse", systemImage: "lock.ipad")
                } description: {
                    Text("Kasse öffnen und schließen geht nur am iPad-Hub. Das Handgerät nutzt die offene Kassensitzung über LAN.")
                }
            } else if loading && status == nil && localState == nil {
                ProgressView("Lade Kassenstatus …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        HStack {
                            Text("Status")
                            Spacer()
                            Text(isOpen ? "Offen" : "Geschlossen")
                                .fontWeight(.semibold)
                                .foregroundStyle(isOpen ? Color.green : Color.secondary)
                        }
                        if fiscalPending {
                            Text("Fiskalisierung nicht möglich — TSE/Z-Bon folgt online (Nachsignierung ausstehend).")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                        if let openedAt = localState?.openedAt ?? status?.openedAt, isOpen {
                            LabeledContent("Geöffnet seit") {
                                Text(formatDateTime(openedAt))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let opening = localState?.openingCashCents ?? status?.openingCashCents, isOpen {
                            LabeledContent("Anfangsbestand") {
                                Text(PosMoney.format(opening))
                                    .font(.body.monospacedDigit())
                            }
                        }
                        if let expected = localState?.expectedCashCents ?? status?.aggregate?.expectedCashCents, isOpen {
                            LabeledContent("Soll Bar") {
                                Text(PosMoney.format(expected))
                                    .font(.body.monospacedDigit())
                            }
                        }
                        if let z = localState?.lastClosingZNr ?? status?.lastClosingZNr {
                            LabeledContent("Letzte Z-Nr.") {
                                Text("\(z)")
                                    .font(.body.monospacedDigit())
                            }
                        }
                    } header: {
                        Text("Kassensitzung")
                    } footer: {
                        Text(
                            "Vor dem Verkaufstag: Barbestand zählen und Kasse öffnen. Am Ende: Endbestand zählen und Z-Abschluss. Offline möglich — TSE folgt bei Wiederverbindung."
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
                            if !isOpen {
                                Button {
                                    openingCents = localState?.suggestedOpeningCashCents
                                        ?? status?.suggestedOpeningCashCents
                                        ?? 0
                                    showOpenSheet = true
                                } label: {
                                    Label("Kasse öffnen", systemImage: "lock.open")
                                }
                                .disabled(busy != nil)
                            } else {
                                Button(role: .destructive) {
                                    closingCents = localState?.expectedCashCents
                                        ?? status?.aggregate?.expectedCashCents
                                        ?? 0
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
                suggestion: localState?.suggestedOpeningCashCents ?? status?.suggestedOpeningCashCents,
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
                suggestion: localState?.expectedCashCents ?? status?.aggregate?.expectedCashCents,
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
        localState = PosOfflineCaches.loadRegister()
        if PosAuthStore.shared.isOfflineSession {
            return
        }
        do {
            status = try await PosCloudClient.fetchRegisterStatus()
            if localState?.fiscalPending != true && localState?.pendingClose != true {
                localState = PosLocalRegisterState(
                    isOpen: status?.isOpen ?? false,
                    sessionId: status?.sessionId,
                    openedAt: status?.openedAt,
                    openingCashCents: status?.openingCashCents,
                    fiscalPending: false,
                    pendingClose: false,
                    pendingClosingCashCents: nil,
                    lastClosingZNr: status?.lastClosingZNr,
                    suggestedOpeningCashCents: status?.suggestedOpeningCashCents,
                    expectedCashCents: status?.aggregate?.expectedCashCents
                )
                if let localState {
                    PosOfflineCaches.saveRegister(localState)
                }
            }
        } catch {
            if localState == nil {
                errorText = error.localizedDescription
            }
        }
    }

    private func openRegister() async {
        busy = "open"
        errorText = ""
        defer { busy = nil }
        let restaurantId = PosHubState.shared.restaurantId
        let localSessionId = UUID().uuidString
        let openedAt = PosOfflineCaches.isoNow()

        if PosAuthStore.shared.isOfflineSession {
            applyLocalOpen(localSessionId: localSessionId, openedAt: openedAt, fiscalPending: true)
            PosSyncQueue.shared.enqueueOpenRegister(PosSyncOpenRegisterPayload(
                restaurantId: restaurantId,
                openingCashCents: openingCents,
                localSessionId: localSessionId
            ))
            runtime.noteSyncPending()
            runtime.announce("Kasse lokal geöffnet — Fiskalisierung nicht möglich, Nachsignierung ausstehend.")
            showOpenSheet = false
            return
        }

        do {
            let result = try await PosCloudClient.openRegister(openingCashCents: openingCents)
            applyLocalOpen(
                localSessionId: result.sessionId ?? localSessionId,
                openedAt: openedAt,
                fiscalPending: false
            )
            showOpenSheet = false
            await runtime.refresh()
            await reload()
        } catch {
            applyLocalOpen(localSessionId: localSessionId, openedAt: openedAt, fiscalPending: true)
            PosSyncQueue.shared.enqueueOpenRegister(PosSyncOpenRegisterPayload(
                restaurantId: restaurantId,
                openingCashCents: openingCents,
                localSessionId: localSessionId
            ))
            runtime.noteSyncPending()
            runtime.announce("Kasse lokal geöffnet — TSE folgt online.")
            showOpenSheet = false
            errorText = ""
        }
    }

    private func closeRegister() async {
        busy = "close"
        errorText = ""
        defer { busy = nil }
        let restaurantId = PosHubState.shared.restaurantId

        if PosAuthStore.shared.isOfflineSession {
            applyLocalClose(fiscalPending: true)
            PosSyncQueue.shared.enqueueCloseRegister(PosSyncCloseRegisterPayload(
                restaurantId: restaurantId,
                closingCashCents: closingCents
            ))
            runtime.noteSyncPending()
            runtime.announce("Kasse lokal geschlossen — Z-Bon/TSE folgt online.")
            showCloseSheet = false
            return
        }

        do {
            _ = try await PosCloudClient.closeRegister(closingCashCents: closingCents)
            applyLocalClose(fiscalPending: false)
            showCloseSheet = false
            await runtime.refresh()
            await reload()
        } catch {
            applyLocalClose(fiscalPending: true)
            PosSyncQueue.shared.enqueueCloseRegister(PosSyncCloseRegisterPayload(
                restaurantId: restaurantId,
                closingCashCents: closingCents
            ))
            runtime.noteSyncPending()
            runtime.announce("Kasse lokal geschlossen — Z-Bon folgt online.")
            showCloseSheet = false
        }
    }

    private func applyLocalOpen(localSessionId: String, openedAt: String, fiscalPending: Bool) {
        let state = PosLocalRegisterState(
            isOpen: true,
            sessionId: localSessionId,
            openedAt: openedAt,
            openingCashCents: openingCents,
            fiscalPending: fiscalPending,
            pendingClose: false,
            pendingClosingCashCents: nil,
            lastClosingZNr: localState?.lastClosingZNr ?? status?.lastClosingZNr,
            suggestedOpeningCashCents: localState?.suggestedOpeningCashCents,
            expectedCashCents: openingCents
        )
        localState = state
        PosHubState.shared.applyLocalRegister(state)
        runtime.publishHubSnapshot()
    }

    private func applyLocalClose(fiscalPending: Bool) {
        let state = PosLocalRegisterState(
            isOpen: false,
            sessionId: nil,
            openedAt: nil,
            openingCashCents: nil,
            fiscalPending: fiscalPending,
            pendingClose: fiscalPending,
            pendingClosingCashCents: closingCents,
            lastClosingZNr: localState?.lastClosingZNr ?? status?.lastClosingZNr,
            suggestedOpeningCashCents: closingCents,
            expectedCashCents: nil
        )
        localState = state
        PosHubState.shared.applyLocalRegister(state)
        runtime.publishHubSnapshot()
    }

    private func formatDateTime(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
