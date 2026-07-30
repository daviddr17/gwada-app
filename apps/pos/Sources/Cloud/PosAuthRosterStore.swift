import CryptoKit
import Foundation

struct PosAuthRosterStaff: Codable, Equatable, Sendable, Identifiable {
    var id: String
    var given_name: String
    var family_name: String
    var profile_id: String?
    var position_name: String?
    var offline_pin_hash: String
    var permissions: [String]

    var displayName: String {
        "\(given_name) \(family_name)".trimmingCharacters(in: .whitespaces)
    }
}

struct PosAuthRoster: Codable, Equatable, Sendable {
    var restaurantId: String
    var fetchedAt: String
    var staff: [PosAuthRosterStaff]
}

enum PosOfflinePin {
    /// Muss zu Postgres `pos_display_pin_offline_hash` passen.
    static func hash(pin: String, restaurantId: String) -> String {
        let payload = "\(pin)\u{0000}\(restaurantId)\u{0000}gwada-pos-offline-v1"
        let digest = SHA256.hash(data: Data(payload.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    static func resolveStaff(pin: String, roster: PosAuthRoster) -> PosAuthRosterStaff? {
        let expected = hash(pin: pin, restaurantId: roster.restaurantId)
        return roster.staff.first { $0.offline_pin_hash.lowercased() == expected }
    }
}

@MainActor
final class PosAuthRosterStore {
    static let shared = PosAuthRosterStore()

    private let storageKey = "gwada_pos_auth_roster"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private(set) var roster: PosAuthRoster?

    private init() {
        load()
    }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let saved = try? decoder.decode(PosAuthRoster.self, from: data) else {
            roster = nil
            return
        }
        roster = saved
    }

    func save(_ roster: PosAuthRoster) {
        self.roster = roster
        if let data = try? encoder.encode(roster) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    func clear() {
        roster = nil
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    func applyApiRoster(restaurantId: String, fetchedAt: String, staff: [PosAuthRosterStaff]) {
        save(PosAuthRoster(restaurantId: restaurantId, fetchedAt: fetchedAt, staff: staff))
    }
}
