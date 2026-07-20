import Foundation

/// Stabile Geräte-ID für Nest `X-Device-Id` (überlebt App-Neustarts).
enum PosDeviceIdentity {
    private static let key = "gwada_pos_stable_device_id"

    static var id: String {
        if let existing = UserDefaults.standard.string(forKey: key)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !existing.isEmpty {
            return existing
        }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }
}
