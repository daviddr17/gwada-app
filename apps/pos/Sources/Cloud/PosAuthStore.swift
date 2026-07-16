import Foundation

struct PosAuthSession: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: TimeInterval
    var userId: String
    var email: String
}

@MainActor
final class PosAuthStore: ObservableObject {
    static let shared = PosAuthStore()

    @Published private(set) var session: PosAuthSession?

    private let storageKey = "gwada_pos_auth_session"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        load()
    }

    var isSignedIn: Bool { session != nil }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let saved = try? decoder.decode(PosAuthSession.self, from: data) else {
            session = nil
            return
        }
        session = saved
    }

    func save(_ session: PosAuthSession) {
        self.session = session
        if let data = try? encoder.encode(session) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    func clear() {
        session = nil
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    func validAccessToken() async throws -> String {
        guard var current = session else {
            throw PosCloudError.unauthorized
        }
        let now = Date().timeIntervalSince1970
        if current.expiresAt - now > 60 {
            return current.accessToken
        }
        current = try await refresh(session: current)
        save(current)
        return current.accessToken
    }

    func signIn(email: String, password: String) async throws {
        let anon = PosCloudConfig.supabaseAnonKey
        guard !anon.isEmpty else { throw PosCloudError.missingConfig("Supabase Anon Key") }

        var request = URLRequest(url: PosCloudConfig.supabaseURL.appendingPathComponent("auth/v1/token"))
        var components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        request.url = components.url
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anon, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
            "password": password,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PosCloudError.invalidResponse }
        guard http.statusCode == 200 else {
            throw PosCloudError.httpStatus(http.statusCode, String(data: data, encoding: .utf8))
        }

        let payload = try decoder.decode(GoTrueTokenResponse.self, from: data)
        let expiresAt = Date().timeIntervalSince1970 + TimeInterval(payload.expires_in)
        save(PosAuthSession(
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: expiresAt,
            userId: payload.user.id,
            email: payload.user.email ?? email
        ))
    }

    private func refresh(session: PosAuthSession) async throws -> PosAuthSession {
        let anon = PosCloudConfig.supabaseAnonKey
        guard !anon.isEmpty else { throw PosCloudError.missingConfig("Supabase Anon Key") }

        var request = URLRequest(url: PosCloudConfig.supabaseURL.appendingPathComponent("auth/v1/token"))
        var components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        request.url = components.url
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anon, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "refresh_token": session.refreshToken,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            clear()
            throw PosCloudError.unauthorized
        }
        let payload = try decoder.decode(GoTrueTokenResponse.self, from: data)
        return PosAuthSession(
            accessToken: payload.access_token,
            refreshToken: payload.refresh_token,
            expiresAt: Date().timeIntervalSince1970 + TimeInterval(payload.expires_in),
            userId: payload.user.id,
            email: payload.user.email ?? session.email
        )
    }
}

private struct GoTrueTokenResponse: Decodable {
    var access_token: String
    var refresh_token: String
    var expires_in: Int
    var user: GoTrueUser
}

private struct GoTrueUser: Decodable {
    var id: String
    var email: String?
}
