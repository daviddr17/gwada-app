import SwiftUI

/// Heutige Quittungen / Bar-Zahlungen — Storno + Tisch wieder öffnen.
struct ReceiptsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var receipts: [PosCloudClient.PosTodayReceiptDto] = []
    @State private var loading = false
    @State private var errorText = ""
    @State private var voidTarget: PosCloudClient.PosTodayReceiptDto?
    @State private var voidReasons: [PosCloudClient.PosVoidReasonDto] = []
    @State private var selectedVoidReasonId: String?
    @State private var reopenTable = true
    @State private var showVoidSheet = false
    @State private var busyId: String?

    var body: some View {
        Group {
            if loading && receipts.isEmpty {
                ProgressView("Lade Quittungen …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if receipts.isEmpty {
                ContentUnavailableView {
                    Label("Keine Quittungen", systemImage: "doc.text")
                } description: {
                    Text(errorText.isEmpty ? "Heute noch keine Zahlungen." : errorText)
                } actions: {
                    Button("Aktualisieren") { Task { await reload() } }
                }
            } else {
                List {
                    Section {
                        Text("Bar-Zahlungen können storniert werden — Tisch wird wieder geöffnet. PDF/Fiskaly später.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(receipts) { receipt in
                        receiptRow(receipt)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Quittungen")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await reload() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(loading)
            }
        }
        .task { await reload() }
        .refreshable { await reload() }
        .sheet(isPresented: $showVoidSheet) {
            voidSheet
        }
    }

    private var voidSheet: some View {
        NavigationStack {
            Form {
                if let receipt = voidTarget {
                    Section {
                        Text("\(receipt.tableLabel) · #\(receipt.orderNumber)")
                        Text(PosMoney.format(receipt.amountCents))
                            .font(.body.monospacedDigit())
                    }
                }
                if !voidReasons.isEmpty {
                    Section("Storno-Grund") {
                        ForEach(voidReasons) { reason in
                            voidReasonButton(reason)
                        }
                    }
                }
                Section {
                    Toggle("Tisch wieder öffnen", isOn: $reopenTable)
                }
            }
            .navigationTitle("Stornieren")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") {
                        showVoidSheet = false
                        voidTarget = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Stornieren", role: .destructive) {
                        guard let receipt = voidTarget else { return }
                        Task {
                            await voidReceipt(
                                receipt,
                                reopen: reopenTable,
                                voidReasonId: selectedVoidReasonId
                            )
                        }
                    }
                    .disabled(busyId != nil || (!voidReasons.isEmpty && selectedVoidReasonId == nil))
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func voidReasonButton(_ reason: PosCloudClient.PosVoidReasonDto) -> some View {
        let selected = selectedVoidReasonId == reason.id
        let inventoryHint = reason.restoreInventory
            ? "Bestand wird zurückgebucht"
            : "Bestand bleibt abgezogen"
        return Button {
            selectedVoidReasonId = reason.id
        } label: {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(reason.name)
                        .foregroundStyle(Color.primary)
                    Text(inventoryHint)
                        .font(.caption)
                        .foregroundStyle(Color.secondary)
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }

    private func receiptRow(_ receipt: PosCloudClient.PosTodayReceiptDto) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(receipt.tableLabel)
                    .font(.headline)
                Spacer()
                PosStatusBadge(
                    title: statusLabel(receipt),
                    emphasized: receipt.status == "paid",
                    tint: receipt.status == "refunded" ? .secondary : .accentColor
                )
            }
            HStack {
                Text("#\(receipt.orderNumber)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Text("·")
                    .foregroundStyle(.secondary)
                Text(methodLabel(receipt.method))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(PosMoney.format(receipt.amountCents))
                    .font(.body.weight(.semibold).monospacedDigit())
            }
            if receipt.tipCents > 0 {
                Text("inkl. Trinkgeld \(PosMoney.format(receipt.tipCents))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let received = receipt.receivedAmountCents, received > receipt.amountCents {
                Text("Gegeben \(PosMoney.format(received)) · Rückgeld \(PosMoney.format(received - receipt.amountCents))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let paidAt = receipt.paidAt {
                Text(Self.formatTime(paidAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            ShareLink(
                item: guestReceiptText(receipt),
                subject: Text("Gastbeleg \(receipt.tableLabel)"),
                message: Text("KassenSichV-Felder folgen (TSE); Beleg teilen.")
            ) {
                Label("Gastbeleg teilen", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.semibold))
            }

            if receipt.canVoidCash {
                Button {
                    Task { await prepareVoid(receipt) }
                } label: {
                    Label(
                        busyId == receipt.paymentId ? "Storniere …" : "Stornieren",
                        systemImage: "arrow.uturn.backward"
                    )
                }
                .disabled(busyId != nil)
            }
        }
        .padding(.vertical, 4)
    }

    private func statusLabel(_ r: PosCloudClient.PosTodayReceiptDto) -> String {
        switch r.status {
        case "paid": return "Bezahlt"
        case "refunded": return "Storniert"
        default: return r.status
        }
    }

    private func methodLabel(_ method: String) -> String {
        switch method {
        case "cash": return "Bar"
        case "card": return "Karte"
        default: return method
        }
    }

    private func guestReceiptText(_ receipt: PosCloudClient.PosTodayReceiptDto) -> String {
        var lines = [
            "Gwada POS — Gastbeleg",
            "Tisch: \(receipt.tableLabel)",
            "Bestellung #\(receipt.orderNumber)",
            "Betrag: \(PosMoney.format(receipt.amountCents))",
        ]
        if receipt.tipCents > 0 {
            lines.append("Trinkgeld: \(PosMoney.format(receipt.tipCents))")
        }
        lines.append("Zahlung: \(methodLabel(receipt.method))")
        if let paidAt = receipt.paidAt {
            lines.append("Zeit: \(Self.formatTime(paidAt))")
        }
        lines.append("")
        lines.append("TSE / KassenSichV: Felder folgen (Fiskaly).")
        return lines.joined(separator: "\n")
    }

    private func reload() async {
        loading = true
        errorText = ""
        defer { loading = false }
        guard runtime.isSignedIn else {
            receipts = []
            errorText = "Bitte anmelden, um Quittungen zu laden."
            return
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            receipts = try await PosCloudClient.fetchTodayReceipts(restaurantId: restaurantId)
        } catch {
            errorText = error.localizedDescription
            receipts = []
        }
    }

    private func prepareVoid(_ receipt: PosCloudClient.PosTodayReceiptDto) async {
        voidTarget = receipt
        reopenTable = true
        selectedVoidReasonId = nil
        let restaurantId = PosHubState.shared.restaurantId
        do {
            voidReasons = try await PosCloudClient.fetchVoidReasons(restaurantId: restaurantId)
            if voidReasons.count == 1 {
                selectedVoidReasonId = voidReasons.first?.id
            }
        } catch {
            voidReasons = []
            runtime.announce("Storno-Gründe konnten nicht geladen werden.")
        }
        showVoidSheet = true
    }

    private func voidReceipt(
        _ receipt: PosCloudClient.PosTodayReceiptDto,
        reopen: Bool,
        voidReasonId: String?
    ) async {
        busyId = receipt.paymentId
        defer {
            busyId = nil
            voidTarget = nil
            showVoidSheet = false
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            let result = try await PosCloudClient.voidCashPayment(
                restaurantId: restaurantId,
                paymentId: receipt.paymentId,
                reopenTable: reopen,
                voidReasonId: voidReasonId
            )
            var message = result.reopened
                ? "Storniert — Tisch wieder geöffnet."
                : "Bar-Zahlung storniert."
            if result.inventoryRestored {
                message += " Bestand zurückgebucht."
            }
            runtime.announce(message)
            await runtime.refresh()
            await reload()
        } catch {
            errorText = error.localizedDescription
            runtime.announce("Storno fehlgeschlagen: \(error.localizedDescription)")
        }
    }

    private static func formatTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let out = DateFormatter()
        out.locale = Locale(identifier: "de_DE")
        out.dateFormat = "HH:mm"
        return out.string(from: date)
    }
}
