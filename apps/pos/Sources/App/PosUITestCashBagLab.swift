import Foundation

#if DEBUG
/// Solo UITest seed: Roster + Offline-PIN-Session, damit Issue→Close ohne Cloud geht.
enum PosUITestCashBagLab {
    static let restaurantId = DemoSnapshotFactory.restaurantId
    static let waiterAId = "uitest-waiter-anna"
    static let waiterBId = "uitest-waiter-ben"
    static let pinA = "1111"
    static let pinB = "2222"

    @MainActor
    static func seedIfNeeded() {
        guard ProcessInfo.processInfo.arguments.contains("-UITestingResetEnrollment") else { return }

        PosHubState.shared.clearLocalCashBagsForUITesting()

        let staff: [PosAuthRosterStaff] = [
            PosAuthRosterStaff(
                id: waiterAId,
                given_name: "Anna",
                family_name: "Test",
                profile_id: waiterAId,
                position_name: "Service",
                offline_pin_hash: PosOfflinePin.hash(pin: pinA, restaurantId: restaurantId),
                permissions: [
                    "pos.kasse.use",
                    "pos.kasse.manage",
                    "cash_bag.issue",
                    "receipts",
                    "device",
                ]
            ),
            PosAuthRosterStaff(
                id: waiterBId,
                given_name: "Ben",
                family_name: "Test",
                profile_id: waiterBId,
                position_name: "Service",
                offline_pin_hash: PosOfflinePin.hash(pin: pinB, restaurantId: restaurantId),
                permissions: ["pos.kasse.use"]
            ),
        ]
        PosAuthRosterStore.shared.applyApiRoster(
            restaurantId: restaurantId,
            fetchedAt: ISO8601DateFormatter().string(from: Date()),
            staff: staff
        )
        PosAuthStore.shared.savePinSession(
            PosPinSession(
                sessionId: "uitest-offline-\(waiterAId)",
                sessionToken: "uitest",
                staffId: waiterAId,
                staffName: "Anna Test",
                profileId: waiterAId,
                permissionKeys: staff[0].permissions,
                isOffline: true,
                offlinePinProof: PosOfflinePin.hash(pin: pinA, restaurantId: restaurantId)
            )
        )
    }
}
#endif
