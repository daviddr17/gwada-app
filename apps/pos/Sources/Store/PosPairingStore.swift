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
        /// Wann der Token ungültig wird (P2-1). Fehlt bei Legacy → Migration.
        var expiresAt: Date?

        enum CodingKeys: String, CodingKey {
            case installationId, deviceName, tokenHash, approvedAt, expiresAt
            case token // legacy plaintext (migrate → hash)
        }

        init(
            installationId: String,
            deviceName: String,
            tokenHash: String,
            approvedAt: Date,
            expiresAt: Date?
        ) {
            self.installationId = installationId
            self.deviceName = deviceName
            self.tokenHash = tokenHash
            self.approvedAt = approvedAt
            self.expiresAt = expiresAt
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            installationId = try c.decode(String.self, forKey: .installationId)
            deviceName = try c.decode(String.self, forKey: .deviceName)
            approvedAt = try c.decode(Date.self, forKey: .approvedAt)
            expiresAt = try c.decodeIfPresent(Date.self, forKey: .expiresAt)
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
            try c.encodeIfPresent(expiresAt, forKey: .expiresAt)
        }
    }

    let pendingTTL: TimeInterval = 300
    /// Pair-Token Lebensdauer (Schicht-Fenster).
    let tokenTTL: TimeInterval = 8 * 60 * 60
    /// Nach Expiry noch kurz refreshbar.
    let refreshGraceTTL: TimeInterval = 15 * 60

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
    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

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
                let hash = PosTokenHash.sha256Hex(raw)
                validTokenHashes.insert(hash)
                if !approvedByPair.values.contains(where: { $0.tokenHash == hash }) {
                    let pairId = "legacy-\(hash.prefix(12))"
                    let approvedAt = now()
                    approvedByPair[pairId] = ApprovedDevice(
                        installationId: pairId,
                        deviceName: "Legacy",
                        tokenHash: hash,
                        approvedAt: approvedAt,
                        expiresAt: approvedAt.addingTimeInterval(tokenTTL)
                    )
                }
            }
            for device in approvedByPair.values where !device.tokenHash.isEmpty {
                validTokenHashes.insert(device.tokenHash)
            }
            // Legacy ohne expiresAt → Schicht-Fenster ab approvedAt.
            var migratedExpiry = false
            for (pairId, device) in approvedByPair where device.expiresAt == nil {
                var copy = device
                copy.expiresAt = device.approvedAt.addingTimeInterval(tokenTTL)
                approvedByPair[pairId] = copy
                migratedExpiry = true
            }
            // Legacy plaintext → rewrite hashed-only.
            if persisted.legacyPlainTokens?.isEmpty == false || persisted.usedLegacyTokenField || migratedExpiry {
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
        if let device = approvedByPair[pairId] {
            let delivery = deliveryTokensByPair.removeValue(forKey: pairId)
            let expires = device.expiresAt.map { isoFormatter.string(from: $0) }
            return PosLanPairStatus(
                state: .approved,
                token: delivery,
                hub: hubInfo,
                tokenExpiresAt: expires
            )
        }
        if pending[pairId] != nil {
            return PosLanPairStatus(state: .pending, token: nil, hub: nil, tokenExpiresAt: nil)
        }
        if expiredPairIds.contains(pairId) {
            return PosLanPairStatus(state: .expired, token: nil, hub: nil, tokenExpiresAt: nil)
        }
        return PosLanPairStatus(state: .rejected, token: nil, hub: nil, tokenExpiresAt: nil)
    }

    @discardableResult
    func approve(pairId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        guard let p = pending.removeValue(forKey: pairId) else { return nil }
        let token = Self.makeToken()
        let hash = PosTokenHash.sha256Hex(token)
        let approvedAt = now()
        approvedByPair[pairId] = ApprovedDevice(
            installationId: p.installationId,
            deviceName: p.deviceName,
            tokenHash: hash,
            approvedAt: approvedAt,
            expiresAt: approvedAt.addingTimeInterval(tokenTTL)
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
        prunePastGraceLocked()
        guard let device = deviceForTokenLocked(token) else { return false }
        let expires = device.expiresAt ?? device.approvedAt.addingTimeInterval(tokenTTL)
        return now() < expires
    }

    /// Rotiert Token wenn noch gültig oder in Grace nach Expiry.
    func refresh(token: String) -> PosLanPairRefreshResponse? {
        lock.lock(); defer { lock.unlock() }
        prunePastGraceLocked()
        guard let pairId = pairIdForTokenLocked(token),
              var device = approvedByPair[pairId]
        else { return nil }
        let expires = device.expiresAt ?? device.approvedAt.addingTimeInterval(tokenTTL)
        guard now() < expires.addingTimeInterval(refreshGraceTTL) else { return nil }
        let oldHash = device.tokenHash
        let newToken = Self.makeToken()
        let newHash = PosTokenHash.sha256Hex(newToken)
        let issuedAt = now()
        let expiresAt = issuedAt.addingTimeInterval(tokenTTL)
        device.tokenHash = newHash
        device.approvedAt = issuedAt
        device.expiresAt = expiresAt
        approvedByPair[pairId] = device
        validTokenHashes.remove(oldHash)
        validTokenHashes.insert(newHash)
        persistLocked()
        return PosLanPairRefreshResponse(
            token: newToken,
            expiresAt: isoFormatter.string(from: expiresAt),
            hub: hubInfo
        )
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
        prunePastGraceLocked()
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

    /// `pairId` wenn Token-Hash bekannt (auch während Grace nach Expiry).
    private func pairIdForTokenLocked(_ token: String) -> String? {
        let hash = PosTokenHash.sha256Hex(token)
        guard validTokenHashes.contains(hash) else { return nil }
        return approvedByPair.first(where: { $0.value.tokenHash == hash })?.key
    }

    private func deviceForTokenLocked(_ token: String) -> ApprovedDevice? {
        guard let pairId = pairIdForTokenLocked(token) else { return nil }
        return approvedByPair[pairId]
    }

    /// Entfernt nur Tokens nach TTL + Grace — Grace bleibt für Refresh nutzbar.
    private func prunePastGraceLocked() {
        let t = now()
        var removed = false
        for (pairId, device) in approvedByPair {
            let expires = device.expiresAt ?? device.approvedAt.addingTimeInterval(tokenTTL)
            if t >= expires.addingTimeInterval(refreshGraceTTL) {
                validTokenHashes.remove(device.tokenHash)
                approvedByPair.removeValue(forKey: pairId)
                removed = true
            }
        }
        if removed { persistLocked() }
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
