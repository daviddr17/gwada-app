import Foundation

/// Persistenter Enrollment-Stand (Hub/Handgerät) — Wizard vs. Normalbetrieb.
@MainActor
final class PosEnrollmentStore: ObservableObject {
    static let shared = PosEnrollmentStore()

    private let hubConfiguredKey = "gwada_pos_hub_enrolled"
    private let handheldPairedKey = "gwada_pos_handheld_paired"
    private let handheldCloudReadyKey = "gwada_pos_handheld_cloud_ready"
    private let handheldTokenKey = "gwada_pos_handheld_token"
    private let handheldHubURLKey = "gwada_pos_handheld_hub_url"
    private let restaurantNameKey = "gwada_pos_enrolled_restaurant_name"

    @Published private(set) var isHubEnrolled: Bool
    /// LAN-Kopplung mit iPad-Kasse (Token bis Revoke).
    @Published private(set) var isHandheldPaired: Bool
    /// Cloud-Einrichtung (VPS) — iPhone kann ohne iPad arbeiten.
    @Published private(set) var isHandheldCloudReady: Bool
    @Published private(set) var handheldPairToken: String?
    @Published private(set) var handheldHubBaseURL: String?
    @Published private(set) var restaurantDisplayName: String

    /// Onboarding fertig: Cloud ODER LAN-Kasse (Flag, nicht nur Keychain-Credential).
    var isHandheldReady: Bool {
        isHandheldCloudReady || isHandheldPaired
    }

    private init() {
        if ProcessInfo.processInfo.arguments.contains("-UITestingResetEnrollment") {
            UserDefaults.standard.removeObject(forKey: hubConfiguredKey)
            UserDefaults.standard.removeObject(forKey: handheldPairedKey)
            UserDefaults.standard.removeObject(forKey: handheldCloudReadyKey)
            UserDefaults.standard.removeObject(forKey: handheldTokenKey)
            UserDefaults.standard.removeObject(forKey: handheldHubURLKey)
            UserDefaults.standard.removeObject(forKey: restaurantNameKey)
            PosEnrollmentCredential.clear()
        }
        isHubEnrolled = UserDefaults.standard.bool(forKey: hubConfiguredKey)
        isHandheldPaired = UserDefaults.standard.bool(forKey: handheldPairedKey)
        handheldPairToken = UserDefaults.standard.string(forKey: handheldTokenKey)
        handheldHubBaseURL = UserDefaults.standard.string(forKey: handheldHubURLKey)
        restaurantDisplayName = UserDefaults.standard.string(forKey: restaurantNameKey) ?? ""
        var cloudReady = UserDefaults.standard.bool(forKey: handheldCloudReadyKey)
        // Resume: Credential da, Flag fehlte (Crash mitten im Wizard) → als bereit werten.
        if !cloudReady, PosEnrollmentCredential.hasCredential {
            cloudReady = true
            UserDefaults.standard.set(true, forKey: handheldCloudReadyKey)
        }
        isHandheldCloudReady = cloudReady
    }

    func markHubEnrolled(restaurantName: String) {
        isHubEnrolled = true
        restaurantDisplayName = restaurantName
        UserDefaults.standard.set(true, forKey: hubConfiguredKey)
        UserDefaults.standard.set(restaurantName, forKey: restaurantNameKey)
    }

    func markHandheldCloudReady(restaurantName: String) {
        isHandheldCloudReady = true
        restaurantDisplayName = restaurantName
        UserDefaults.standard.set(true, forKey: handheldCloudReadyKey)
        UserDefaults.standard.set(restaurantName, forKey: restaurantNameKey)
    }

    func setRestaurantDisplayName(_ name: String) {
        restaurantDisplayName = name
        UserDefaults.standard.set(name, forKey: restaurantNameKey)
    }

    func markHandheldPaired() {
        isHandheldPaired = true
        UserDefaults.standard.set(true, forKey: handheldPairedKey)
    }

    func markHandheldPaired(token: String, hubBaseURL: String) {
        isHandheldPaired = true
        handheldPairToken = token
        handheldHubBaseURL = hubBaseURL
        UserDefaults.standard.set(true, forKey: handheldPairedKey)
        UserDefaults.standard.set(token, forKey: handheldTokenKey)
        UserDefaults.standard.set(hubBaseURL, forKey: handheldHubURLKey)
    }

    func resetHubEnrollment() {
        isHubEnrolled = false
        restaurantDisplayName = ""
        UserDefaults.standard.removeObject(forKey: hubConfiguredKey)
        UserDefaults.standard.removeObject(forKey: restaurantNameKey)
    }

    func resetHandheldPairing() {
        isHandheldPaired = false
        handheldPairToken = nil
        handheldHubBaseURL = nil
        UserDefaults.standard.removeObject(forKey: handheldPairedKey)
        UserDefaults.standard.removeObject(forKey: handheldTokenKey)
        UserDefaults.standard.removeObject(forKey: handheldHubURLKey)
    }

    func resetHandheldCloud() {
        isHandheldCloudReady = false
        UserDefaults.standard.removeObject(forKey: handheldCloudReadyKey)
        if !isHubEnrolled {
            restaurantDisplayName = ""
            UserDefaults.standard.removeObject(forKey: restaurantNameKey)
        }
    }

    /// Nur für UITests (`-UITestingResetEnrollment`) — frischer Onboarding-Stand.
    func resetAllHandheldForUITesting() {
        resetHandheldPairing()
        resetHandheldCloud()
        PosEnrollmentCredential.clear()
    }
}
