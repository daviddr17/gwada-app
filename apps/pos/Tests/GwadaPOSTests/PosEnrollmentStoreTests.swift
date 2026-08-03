import XCTest
@testable import GwadaPOS

@MainActor
final class PosEnrollmentStoreTests: XCTestCase {
    override func setUp() {
        super.setUp()
        PosEnrollmentStore.shared.resetHandheldPairing()
        PosEnrollmentStore.shared.resetHandheldCloud()
    }

    func test_markPaired_persistsTokenAndHost() {
        let store = PosEnrollmentStore.shared
        store.markHandheldPaired(token: "tok_xyz", hubBaseURL: "http://127.0.0.1:8787")
        XCTAssertTrue(store.isHandheldPaired)
        XCTAssertTrue(store.isHandheldReady)
        XCTAssertEqual(store.handheldPairToken, "tok_xyz")
        XCTAssertEqual(store.handheldHubBaseURL, "http://127.0.0.1:8787")
    }

    func test_reset_clearsTokenAndHost() {
        let store = PosEnrollmentStore.shared
        store.markHandheldPaired(token: "tok_xyz", hubBaseURL: "http://127.0.0.1:8787")
        store.resetHandheldPairing()
        XCTAssertFalse(store.isHandheldPaired)
        XCTAssertNil(store.handheldPairToken)
        XCTAssertNil(store.handheldHubBaseURL)
    }

    func test_cloudReady_makesHandheldReadyWithoutLan() {
        let store = PosEnrollmentStore.shared
        store.markHandheldCloudReady(restaurantName: "Testaurant")
        XCTAssertTrue(store.isHandheldCloudReady)
        XCTAssertTrue(store.isHandheldReady)
        XCTAssertFalse(store.isHandheldPaired)
        XCTAssertFalse(store.isHandheldServiceReady)
        XCTAssertEqual(store.restaurantDisplayName, "Testaurant")
    }

    func test_serviceReady_requiresPairing() {
        let store = PosEnrollmentStore.shared
        store.markHandheldCloudReady(restaurantName: "Testaurant")
        XCTAssertFalse(store.isHandheldServiceReady)
        store.markHandheldPaired(token: "tok", hubBaseURL: "http://127.0.0.1:8787")
        XCTAssertTrue(store.isHandheldServiceReady)
    }
}
