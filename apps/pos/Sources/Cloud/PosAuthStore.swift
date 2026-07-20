import Foundation

struct PosDeviceCredential: Codable, Equatable, Sendable {
    var deviceId: String
    var deviceToken: String
    var installationId: String
    var restaurantId: String
    var restaurantName: String?
    var deviceName: String?
    var autoLockSeconds: Int
    /// Shared secret für Hub↔Handheld im WLAN.
    var lanSharedSecret: String?
}

struct PosPinSession: Codable, Equatable, Sendable {
    var sessionId: String
    var sessionToken: String
    var staffId: String
    var staffName: String
    var profileId: String?
    var permissionKeys: [String]
    /// Lokale Offline-Session (noch keine Cloud-Session).
    var isOffline: Bool
    /// SHA-256 Offline-Proof für Session-Resume (kein Klartext-PIN).
    var offlinePinProof: String?

    init(
        sessionId: String,
        sessionToken: String,
        staffId: String,
        staffName: String,
        profileId: String?,
        permissionKeys: [String],
        isOffline: Bool,
        offlinePinProof: String? = nil
    ) {
        self.sessionId = sessionId
        self.sessionToken = sessionToken
        self.staffId = staffId
        self.staffName = staffName
        self.profileId = profileId
        self.permissionKeys = permissionKeys
        self.isOffline = isOffline
        self.offlinePinProof = offlinePinProof
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sessionId = try c.decode(String.self, forKey: .sessionId)
        sessionToken = try c.decode(String.self, forKey: .sessionToken)
        staffId = try c.decode(String.self, forKey: .staffId)
        staffName = try c.decode(String.self, forKey: .staffName)
        profileId = try c.decodeIfPresent(String.self, forKey: .profileId)
        permissionKeys = try c.decodeIfPresent([String].self, forKey: .permissionKeys) ?? []
        isOffline = try c.decodeIfPresent(Bool.self, forKey: .isOffline) ?? false
        offlinePinProof = try c.decodeIfPresent(String.self, forKey: .offlinePinProof)
    }
}

private struct PosPinApiResponse: Decodable {
    var ok: Bool?
    var session_id: String
    var session_token: String
    var staff: Staff
    var permissions: [String]?
    var roster: Roster?
    struct Staff: Decodable {
        var id: String
        var name: String?
        var profile_id: String?
    }
    struct Roster: Decodable {
        var fetched_at: String
        var staff: [PosAuthRosterStaff]
    }
}

private struct PosRosterApiResponse: Decodable {
    var ok: Bool?
    var restaurant_id: String
    var fetched_at: String
    var staff: [PosAuthRosterStaff]
}

