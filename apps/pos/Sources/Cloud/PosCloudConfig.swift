import Foundation

enum PosCloudConfig {
    private static let apiBaseKey = "gwada_pos_api_base"
    private static let supabaseUrlKey = "gwada_pos_supabase_url"
    private static let supabaseAnonKeyKey = "gwada_pos_supabase_anon_key"
    private static let restaurantIdKey = "gwada_pos_restaurant_id"
    private static let nestApiBaseKey = "gwada_pos_nest_api_base"
    private static let waiterProfileIdKey = "gwada_pos_waiter_profile_id"

    /// Default: Live-API. Für Dev in den Einstellungen / UserDefaults überschreiben.
    static var apiBaseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: apiBaseKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty,
           let url = URL(string: raw.replacingOccurrences(of: "/$", with: "", options: .regularExpression)) {
            return url
        }
        return URL(string: "https://gwada.app")!
    }

    static var supabaseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: supabaseUrlKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty,
           let url = URL(string: raw) {
            return url
        }
        // Dev-Default — bei Login aus UserDefaults überschreibbar
        return URL(string: "https://supabase.gwada.app")!
    }

    static var supabaseAnonKey: String {
        UserDefaults.standard.string(forKey: supabaseAnonKeyKey)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var restaurantId: String? {
        let raw = UserDefaults.standard.string(forKey: restaurantIdKey)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? nil : raw
    }

    /// Nest `apps/pos-api` Basis-URL (z. B. `http://127.0.0.1:3100`). Leer = Sync weiter über Next `/api/pos`.
    static var nestApiBaseURL: URL? {
        guard let raw = UserDefaults.standard.string(forKey: nestApiBaseKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty,
            let url = URL(string: raw.replacingOccurrences(of: "/$", with: "", options: .regularExpression))
        else {
            return nil
        }
        return url
    }

    /// Waiter-Profil-UUID für Nest `X-Waiter-Profile-Id` (Fallback: Auth-User-ID im Client).
    static var waiterProfileId: String? {
        let raw = UserDefaults.standard.string(forKey: waiterProfileIdKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? nil : raw
    }

    /// Nest-URL gesetzt → Hub-Outbox nutzt Nest Sync.
    static var nestSyncEnabled: Bool {
        nestApiBaseURL != nil
    }

    /// Handheld: bei Hub-Ausfall direkt Nest anbinden (Phase 4 Feature-Flag).
    private static let nestClientFallbackKey = "gwada_pos_nest_client_fallback"

    static var nestClientFallbackEnabled: Bool {
        UserDefaults.standard.bool(forKey: nestClientFallbackKey)
    }

    static func setNestClientFallbackEnabled(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: nestClientFallbackKey)
    }

    static func setApiBaseURL(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: apiBaseKey)
    }

    static func setSupabaseURL(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: supabaseUrlKey)
    }

    static func setSupabaseAnonKey(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: supabaseAnonKeyKey)
    }

    static func setRestaurantId(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: restaurantIdKey)
    }

    static func setNestApiBaseURL(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            UserDefaults.standard.removeObject(forKey: nestApiBaseKey)
        } else {
            UserDefaults.standard.set(trimmed, forKey: nestApiBaseKey)
        }
    }

    static func setWaiterProfileId(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            UserDefaults.standard.removeObject(forKey: waiterProfileIdKey)
        } else {
            UserDefaults.standard.set(trimmed, forKey: waiterProfileIdKey)
        }
    }
}
