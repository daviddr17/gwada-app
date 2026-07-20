import SwiftUI

/// Quittungen — lokal + Cloud; Barstorno offline mit Fiskal-Hinweis.
struct ReceiptsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var receipts: [DisplayReceipt] = []
    @State private var loading = false
    @State private var errorText = ""
    @State private var voidTarget: DisplayReceipt?
    @State private var voidReasons: [PosCloudClient.PosVoidReasonDto] = []
    @State private var selectedVoidReasonId: String?
    @State private var reopenTable = true
    @State private var showVoidSheet = false
    @State private var invoicePaymentId: String?
    @State private var busyId: String?

    private var isOnlineHub: Bool {
        runtime.isSignedIn && !PosAuthStore.shared.isOfflineSession
    }

    struct DisplayReceipt: Identifiable {
        var localId: String
        var paymentId: String?
        var orderNumber: Int
        var tableLabel: String
        var method: String
        var status: String
        var amountCents: Int
        var tipCents: Int
        var receivedAmountCents: Int?
        var paidAt: String?
        var canVoidCash: Bool
        var fiscalPending: Bool

        var id: String { localId }

        var voidKey: String { paymentId ?? localId }
    }

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
                        Text(
                            isOnlineHub
                                ? "Bar stornieren und formale Rechnung — online am Hub. Offline: lokale Quittungen mit Nachsignierung."
                                : "Offline: lokale Quittungen. Fiskalisierung nicht möglich — Nachsignierung ausstehend."
                        )
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
        .sheet(isPresented: $showVoidSheet) { voidSheet }
        .sheet(
            isPresented: Binding(
                get: { invoicePaymentId != nil },
                set: { if !$0 { invoicePaymentId = nil } }
            )
        ) {
            if let paymentId = invoicePaymentId {
                FormalInvoiceSheet(paymentId: paymentId) {
                    Task { await reload() }
                }
                .environmentObject(runtime)
            }
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
                        if receipt.fiscalPending || receipt.paymentId == nil {
                            Text("Storno lokal — Fiskalisierung nicht möglich, Nachsignierung ausstehend.")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                    }
                }
                if !voidReasons.isEmpty {
                    Section("Storno-Grund") {
                        ForEach(voidReasons) { reason in
                            Button {
                                selectedVoidReasonId = reason.id
                            } label: {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(reason.name).foregroundStyle(.primary)
                                        Text(
                                            reason.restoreInventory
                                                ? "Bestand wird zurückgebucht"
                                                : "Bestand bleibt abgezogen"
                                        )
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if selectedVoidReasonId == reason.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.accentColor)
                                    }
                                }
                            }
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
                    .disabled(
                        busyId != nil
                            || (!voidReasons.isEmpty && selectedVoidReasonId == nil)
                    )
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func receiptRow(_ receipt: DisplayReceipt) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(receipt.tableLabel)
                    .font(.headline)
                Spacer()
                PosStatusBadge(
                    title: statusLabel(receipt),
                    emphasized: receipt.status == "paid",
                    tint: receipt.status == "refunded" || receipt.status == "void_pending"
                        ? .secondary
                        : .accentColor
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
            if receipt.fiscalPending {
                Text("Fiskalisierung nicht möglich — Nachsignierung ausstehend")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            if receipt.tipCents > 0 {
                Text("inkl. Trinkgeld \(PosMoney.format(receipt.tipCents))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let paidAt = receipt.paidAt {
                Text(Self.formatTime(paidAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            HStack(spacing: 12) {
                if receipt.status == "paid", let pid = receipt.paymentId, isOnlineHub {
                    Button {
                        invoicePaymentId = pid
                    } label: {
                        Label("Rechnung", systemImage: "doc.plaintext")
                    }
                    .disabled(busyId != nil)
                }
                if receipt.canVoidCash && receipt.status == "paid" {
                    Button {
                        Task { await prepareVoid(receipt) }
                    } label: {
                        Label(
                            busyId == receipt.voidKey ? "Storniere …" : "Stornieren",
                            systemImage: "arrow.uturn.backward"
                        )
                    }
                    .disabled(busyId != nil)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusLabel(_ r: DisplayReceipt) -> String {
        switch r.status {
        case "paid": return r.fiscalPending ? "Bezahlt*" : "Bezahlt"
        case "refunded": return "Storniert"
        case "void_pending": return "Storno*"
        default: return r.status
        }
    }

    private func methodLabel(_ method: String) -> String {
        switch method {
        case "cash": return "Bar"
        case "card": return "Karte"
        case "voucher": return "Gutschein"
        default: return method
        }
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

        let local = PosOfflineCaches.loadReceipts()
            .filter { $0.dayYmd == PosOfflineCaches.todayYmd() || $0.fiscalPending || $0.status == "void_pending" }
            .map(Self.fromLocal)

        if !isOnlineHub {
            receipts = local.sorted { ($0.paidAt ?? "") > ($1.paidAt ?? "") }
            if receipts.isEmpty {
                errorText = "Offline — noch keine lokalen Quittungen heute."
            }
            return
        }

        let restaurantId = PosHubState.shared.restaurantId
        do {
            let cloud = try await PosCloudClient.fetchTodayReceipts(restaurantId: restaurantId)
            let cloudMapped = cloud.map(Self.fromCloud)
            var byKey: [String: DisplayReceipt] = [:]
            for r in cloudMapped {
                byKey[r.paymentId ?? r.localId] = r
            }
            for r in local {
                if let pid = r.paymentId, byKey[pid] != nil {
                    // Cloud gewinnt, außer lokal noch pending void
                    if r.status == "void_pending" {
                        byKey[pid] = r
                    }
                    continue
                }
                if r.fiscalPending || r.paymentId == nil {
                    byKey[r.localId] = r
                }
            }
            receipts = byKey.values.sorted { ($0.paidAt ?? "") > ($1.paidAt ?? "") }
        } catch {
            receipts = local.sorted { ($0.paidAt ?? "") > ($1.paidAt ?? "") }
            if receipts.isEmpty {
                errorText = error.localizedDescription
            }
        }
    }

    private func prepareVoid(_ receipt: DisplayReceipt) async {
        voidTarget = receipt
        reopenTable = true
        selectedVoidReasonId = nil
        let restaurantId = PosHubState.shared.restaurantId
        if isOnlineHub {
            do {
                voidReasons = try await PosCloudClient.fetchVoidReasons(restaurantId: restaurantId)
                PosOfflineCaches.saveVoidReasons(voidReasons)
            } catch {
                voidReasons = PosOfflineCaches.loadVoidReasons()
            }
        } else {
            voidReasons = PosOfflineCaches.loadVoidReasons()
        }
        if voidReasons.count == 1 {
            selectedVoidReasonId = voidReasons.first?.id
        }
        showVoidSheet = true
    }

    private func voidReceipt(
        _ receipt: DisplayReceipt,
        reopen: Bool,
        voidReasonId: String?
    ) async {
        busyId = receipt.voidKey
        defer {
            busyId = nil
            voidTarget = nil
            showVoidSheet = false
        }
        let restaurantId = PosHubState.shared.restaurantId

        // Immer lokal markieren
        PosOfflineCaches.updateReceipt(localId: receipt.localId) { r in
            r.status = "void_pending"
            r.canVoidCash = false
            r.fiscalPending = true
        }

        if let paymentId = receipt.paymentId, isOnlineHub {
            do {
                let result = try await PosCloudClient.voidCashPayment(
                    restaurantId: restaurantId,
                    paymentId: paymentId,
                    reopenTable: reopen,
                    voidReasonId: voidReasonId
                )
                PosOfflineCaches.updateReceipt(localId: receipt.localId) { r in
                    r.status = "refunded"
                    r.fiscalPending = false
                }
                var message = result.reopened
                    ? "Storniert — Tisch wieder geöffnet."
                    : "Bar-Zahlung storniert."
                if result.inventoryRestored { message += " Bestand zurückgebucht." }
                if let inv = result.formalInvoiceStorno {
                    if let err = inv.error, !err.isEmpty {
                        runtime.announce("\(message) Rechnungsstorno: \(err)")
                    } else if inv.mode == "correction" {
                        message += inv.correctionNumber.map { " Rechnung → Korrektur \($0)." }
                            ?? " Formale Rechnung korrigiert."
                    } else if inv.mode == "voided_draft" {
                        message += " Formale Rechnung storniert."
                    }
                }
                runtime.announce(message)
                await runtime.refresh()
                await reload()
                return
            } catch {
                // Queue for later
            }
        }

        PosSyncQueue.shared.enqueueVoidCash(PosSyncVoidCashPayload(
            restaurantId: restaurantId,
            paymentId: receipt.paymentId,
            localReceiptId: receipt.localId,
            reopenTable: reopen,
            voidReasonId: voidReasonId
        ))
        runtime.noteSyncPending()
        runtime.announce("Storno lokal — Fiskalisierung nicht möglich, Nachsignierung ausstehend.")
        await reload()
    }

    private static func fromLocal(_ r: PosLocalReceipt) -> DisplayReceipt {
        DisplayReceipt(
            localId: r.localId,
            paymentId: r.paymentId,
            orderNumber: r.orderNumber,
            tableLabel: r.tableLabel,
            method: r.method,
            status: r.status,
            amountCents: r.amountCents,
            tipCents: r.tipCents,
            receivedAmountCents: r.receivedAmountCents,
            paidAt: r.paidAt,
            canVoidCash: r.canVoidCash && r.status == "paid",
            fiscalPending: r.fiscalPending
        )
    }

    private static func fromCloud(_ r: PosCloudClient.PosTodayReceiptDto) -> DisplayReceipt {
        DisplayReceipt(
            localId: r.paymentId,
            paymentId: r.paymentId,
            orderNumber: r.orderNumber,
            tableLabel: r.tableLabel,
            method: r.method,
            status: r.status,
            amountCents: r.amountCents,
            tipCents: r.tipCents,
            receivedAmountCents: r.receivedAmountCents,
            paidAt: r.paidAt,
            canVoidCash: r.canVoidCash,
            fiscalPending: false
        )
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
