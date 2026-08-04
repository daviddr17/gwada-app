import Foundation

// MARK: - Models

struct PosLocalReceiptLine: Codable, Equatable, Sendable {
    var quantity: Int
    var name: String
    var detail: String
    var totalCents: Int
    /// Gang der bezahlten Position (für Historie-Sektionen); ältere Belege: nil → default.
    var course: Int?

    init(quantity: Int, name: String, detail: String, totalCents: Int, course: Int? = nil) {
        self.quantity = quantity
        self.name = name
        self.detail = detail
        self.totalCents = totalCents
        self.course = course
    }
}

/// Demo-TSE-Felder (§ 6 KassenSichV) — bis echte Fiskaly-Anbindung.
struct PosLocalReceiptTse: Codable, Equatable, Sendable {
    var transactionNumber: Int
    var signatureCounter: Int
    var tseSerial: String
    var registerSerial: String
    var signature: String
    var processStartedAt: String
}

struct PosLocalReceipt: Codable, Identifiable, Equatable, Sendable {
    var localId: String
    var paymentId: String?
    var orderId: String?
    var orderNumber: Int
    var tableSessionId: String
    var tableLabel: String
    var diningTableId: String
    var method: String
    var status: String
    var amountCents: Int
    var tipCents: Int
    var receivedAmountCents: Int?
    var paidAt: String
    var fiscalPending: Bool
    var canVoidCash: Bool
    var dayYmd: String
    /// Anzeigename der Teilzahlung (z. B. „Rest / Alles“).
    var label: String?
    var items: [PosLocalReceiptLine]?
    var waiterName: String?
    var tse: PosLocalReceiptTse?

    var id: String { localId }

    var displayPaymentId: String { paymentId ?? localId }

    var paidTotalCents: Int { amountCents + tipCents }
}

struct PosCachedGiftVoucher: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var code: String
    var balanceCents: Int
    var initialAmountCents: Int
    var status: String
    var expiresAt: String?
    /// Lokal ausgestellt, noch nicht in Cloud.
    var pendingIssue: Bool
    /// Lokale Einlösung noch nicht synchronisiert.
    var pendingRedeemCents: Int
}

struct PosLocalRegisterState: Codable, Equatable, Sendable {
    var isOpen: Bool
    var sessionId: String?
    var openedAt: String?
    var openingCashCents: Int?
    var fiscalPending: Bool
    var pendingClose: Bool
    var pendingClosingCashCents: Int?
    var lastClosingZNr: Int?
    var suggestedOpeningCashCents: Int?
    var expectedCashCents: Int?
}

// MARK: - Persistence

/// Lokale Caches für Offline-Betrieb am Hub (Quittungen, Gutscheine, Storno-Gründe, Kasse).
enum PosOfflineCaches {
    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()
    private static let decoder = JSONDecoder()

    // MARK: Receipts

    private static var receiptsURL: URL {
        directory.appendingPathComponent("receipts-local.json")
    }

    static func loadReceipts() -> [PosLocalReceipt] {
        guard let data = try? Data(contentsOf: receiptsURL) else { return [] }
        return (try? decoder.decode([PosLocalReceipt].self, from: data)) ?? []
    }

    static func saveReceipts(_ receipts: [PosLocalReceipt]) {
        guard let data = try? encoder.encode(receipts) else { return }
        try? data.write(to: receiptsURL, options: [.atomic])
    }

    static func appendReceipt(_ receipt: PosLocalReceipt) {
        var all = loadReceipts()
        all.insert(receipt, at: 0)
        // Nur heutige + pending behalten (max 200)
        let today = Self.todayYmd()
        all = all.filter { $0.dayYmd == today || $0.fiscalPending || $0.status == "void_pending" }
        if all.count > 200 { all = Array(all.prefix(200)) }
        saveReceipts(all)
    }

    static func nextBonNumber() -> Int {
        (loadReceipts().map(\.orderNumber).max() ?? 4710) + 1
    }

    static func todayReceipts() -> [PosLocalReceipt] {
        let today = todayYmd()
        return loadReceipts().filter { $0.dayYmd == today }
    }

    static func receipts(forTableLabel label: String) -> [PosLocalReceipt] {
        todayReceipts().filter { $0.tableLabel == label }
    }

