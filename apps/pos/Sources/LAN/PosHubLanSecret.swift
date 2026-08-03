import Foundation

/// Persistentes LAN-Secret für KDS Browser-API (Tickets/Advance) — nicht Pair-Token.
enum PosHubLanSecret {
    private static let defaultsKey = "gwada_pos_hub_lan_secret"

    static func current() -> String {
        if let existing = UserDefaults.standard.string(forKey: defaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !existing.isEmpty
        {
            return existing
        }
        let generated = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(24))
        UserDefaults.standard.set(generated, forKey: defaultsKey)
        return generated
    }

    #if DEBUG
    static func resetForTests() {
        UserDefaults.standard.removeObject(forKey: defaultsKey)
    }
    #endif
}
