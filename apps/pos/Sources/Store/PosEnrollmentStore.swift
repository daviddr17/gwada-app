import Foundation

/// Persistenter Enrollment-Stand (Hub/Handgerät) — Wizard vs. Normalbetrieb.
@MainActor
final class PosEnrollmentStore: ObservableObject {
    static let shared = PosEnrollmentStore()

    private let hubConfiguredKey = "gwada_pos_hub_enrolled"
    private let handheldPairedKey = "gwada_pos_handheld_paired"
    private let restaurantNameKey = "gwada_pos_enrolled_restaurant_name"

    @Published private(set) var isHubEnrolled: Bool
    @Published private(set) var isHandheldPaired: Bool
    @Published private(set) var restaurantDisplayName: String

    private init() {
        isHubEnrolled = UserDefaults.standard.bool(forKey: hubConfiguredKey)
        isHandheldPaired = UserDefaults.standard.bool(forKey: handheldPairedKey)
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

    func resetHubEnrollment() {
        isHubEnrolled = false
        restaurantDisplayName = ""
        UserDefaults.standard.removeObject(forKey: hubConfiguredKey)
        UserDefaults.standard.removeObject(forKey: restaurantNameKey)
    }

    func resetHandheldPairing() {
        isHandheldPaired = false
        UserDefaults.standard.removeObject(forKey: handheldPairedKey)
    }
}
