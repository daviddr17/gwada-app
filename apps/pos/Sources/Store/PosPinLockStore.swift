import CryptoKit
import Foundation

/// Lokaler PIN-Lock für Kellner-Geräte (Phase 4 Prototyp).
/// Speichert nur Hash — kein Klartext. Lockout nach Fehlversuchen.
@MainActor
final class PosPinLockStore: ObservableObject {
    static let shared = PosPinLockStore()

    @Published private(set) var isUnlocked = false
    @Published private(set) var failedAttempts = 0
    @Published private(set) var lockedUntil: Date?
    @Published private(set) var hasPinConfigured = false
    @Published var activeWaiterProfileId: String?

    private let pinHashKey = "gwada_pos_waiter_pin_sha256"
    private let saltKey = "gwada_pos_waiter_pin_salt"
    private let maxAttempts = 5
    private let lockoutSeconds: TimeInterval = 30

    private init() {
        hasPinConfigured = UserDefaults.standard.string(forKey: pinHashKey) != nil
        // Hub ohne gesetzte PIN: entsperrt (Enrollment später).
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

    func configurePin(_ pin: String) -> Bool {
        let digits = pin.filter(\.isNumber)
        guard digits.count == 6 else { return false }
        let salt = UUID().uuidString
        let hash = Self.hash(pin: digits, salt: salt)
        UserDefaults.standard.set(salt, forKey: saltKey)
        UserDefaults.standard.set(hash, forKey: pinHashKey)
        hasPinConfigured = true
        isUnlocked = true
        failedAttempts = 0
        lockedUntil = nil
        return true
    }

    func clearPin() {
        UserDefaults.standard.removeObject(forKey: pinHashKey)
        UserDefaults.standard.removeObject(forKey: saltKey)
        hasPinConfigured = false
        isUnlocked = true
        failedAttempts = 0
        lockedUntil = nil
    }

    func lock() {
        guard hasPinConfigured else { return }
        isUnlocked = false
    }

    @discardableResult
    func unlock(with pin: String) -> Bool {
        if isInLockout { return false }
        let digits = pin.filter(\.isNumber)
        guard digits.count == 6 else { return false }
        guard let salt = UserDefaults.standard.string(forKey: saltKey),
              let expected = UserDefaults.standard.string(forKey: pinHashKey)
        else {
            // Kein PIN → Setup nötig
            return false
        }
        let actual = Self.hash(pin: digits, salt: salt)
        if actual == expected {
            isUnlocked = true
            failedAttempts = 0
            lockedUntil = nil
            return true
        }
        failedAttempts += 1
        if failedAttempts >= maxAttempts {
            lockedUntil = Date().addingTimeInterval(lockoutSeconds)
            failedAttempts = 0
        }
        return false
    }

    private static func hash(pin: String, salt: String) -> String {
        let data = Data((salt + ":" + pin).utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
