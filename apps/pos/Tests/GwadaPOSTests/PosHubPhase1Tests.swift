import XCTest
@testable import GwadaPOS

@MainActor
final class PosHubPhase1Tests: XCTestCase {
    func test_allowsSoloMode_matchesDebugBuild() {
        #if DEBUG
        XCTAssertTrue(PosSecurityPolicy.allowsSoloMode)
        #else
        XCTAssertFalse(PosSecurityPolicy.allowsSoloMode)
        #endif
    }

    func test_serviceReady_equalsPaired() {
        let store = PosEnrollmentStore.shared
        store.resetHandheldPairing()
        XCTAssertEqual(store.isHandheldServiceReady, store.isHandheldPaired)
        store.markHandheldPaired(token: "phase1-tok", hubBaseURL: "http://127.0.0.1:8787")
        XCTAssertTrue(store.isHandheldServiceReady)
        store.resetHandheldPairing()
        XCTAssertFalse(store.isHandheldServiceReady)
    }
}
