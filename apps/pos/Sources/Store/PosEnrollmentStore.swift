import Foundation

/// Persistenter Enrollment-Stand (Hub/Handgerät) — Wizard vs. Normalbetrieb.
@MainActor
final class PosEnrollmentStore: ObservableObject {
    static let shared = PosEnrollmentStore()

    private let hubConfiguredKey = "gwada_pos_hub_enrolled"
    private let handheldPairedKey = "gwada_pos_handheld_paired"
    private let handheldTokenKey = "gwada_pos_handheld_token"
    private let handheldHubURLKey = "gwada_pos_handheld_hub_url"
    private let restaurantNameKey = "gwada_pos_enrolled_restaurant_name"

    @Published private(set) var isHubEnrolled: Bool
    @Published private(set) var isHandheldPaired: Bool
    @Published private(set) var handheldPairToken: String?
    @Published private(set) var handheldHubBaseURL: String?
    @Published private(set) var restaurantDisplayName: String

    private init() {
        isHubEnrolled = UserDefaults.standard.bool(forKey: hubConfiguredKey)
        isHandheldPaired = UserDefaults.standard.bool(forKey: handheldPairedKey)
        handheldPairToken = UserDefaults.standard.string(forKey: handheldTokenKey)
        handheldHubBaseURL = UserDefaults.standard.string(forKey: handheldHubURLKey)
        restaurantDisplayName = UserDefaults.standard.string(forKey: restaurantNameKey) ?? ""
    }

    func markHubEnrolled(restaurantName: String) {
        isHubEnrolled = true
        restaurantDisplayName = restaurantName
        UserDefaults.standard.set(true, forKey: hubConfiguredKey)
        UserDefaults.standard.set(restaurantName, forKey: restaurantNameKey)
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
}
