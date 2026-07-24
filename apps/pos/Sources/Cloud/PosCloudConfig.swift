import Foundation

enum PosCloudConfig {
    private static let apiBaseKey = "gwada_pos_api_base"
    private static let supabaseUrlKey = "gwada_pos_supabase_url"
    private static let supabaseAnonKeyKey = "gwada_pos_supabase_anon_key"
    private static let restaurantIdKey = "gwada_pos_restaurant_id"
    private static let nestApiBaseKey = "gwada_pos_nest_api_base"
    private static let waiterProfileIdKey = "gwada_pos_waiter_profile_id"

    /// API (Next). UserDefaults nur DEBUG-Override; sonst `PosEnvironment`.
    static var apiBaseURL: URL {
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: apiBaseKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty,
           let url = URL(string: raw.replacingOccurrences(of: "/$", with: "", options: .regularExpression))
        {
            return url
        }
        #endif
        return PosEnvironment.apiBaseURL
    }

    static var supabaseURL: URL {
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: supabaseUrlKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty,
           let url = URL(string: raw)
        {
            return url
        }
        #endif
        return PosEnvironment.supabaseURL
    }

    static var supabaseAnonKey: String {
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: supabaseAnonKeyKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty
        {
            return raw
        }
        #endif
        return PosEnvironment.supabaseAnonKey
    }

    static var restaurantId: String? {
        let raw = UserDefaults.standard.string(forKey: restaurantIdKey)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? nil : raw
    }

    /// Nest `apps/pos-api` Basis-URL. Leer = Sync weiter über Next `/api/pos`.
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

    static var waiterProfileId: String? {
        let raw = UserDefaults.standard.string(forKey: waiterProfileIdKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return raw.isEmpty ? nil : raw
    }

    static var nestSyncEnabled: Bool {
        nestApiBaseURL != nil
    }

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

    /// Stellt sicher, dass Dev-Defaults greifen (löscht veraltete manuelle Overrides in DEBUG optional nicht).
    static func applyEnvironmentDefaultsIfNeeded() {
        // Restaurant bleibt User-Wahl; URLs/Keys kommen aus PosEnvironment sofern keine DEBUG-Overrides.
        _ = supabaseURL
        _ = supabaseAnonKey
        _ = apiBaseURL
    }
}