    static func makeReceipt(
        sessionId: String,
        tableLabel: String,
        diningTableId: String,
        lines: [SessionOpenLine],
        method: PosPaymentMethodKind,
        tipCents: Int,
        receivedAmountCents: Int?,
        label: String?,
        waiterName: String?
    ) -> PosLocalReceipt {
        let amount = lines.reduce(0) { $0 + $1.openCents }
        let paidAt = isoNow()
        let tse: PosLocalReceiptTse?
        if PosSecurityPolicy.allowsDemoFiscalTse {
            let start = Date().addingTimeInterval(-45)
            tse = PosReceiptFiscalDemo.nextTse(
                amountCents: amount,
                processStartedAt: ISO8601DateFormatter().string(from: start),
                processEndedAt: paidAt
            )
        } else {
            tse = nil
        }
        return PosLocalReceipt(
            localId: UUID().uuidString,
            paymentId: nil,
            orderId: nil,
            orderNumber: nextBonNumber(),
            tableSessionId: sessionId,
            tableLabel: tableLabel,
            diningTableId: diningTableId,
            method: method.rawValue,
            status: "paid",
            amountCents: amount,
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents,
            paidAt: paidAt,
            // Release: pending until cloud/TSE; DEBUG demo TSE is still marked pending.
            fiscalPending: true,
            canVoidCash: method == .cash,
            dayYmd: todayYmd(),
            label: label,
            items: lines.map {
                PosLocalReceiptLine(
                    quantity: $0.openQuantity,
                    name: $0.name,
                    detail: Self.receiptDetail(from: $0.detail),
                    totalCents: $0.openCents,
                    course: $0.course
                )
            },
            waiterName: waiterName,
            tse: tse
        )
    }

    /// Gang-Labels wie „Hauptgang“ nicht als Beleg-Zusatz zeigen (Prototyp: nur Mods).
    private static func receiptDetail(from raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let courseLabels = Set(PosCourse.uiCourses.map(PosCourse.label) + PosCourse.uiCourses.map(PosCourse.chipLabel))
        if courseLabels.contains(trimmed) { return "" }
        // „Hauptgang · ohne X“ → nur Mods behalten
        let parts = trimmed.split(separator: "·").map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let kept = parts.filter { !courseLabels.contains($0) }
        return kept.joined(separator: " · ")
    }

    static func updateReceipt(localId: String, mutate: (inout PosLocalReceipt) -> Void) {
        var all = loadReceipts()
        guard let idx = all.firstIndex(where: { $0.localId == localId }) else { return }
        mutate(&all[idx])
        saveReceipts(all)
    }

    static func markReceiptSynced(localId: String, paymentId: String) {
        updateReceipt(localId: localId) { r in
            r.paymentId = paymentId
            r.fiscalPending = false
            if r.status == "void_pending" { return }
            r.status = "paid"
            r.canVoidCash = r.method == "cash"
        }
    }

    // MARK: Gift vouchers

    private static var vouchersURL: URL {
        directory.appendingPathComponent("gift-vouchers-cache.json")
    }

    static func loadVouchers() -> [PosCachedGiftVoucher] {
        guard let data = try? Data(contentsOf: vouchersURL) else { return [] }
        return (try? decoder.decode([PosCachedGiftVoucher].self, from: data)) ?? []
    }

    static func saveVouchers(_ vouchers: [PosCachedGiftVoucher]) {
        guard let data = try? encoder.encode(vouchers) else { return }
        try? data.write(to: vouchersURL, options: [.atomic])
    }

    static func upsertVoucher(_ voucher: PosCachedGiftVoucher) {
        var all = loadVouchers()
        if let idx = all.firstIndex(where: { $0.id == voucher.id || $0.code == voucher.code }) {
            all[idx] = voucher
        } else {
            all.insert(voucher, at: 0)
        }
        saveVouchers(all)
    }

    static func findVoucher(code: String) -> PosCachedGiftVoucher? {
        let key = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return loadVouchers().first { $0.code.uppercased() == key }
    }

    static func findVoucher(id: String) -> PosCachedGiftVoucher? {
        loadVouchers().first { $0.id == id }
    }

    // MARK: Void reasons

    private static var voidReasonsURL: URL {
        directory.appendingPathComponent("void-reasons-cache.json")
    }

    static func loadVoidReasons() -> [PosCloudClient.PosVoidReasonDto] {
        guard let data = try? Data(contentsOf: voidReasonsURL) else { return [] }
        return (try? decoder.decode([PosCloudClient.PosVoidReasonDto].self, from: data)) ?? []
    }

    static func saveVoidReasons(_ reasons: [PosCloudClient.PosVoidReasonDto]) {
        guard let data = try? encoder.encode(reasons) else { return }
        try? data.write(to: voidReasonsURL, options: [.atomic])
    }

    // MARK: Register

    private static var registerURL: URL {
        directory.appendingPathComponent("register-local.json")
    }

    static func loadRegister() -> PosLocalRegisterState? {
        guard let data = try? Data(contentsOf: registerURL) else { return nil }
        return try? decoder.decode(PosLocalRegisterState.self, from: data)
    }

    static func saveRegister(_ state: PosLocalRegisterState) {
        guard let data = try? encoder.encode(state) else { return }
        try? data.write(to: registerURL, options: [.atomic])
    }

    // MARK: Helpers

    static func todayYmd() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
