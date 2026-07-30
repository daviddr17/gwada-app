import CryptoKit
import Foundation

/// PIN-Lock mit Keychain, eskalierendem Lockout und Audit (Phase 5).
@MainActor
final class PosPinLockStore: ObservableObject {
    static let shared = PosPinLockStore()

    @Published private(set) var isUnlocked = false
    @Published private(set) var failedAttempts = 0
    @Published private(set) var lockedUntil: Date?
    @Published private(set) var hasPinConfigured = false
    @Published var activeWaiterProfileId: String?

    private let pinHashAccount = "waiter_pin_sha256"
    private let saltAccount = "waiter_pin_salt"
    private let lockoutCountKey = "gwada_pos_lockout_streak"
    private let legacyHashKey = "gwada_pos_waiter_pin_sha256"
    private let legacySaltKey = "gwada_pos_waiter_pin_salt"

    private let maxAttempts = 5
    private let baseLockoutSeconds: TimeInterval = 30

    private init() {
        migrateFromUserDefaultsIfNeeded()
        hasPinConfigured = PosKeychain.get(account: pinHashAccount) != nil
        isUnlocked = !hasPinConfigured
    }

    var isInLockout: Bool {
        if let until = lockedUntil, until > Date() { return true }
        return false
    }

    var lockoutRemainingSeconds: Int {
        guard let until = lockedUntil else { return 0 }
        return max(0, Int(until.timeIntervalSinceNow.rounded(.up)))
    }

    /// Auto-Lock nach Inaktivität (Sekunden). 0 = aus.
    var autoLockSeconds: TimeInterval {
        get {
            let v = UserDefaults.standard.double(forKey: "gwada_pos_auto_lock_seconds")
            return v > 0 ? v : 120
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "gwada_pos_auto_lock_seconds")
        }
    }

    func configurePin(_ pin: String) -> Bool {
        let digits = pin.filter(\.isNumber)
        guard digits.count == 6 else { return false }
        let salt = UUID().uuidString
        let hash = Self.hash(pin: digits, salt: salt)
        PosKeychain.set(salt, account: saltAccount)
        PosKeychain.set(hash, account: pinHashAccount)
        hasPinConfigured = true
        isUnlocked = true
        failedAttempts = 0
        lockedUntil = nil
        UserDefaults.standard.set(0, forKey: lockoutCountKey)
        PosAuditLog.shared.record("pin.configured", detail: "PIN gesetzt (Keychain)")
        return true
    }

    func clearPin() {
        PosKeychain.delete(account: pinHashAccount)
        PosKeychain.delete(account: saltAccount)
        UserDefaults.standard.removeObject(forKey: legacyHashKey)
        UserDefaults.standard.removeObject(forKey: legacySaltKey)
        hasPinConfigured = false
        isUnlocked = true
        failedAttempts = 0
        lockedUntil = nil
        PosAuditLog.shared.record("pin.cleared", detail: "PIN entfernt")
    }

    func lock(reason: String = "manual") {
        guard hasPinConfigured else { return }
        isUnlocked = false
        PosAuditLog.shared.record("pin.locked", detail: reason)
    }

    @discardableResult
    func unlock(with pin: String) -> Bool {
        if isInLockout {
            PosAuditLog.shared.record("pin.unlock_blocked", detail: "lockout")
            return false
        }
        let digits = pin.filter(\.isNumber)
        guard digits.count == 6 else { return false }
        guard let salt = PosKeychain.get(account: saltAccount),
              let expected = PosKeychain.get(account: pinHashAccount)
        else {
            return false
        }
        let actual = Self.hash(pin: digits, salt: salt)
        if actual == expected {
            isUnlocked = true
            failedAttempts = 0
            lockedUntil = nil
            UserDefaults.standard.set(0, forKey: lockoutCountKey)
            PosAuditLog.shared.record("pin.unlocked", detail: "ok")
            return true
        }
        failedAttempts += 1
        PosAuditLog.shared.record("pin.unlock_failed", detail: "attempt \(failedAttempts)")
        if failedAttempts >= maxAttempts {
            let streak = UserDefaults.standard.integer(forKey: lockoutCountKey) + 1
            UserDefaults.standard.set(streak, forKey: lockoutCountKey)
            let seconds = baseLockoutSeconds * pow(2.0, Double(min(streak - 1, 4)))
            lockedUntil = Date().addingTimeInterval(seconds)
            failedAttempts = 0
            PosAuditLog.shared.record(
                "pin.lockout",
                detail: "\(Int(seconds))s (streak \(streak))"
            )
        }
        return false
    }

    private func migrateFromUserDefaultsIfNeeded() {
        guard PosKeychain.get(account: pinHashAccount) == nil,
              let hash = UserDefaults.standard.string(forKey: legacyHashKey),
              let salt = UserDefaults.standard.string(forKey: legacySaltKey)
        else { return }
        PosKeychain.set(hash, account: pinHashAccount)
        PosKeychain.set(salt, account: saltAccount)
        UserDefaults.standard.removeObject(forKey: legacyHashKey)
        UserDefaults.standard.removeObject(forKey: legacySaltKey)
        // Audit nach init — kein record hier (Bootstrap-Reihenfolge).
    }

    private static func hash(pin: String, salt: String) -> String {
        let data = Data((salt + ":" + pin).utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
