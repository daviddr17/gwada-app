import Foundation

/// Hub-seitige Kopplungs-State-Machine (thread-safe, aus HTTP-Handler nutzbar).
/// Approved Tokens werden persistiert — iPad-Rebuild darf gekoppelte iPhones nicht vergessen.
final class PosPairingStore: @unchecked Sendable {
    static let shared = PosPairingStore()

    struct PendingPairing: Sendable, Equatable {
        var pairId: String
        var deviceName: String
        var installationId: String
        var verificationCode: String
        var createdAt: Date
    }

    struct ApprovedDevice: Sendable, Equatable, Codable {
        var installationId: String
        var deviceName: String
        var token: String
        var approvedAt: Date
    }

    let pendingTTL: TimeInterval = 300

    private let lock = NSLock()
    private let now: () -> Date
    private let persistEnabled: Bool
    private let persistFileURL: URL
    private var pending: [String: PendingPairing] = [:]
    private var rejected: Set<String> = []
    private var expiredPairIds: Set<String> = []
    private var approvedByPair: [String: ApprovedDevice] = [:]
    private var validTokens: Set<String> = []
    private var hubInfo: PosLanHubInfo?

    /// - Parameter persistEnabled: `false` in Unit-Tests (kein Application-Support-I/O).
    /// - Parameter persistURL: Override für Tests; Standard = Application Support.
    init(
        now: @escaping () -> Date = { Date() },
        persistEnabled: Bool = true,
        persistURL: URL? = nil
    ) {
        self.now = now
        self.persistEnabled = persistEnabled
        self.persistFileURL = persistURL ?? Self.defaultPersistURL
        if persistEnabled, let persisted = Self.loadPersisted(from: self.persistFileURL) {
            approvedByPair = persisted.approvedByPair
            validTokens = Set(persisted.tokens)
        }
    }

    func configureHubInfo(_ info: PosLanHubInfo) {
        lock.lock(); defer { lock.unlock() }
        hubInfo = info
    }

    func createPending(_ req: PosLanPairRequest) -> PosLanPairChallenge {
        lock.lock(); defer { lock.unlock() }
        let pairId = UUID().uuidString
        let code = String(format: "%06d", Int.random(in: 0...999_999))
        pending[pairId] = PendingPairing(
            pairId: pairId,
            deviceName: req.deviceName,
            installationId: req.installationId,
            verificationCode: code,
            createdAt: now()
        )
        return PosLanPairChallenge(pairId: pairId, verificationCode: code)
    }

    func status(pairId: String) -> PosLanPairStatus {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        if let approved = approvedByPair[pairId] {
            return PosLanPairStatus(state: .approved, token: approved.token, hub: hubInfo)
        }
        if pending[pairId] != nil {
            return PosLanPairStatus(state: .pending, token: nil, hub: nil)
        }
        if expiredPairIds.contains(pairId) {
            return PosLanPairStatus(state: .expired, token: nil, hub: nil)
        }
        return PosLanPairStatus(state: .rejected, token: nil, hub: nil)
    }

    @discardableResult
    func approve(pairId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        guard let p = pending.removeValue(forKey: pairId) else { return nil }
        let token = Self.makeToken()
        approvedByPair[pairId] = ApprovedDevice(
            installationId: p.installationId,
            deviceName: p.deviceName,
            token: token,
            approvedAt: now()
        )
        validTokens.insert(token)
        persistLocked()
        return token
    }

    @discardableResult
    func approveAllPending() -> Int {
        let ids = pendingList().map(\.pairId)
        var count = 0
        for id in ids {
            if approve(pairId: id) != nil { count += 1 }
        }
        return count
    }

    func reject(pairId: String) {
        lock.lock(); defer { lock.unlock() }
        pending.removeValue(forKey: pairId)
        rejected.insert(pairId)
    }

    func verify(token: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return validTokens.contains(token)
    }

    func revoke(token: String) {
        lock.lock(); defer { lock.unlock() }
        validTokens.remove(token)
        approvedByPair = approvedByPair.filter { $0.value.token != token }
        persistLocked()
    }

    func pendingList() -> [PendingPairing] {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        return pending.values.sorted { $0.createdAt < $1.createdAt }
    }

    func approvedList() -> [ApprovedDevice] {
        lock.lock(); defer { lock.unlock() }
        return approvedByPair.values.sorted { $0.approvedAt < $1.approvedAt }
    }

    // MARK: - Persist

    private struct Persisted: Codable {
        var tokens: [String]
        var approvedByPair: [String: ApprovedDevice]
    }

    private static var defaultPersistURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("pairing-tokens.json")
    }

    private func persistLocked() {
        guard persistEnabled else { return }
        let payload = Persisted(tokens: Array(validTokens), approvedByPair: approvedByPair)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(payload) else { return }
        try? data.write(to: persistFileURL, options: [.atomic])
    }

    private static func loadPersisted(from url: URL) -> Persisted? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(Persisted.self, from: data)
    }

    // MARK: - Intern (lock muss gehalten sein)

    private func expireLocked() {
        let cutoff = now().addingTimeInterval(-pendingTTL)
        let overdue = pending.filter { $0.value.createdAt < cutoff }
        guard !overdue.isEmpty else { return }
        for pairId in overdue.keys {
            pending.removeValue(forKey: pairId)
            expiredPairIds.insert(pairId)
        }
    }

    private static func makeToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            return UUID().uuidString + UUID().uuidString
        }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