/// Geräte-Kopplung + Display-PIN-Session (online live, offline aus lokalem Roster).
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
    var isOfflineSession: Bool { pinSession?.isOffline == true }
    var restaurantId: String? { device?.restaurantId }
    var hasOfflineRoster: Bool { !(PosAuthRosterStore.shared.roster?.staff.isEmpty ?? true) }

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
        PosAuthRosterStore.shared.load()
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
        PosAuthRosterStore.shared.clear()
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
        guard let pinSession, !pinSession.isOffline else { throw PosCloudError.unauthorized }
        return "\(pinSession.sessionId).\(pinSession.sessionToken)"
    }

    func validAccessToken() async throws -> String {
        guard isSignedIn else { throw PosCloudError.unauthorized }
        if isOfflineSession {
            throw PosCloudError.offline
        }
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
            var lan_shared_secret: String?
            var restaurant: Restaurant
            var roster: PosPinApiResponse.Roster?
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
            autoLockSeconds: response.auto_lock_seconds,
            lanSharedSecret: response.lan_shared_secret
        ))
        clearPinSession()
        if let roster = response.roster {
            PosAuthRosterStore.shared.applyApiRoster(
                restaurantId: response.restaurant.id,
                fetchedAt: roster.fetched_at,
                staff: roster.staff
            )
        } else {
            try? await refreshAuthRoster()
        }
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
            var lan_shared_secret: String?
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
                autoLockSeconds: response.auto_lock_seconds,
                lanSharedSecret: response.lan_shared_secret ?? device.lanSharedSecret
            ))
            try? await refreshAuthRoster()
        } catch {
            // Offline: lokale Kopplung + Roster behalten
        }
    }

    var lanSharedSecret: String? { device?.lanSharedSecret }

    @discardableResult
    func refreshAuthRoster() async throws -> PosAuthRoster {
        let response: PosRosterApiResponse = try await PosCloudClient.deviceAuthenticatedGet(
            "/api/pos/auth-roster"
        )
        let roster = PosAuthRoster(
            restaurantId: response.restaurant_id,
            fetchedAt: response.fetched_at,
            staff: response.staff
        )
        PosAuthRosterStore.shared.save(roster)
        return roster
    }

    func signInWithPin(_ pin: String) async throws {
        let trimmed = pin.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count == 4, trimmed.allSatisfy(\.isNumber) else {
            throw PosCloudError.httpStatus(400, "invalid_request")
        }

        // Online zuerst (live Auth + Roster-Refresh)
        do {
            struct Body: Encodable { var pin: String }
            let response: PosPinApiResponse = try await PosCloudClient.deviceAuthenticatedPost(
                "/api/pos/pin",
                body: Body(pin: trimmed)
            )
            let proof = device.map {
                PosOfflinePin.hash(pin: trimmed, restaurantId: $0.restaurantId)
            }
            applyOnlinePinResponse(response, offlinePinProof: proof)
            return
        } catch PosCloudError.offline {
            // Fallback unten
        } catch let PosCloudError.httpStatus(code, _) where code == 0 || code >= 500 {
            // Server/Netz — Fallback
        } catch {
            // pin_invalid / forbidden_pos online nicht lokal überschreiben
            if error.localizedDescription.contains("pin_invalid")
                || error.localizedDescription.contains("forbidden_pos")
                || error.localizedDescription.contains("pin_locked") {
                throw error
            }
            // sonst Offline-Fallback versuchen
        }

        try signInWithPinOffline(trimmed)
    }

    private func signInWithPinOffline(_ pin: String) throws {
        guard let device else { throw PosCloudError.unauthorized }
        guard let roster = PosAuthRosterStore.shared.roster,
              roster.restaurantId == device.restaurantId else {
            throw PosCloudError.httpStatus(503, "roster_missing")
        }
        guard let staff = PosOfflinePin.resolveStaff(pin: pin, roster: roster) else {
            throw PosCloudError.httpStatus(401, "pin_invalid")
        }
        let canUse = staff.permissions.contains("pos.kasse.use")
            || staff.permissions.contains("pos.kasse.manage")
        guard canUse else {
            throw PosCloudError.httpStatus(403, "forbidden_pos")
        }

        let proof = PosOfflinePin.hash(pin: pin, restaurantId: device.restaurantId)
        savePinSession(PosPinSession(
            sessionId: "offline-\(UUID().uuidString)",
            sessionToken: "offline",
            staffId: staff.id,
            staffName: staff.displayName,
            profileId: staff.profile_id,
            permissionKeys: staff.permissions,
            isOffline: true,
            offlinePinProof: proof
        ))
    }

    private func applyOnlinePinResponse(_ response: PosPinApiResponse, offlinePinProof: String? = nil) {
        savePinSession(PosPinSession(
            sessionId: response.session_id,
            sessionToken: response.session_token,
            staffId: response.staff.id,
            staffName: response.staff.name ?? "",
            profileId: response.staff.profile_id,
            permissionKeys: response.permissions ?? [],
            isOffline: false,
            offlinePinProof: offlinePinProof
        ))
        if let roster = response.roster, let restaurantId = device?.restaurantId {
            PosAuthRosterStore.shared.applyApiRoster(
                restaurantId: restaurantId,
                fetchedAt: roster.fetched_at,
                staff: roster.staff
            )
        }
    }

    /// Offline-Session zu Cloud-Session upgraden, wenn wieder online.
    @discardableResult
    func resumeCloudSessionIfNeeded() async -> Bool {
        guard let session = pinSession, session.isOffline else { return false }
        guard let proof = session.offlinePinProof, proof.count == 64 else { return false }
        struct Body: Encodable {
            var staff_id: String
            var offline_pin_proof: String
        }
        do {
            let response: PosPinApiResponse = try await PosCloudClient.deviceAuthenticatedPost(
                "/api/pos/pin/resume",
                body: Body(staff_id: session.staffId, offline_pin_proof: proof)
            )
            applyOnlinePinResponse(response, offlinePinProof: proof)
            try? await refreshAuthRoster()
            return true
        } catch {
            return false
        }
    }

    func signOutPin() async {
        if let session = pinSession, !session.isOffline {
            try? await PosCloudClient.deviceAuthenticatedDelete("/api/pos/pin")
        }
        clearPinSession()
    }

    func heartbeat() async {
        guard isSignedIn, !isOfflineSession else { return }
        try? await PosCloudClient.deviceAuthenticatedPatch("/api/pos/pin")
    }

    func unpairDevice() async {
        await signOutPin()
        clearDevice()
    }
}
