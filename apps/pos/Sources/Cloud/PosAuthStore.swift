import Foundation

struct PosDeviceCredential: Codable, Equatable, Sendable {
    var deviceId: String
    var deviceToken: String
    var installationId: String
    var restaurantId: String
    var restaurantName: String?
    var deviceName: String?
    var autoLockSeconds: Int
}

struct PosPinSession: Codable, Equatable, Sendable {
    var sessionId: String
    var sessionToken: String
    var staffId: String
    var staffName: String
    var profileId: String?
    var permissionKeys: [String]
}

/// Geräte-Kopplung + Display-PIN-Session (ersetzt E-Mail/Passwort am Gerät).
@MainActor
final class PosAuthStore: ObservableObject {
    static let shared = PosAuthStore()

    @Published private(set) var device: PosDeviceCredential?
    @Published private(set) var pinSession: PosPinSession?

    private let deviceKey = "gwada_pos_device_credential"
    private let sessionKey = "gwada_pos_pin_session"
    private let installationKey = "gwada_pos_installation_id"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        load()
    }

    var isPaired: Bool { device != nil }
    var isSignedIn: Bool { pinSession != nil }
    var restaurantId: String? { device?.restaurantId }

    func installationId() -> String {
        if let existing = UserDefaults.standard.string(forKey: installationKey),
           existing.count >= 8 {
            return existing
        }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: installationKey)
        return id
    }

    func load() {
        if let data = UserDefaults.standard.data(forKey: deviceKey),
           let saved = try? decoder.decode(PosDeviceCredential.self, from: data) {
            device = saved
        } else {
            device = nil
        }
        if let data = UserDefaults.standard.data(forKey: sessionKey),
           let saved = try? decoder.decode(PosPinSession.self, from: data) {
            pinSession = saved
        } else {
            pinSession = nil
        }
    }

    func saveDevice(_ credential: PosDeviceCredential) {
        device = credential
        if let data = try? encoder.encode(credential) {
            UserDefaults.standard.set(data, forKey: deviceKey)
        }
        PosCloudConfig.setRestaurantId(credential.restaurantId)
    }

    func clearDevice() {
        device = nil
        pinSession = nil
        UserDefaults.standard.removeObject(forKey: deviceKey)
        UserDefaults.standard.removeObject(forKey: sessionKey)
    }

    func savePinSession(_ session: PosPinSession) {
        pinSession = session
        if let data = try? encoder.encode(session) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        }
    }

    func clearPinSession() {
        pinSession = nil
        UserDefaults.standard.removeObject(forKey: sessionKey)
    }

    func deviceHeaderValue() throws -> String {
        guard let device else { throw PosCloudError.unauthorized }
        return "\(device.deviceId).\(device.deviceToken)"
    }

    func sessionHeaderValue() throws -> String {
        guard let pinSession else { throw PosCloudError.unauthorized }
        return "\(pinSession.sessionId).\(pinSession.sessionToken)"
    }

    /// Früher: JWT — bleibt für Kompatibilität mit Sync-Checks als „angemeldet“.
    func validAccessToken() async throws -> String {
        // Kein JWT mehr; Cloud-Client nutzt Header. Wir werfen nur, wenn keine PIN-Session.
        guard isSignedIn else { throw PosCloudError.unauthorized }
        return try sessionHeaderValue()
    }

    func pair(code: String) async throws {
        struct Body: Encodable {
            var code: String
            var installation_id: String
        }
        struct Response: Decodable {
            var ok: Bool?
            var device_id: String
            var device_token: String
            var installation_id: String
            var auto_lock_seconds: Int
            var device_name: String?
            var restaurant: Restaurant
            struct Restaurant: Decodable {
                var id: String
                var name: String?
            }
        }

        let response: Response = try await PosCloudClient.unauthenticatedPost(
            "/api/pos/pair",
            body: Body(
                code: code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                installation_id: installationId()
            )
        )

        saveDevice(PosDeviceCredential(
            deviceId: response.device_id,
            deviceToken: response.device_token,
            installationId: response.installation_id,
            restaurantId: response.restaurant.id,
            restaurantName: response.restaurant.name,
            deviceName: response.device_name,
            autoLockSeconds: response.auto_lock_seconds
        ))
        clearPinSession()
    }

    func restoreDeviceIfNeeded() async {
        guard let device else { return }
        struct Body: Encodable {
            var device_id: String
            var installation_id: String
            var device_token: String
        }
        struct Response: Decodable {
            var ok: Bool?
            var device_id: String
            var device_token: String
            var installation_id: String
            var auto_lock_seconds: Int
            var device_name: String?
            var restaurant: Restaurant
            struct Restaurant: Decodable {
                var id: String
                var name: String?
            }
        }
        do {
            let response: Response = try await PosCloudClient.unauthenticatedPost(
                "/api/pos/device/restore",
                body: Body(
                    device_id: device.deviceId,
                    installation_id: device.installationId,
                    device_token: device.deviceToken
                )
            )
            saveDevice(PosDeviceCredential(
                deviceId: response.device_id,
                deviceToken: response.device_token,
                installationId: response.installation_id,
                restaurantId: response.restaurant.id,
                restaurantName: response.restaurant.name,
                deviceName: response.device_name,
                autoLockSeconds: response.auto_lock_seconds
            ))
        } catch {
            // Offline: lokale Kopplung behalten
        }
    }

    func signInWithPin(_ pin: String) async throws {
        struct Body: Encodable { var pin: String }
        struct Response: Decodable {
            var ok: Bool?
            var session_id: String
            var session_token: String
            var staff: Staff
            var permissions: [String]?
            struct Staff: Decodable {
                var id: String
                var name: String?
                var profile_id: String?
            }
        }

        let response: Response = try await PosCloudClient.deviceAuthenticatedPost(
            "/api/pos/pin",
            body: Body(pin: pin.trimmingCharacters(in: .whitespacesAndNewlines))
        )

        savePinSession(PosPinSession(
            sessionId: response.session_id,
            sessionToken: response.session_token,
            staffId: response.staff.id,
            staffName: response.staff.name ?? "",
            profileId: response.staff.profile_id,
            permissionKeys: response.permissions ?? []
        ))
    }

    func signOutPin() async {
        if pinSession != nil {
            try? await PosCloudClient.deviceAuthenticatedDelete("/api/pos/pin")
        }
        clearPinSession()
    }

    func heartbeat() async {
        guard isSignedIn else { return }
        try? await PosCloudClient.deviceAuthenticatedPatch("/api/pos/pin")
    }

    func unpairDevice() async {
        await signOutPin()
        clearDevice()
    }
}
