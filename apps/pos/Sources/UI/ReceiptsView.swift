import SwiftUI

/// Heutige Quittungen — lokal (Demo) und/oder Cloud.
struct ReceiptsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var localReceipts: [PosLocalReceipt] = []
    @State private var cloudReceipts: [PosCloudClient.PosTodayReceiptDto] = []
    @State private var loading = false
    @State private var errorText = ""
    @State private var shownLocal: PosLocalReceipt?
    @State private var voidTarget: PosCloudClient.PosTodayReceiptDto?
    @State private var voidReasons: [PosCloudClient.PosVoidReasonDto] = []
    @State private var selectedVoidReasonId: String?
    @State private var reopenTable = true
    @State private var showVoidSheet = false
    @State private var busyId: String?

    private var isEmpty: Bool { localReceipts.isEmpty && cloudReceipts.isEmpty }

    var body: some View {
        Group {
            if loading && isEmpty {
                ProgressView("Lade Quittungen …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isEmpty {
                ContentUnavailableView {
                    Label("Keine Quittungen", systemImage: "doc.text")
                } description: {
                    Text(errorText.isEmpty
                        ? "Heute noch keine Zahlungen. Nach dem Kassieren erscheint der Beleg hier und direkt nach der Zahlung."
                        : errorText)
                } actions: {
                    Button("Aktualisieren") { Task { await reload() } }
                }
            } else {
                List {
                    if !localReceipts.isEmpty {
                        Section {
                            Text(runtime.isSignedIn
                                ? "Lokale Belege (auch offline / Demo)."
                                : "Lokale Demo-Belege — Cloud-Login bringt TSE-Quittungen.")
                                .font(.footnote)
                                .foregroundStyle(PosDesign.muted)
                        }
                        ForEach(localReceipts) { receipt in
                            Button {
                                shownLocal = receipt
                            } label: {
                                localRow(receipt)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if !cloudReceipts.isEmpty {
                        Section("Cloud") {
                            ForEach(cloudReceipts) { receipt in
                                cloudRow(receipt)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Tagesbelege")
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
        .sheet(item: $shownLocal) { receipt in
            PosGuestReceiptSheet(receipt: receipt) { shownLocal = nil }
        }
        .sheet(isPresented: $showVoidSheet) {
            voidSheet
        }
    }

    private func localRow(_ receipt: PosLocalReceipt) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(receipt.tableLabel)
                    .font(.headline)
                    .foregroundStyle(PosDesign.ink)
                Spacer()
                PosStatusBadge(title: "Bezahlt", emphasized: true)
            }
            HStack {
                Text("#\(receipt.orderNumber)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(PosDesign.muted)
                Text("·")
                    .foregroundStyle(PosDesign.muted)
                Text(methodLabel(receipt.method))
                    .font(.subheadline)
                    .foregroundStyle(PosDesign.muted)
                Spacer()
                Text(PosMoney.format(receipt.paidTotalCents))
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(PosDesign.ink)
            }
            if let label = receipt.label {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
            }
            Text("Antippen für Gastbeleg")
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
        }
        .padding(.vertical, 4)
    }

    private func cloudRow(_ receipt: PosCloudClient.PosTodayReceiptDto) -> some View {
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
                    .foregroundStyle(PosDesign.muted)
                Text("·")
                    .foregroundStyle(PosDesign.muted)
                Text(methodLabel(receipt.method))
                    .font(.subheadline)
                    .foregroundStyle(PosDesign.muted)
                Spacer()
                Text(PosMoney.format(receipt.amountCents))
                    .font(.body.weight(.semibold).monospacedDigit())
            }
            if receipt.tipCents > 0 {
                Text("inkl. Trinkgeld \(PosMoney.format(receipt.tipCents))")
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
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
                        .foregroundStyle(PosDesign.brandAccent)
                }
            }
        }
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
        case "paypal": return "PayPal"
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
        localReceipts = PosOfflineCaches.todayReceipts()

        guard runtime.isSignedIn else {
            cloudReceipts = []
            return
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            cloudReceipts = try await PosCloudClient.fetchTodayReceipts(restaurantId: restaurantId)
        } catch {
            errorText = error.localizedDescription
            cloudReceipts = []
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
