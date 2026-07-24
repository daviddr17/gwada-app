import Foundation

/// Build-Kanal: zuerst nur Dev-VPS; Live später.
enum PosBuildChannel: String, Sendable {
    case devVps
    case production
}

/// Feste Endpoints / Secrets — **nicht** vom Nutzer tippen.
enum PosEnvironment {
    /// Aktuell: nur Dev. Live-Switch später (z. B. Schema/Build-Flag).
    static let channel: PosBuildChannel = .devVps

    /// Dev-Supabase Kong auf dem VPS (siehe `.env.development.example`).
    static let devSupabaseURL = URL(string: "http://95.111.229.250:8100")!

    /// Next gegen Dev-DB — Override per Info.plist `POSDevApiBaseURL`.
    /// Simulator-Default: lokaler `pnpm --filter web dev` / `dev:docker`.
    static var devApiBaseURL: URL {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "POSDevApiBaseURL") as? String,
           let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
           !raw.isEmpty
        {
            return url
        }
        return URL(string: "http://127.0.0.1:3000")!
    }

    /// Anon Key: Info.plist `POSDevSupabaseAnonKey`, sonst bekannter Supabase-Demo-Key
    /// (VPS-Dev nach `pnpm provision:dev` oft identisch — bei Mismatch Key in Info.plist setzen).
    static var devSupabaseAnonKey: String {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "POSDevSupabaseAnonKey") as? String {
            let t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty { return t }
        }
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    }

    static var supabaseURL: URL {
        switch channel {
        case .devVps: return devSupabaseURL
        case .production: return URL(string: "https://gwada.app/sb")!
        }
    }

    static var supabaseAnonKey: String {
        switch channel {
        case .devVps: return devSupabaseAnonKey
        case .production:
            return (Bundle.main.object(forInfoDictionaryKey: "POSSupabaseAnonKey") as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
    }

    static var apiBaseURL: URL {
        switch channel {
        case .devVps: return devApiBaseURL
        case .production: return URL(string: "https://gwada.app")!
        }
    }

    static var channelLabel: String {
        switch channel {
        case .devVps: return "Dev-VPS"
        case .production: return "Live"
        }
    }
}
