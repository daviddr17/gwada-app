import Foundation

// MARK: - Models

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

    var id: String { localId }

    var displayPaymentId: String { paymentId ?? localId }
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
