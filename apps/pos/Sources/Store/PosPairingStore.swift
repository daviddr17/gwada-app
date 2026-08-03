import Foundation
import Security

/// Hub-seitige Kopplungs-State-Machine (thread-safe, aus HTTP-Handler nutzbar).
/// Approved Tokens: Klartext nur in-memory zur einmaligen Auslieferung; Persistenz nur SHA-256-Hashes.
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
        /// SHA-256 hex of pair token (never plaintext on disk).
        var tokenHash: String
        var approvedAt: Date

        enum CodingKeys: String, CodingKey {
            case installationId, deviceName, tokenHash, approvedAt
            case token // legacy plaintext (migrate → hash)
        }

        init(installationId: String, deviceName: String, tokenHash: String, approvedAt: Date) {
            self.installationId = installationId
            self.deviceName = deviceName
            self.tokenHash = tokenHash
            self.approvedAt = approvedAt
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            installationId = try c.decode(String.self, forKey: .installationId)
            deviceName = try c.decode(String.self, forKey: .deviceName)
            approvedAt = try c.decode(Date.self, forKey: .approvedAt)
            if let hash = try c.decodeIfPresent(String.self, forKey: .tokenHash), !hash.isEmpty {
                tokenHash = hash
            } else if let legacy = try c.decodeIfPresent(String.self, forKey: .token), !legacy.isEmpty {
                tokenHash = PosTokenHash.sha256Hex(legacy)
            } else {
                tokenHash = ""
            }
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(installationId, forKey: .installationId)
            try c.encode(deviceName, forKey: .deviceName)
            try c.encode(tokenHash, forKey: .tokenHash)
            try c.encode(approvedAt, forKey: .approvedAt)
        }
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
    private var validTokenHashes: Set<String> = []
    /// Klartext nur bis das Handgerät `pair/status` abholt (nicht persistiert).
    private var deliveryTokensByPair: [String: String] = [:]
    private var hubInfo: PosLanHubInfo?

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
            validTokenHashes = Set(persisted.tokenHashes)
            for raw in persisted.legacyPlainTokens ?? [] where !raw.isEmpty {
                validTokenHashes.insert(PosTokenHash.sha256Hex(raw))
            }
            for device in approvedByPair.values where !device.tokenHash.isEmpty {
                validTokenHashes.insert(device.tokenHash)
            }
            // Legacy plaintext → rewrite hashed-only.
            if persisted.legacyPlainTokens?.isEmpty == false || persisted.usedLegacyTokenField {
                persistLocked()
            }
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
        if approvedByPair[pairId] != nil {
            let delivery = deliveryTokensByPair.removeValue(forKey: pairId)
            return PosLanPairStatus(state: .approved, token: delivery, hub: hubInfo)
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
        let hash = PosTokenHash.sha256Hex(token)
        approvedByPair[pairId] = ApprovedDevice(
            installationId: p.installationId,
            deviceName: p.deviceName,
            tokenHash: hash,
            approvedAt: now()
        )
        validTokenHashes.insert(hash)
        deliveryTokensByPair[pairId] = token
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
        let hash = PosTokenHash.sha256Hex(token)
        return validTokenHashes.contains(hash)
    }

    func revoke(token: String) {
        revoke(tokenHash: PosTokenHash.sha256Hex(token))
    }

    func revoke(tokenHash hash: String) {
        lock.lock(); defer { lock.unlock() }
        validTokenHashes.remove(hash)
        approvedByPair = approvedByPair.filter { $0.value.tokenHash != hash }
        deliveryTokensByPair = deliveryTokensByPair.filter { PosTokenHash.sha256Hex($0.value) != hash }
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
        var tokenHashes: [String]
        var approvedByPair: [String: ApprovedDevice]
        /// Migration from older plaintext format.
        var legacyPlainTokens: [String]? = nil
        var usedLegacyTokenField: Bool = false

        enum CodingKeys: String, CodingKey {
            case tokenHashes, approvedByPair, tokens
        }

        init(tokenHashes: [String], approvedByPair: [String: ApprovedDevice]) {
            self.tokenHashes = tokenHashes
            self.approvedByPair = approvedByPair
            self.legacyPlainTokens = nil
            self.usedLegacyTokenField = false
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            approvedByPair = try c.decodeIfPresent([String: ApprovedDevice].self, forKey: .approvedByPair) ?? [:]
            if let hashes = try c.decodeIfPresent([String].self, forKey: .tokenHashes) {
                tokenHashes = hashes
                legacyPlainTokens = nil
                usedLegacyTokenField = false
            } else if let plain = try c.decodeIfPresent([String].self, forKey: .tokens) {
                tokenHashes = []
                legacyPlainTokens = plain
                usedLegacyTokenField = true
            } else {
                tokenHashes = []
                legacyPlainTokens = nil
                usedLegacyTokenField = false
            }
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(tokenHashes, forKey: .tokenHashes)
            try c.encode(approvedByPair, forKey: .approvedByPair)
        }
    }

    private static var defaultPersistURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("pairing-tokens.json")
    }

    private func persistLocked() {
        guard persistEnabled else { return }
        let payload = Persisted(tokenHashes: Array(validTokenHashes), approvedByPair: approvedByPair)
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
