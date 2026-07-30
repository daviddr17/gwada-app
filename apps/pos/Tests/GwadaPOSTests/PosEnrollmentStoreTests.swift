import XCTest
@testable import GwadaPOS

@MainActor
final class PosEnrollmentStoreTests: XCTestCase {
    override func setUp() {
        super.setUp()
        PosEnrollmentStore.shared.resetHandheldPairing()
    }

    func test_markPaired_persistsTokenAndHost() {
        let store = PosEnrollmentStore.shared
        store.markHandheldPaired(token: "tok_xyz", hubBaseURL: "http://127.0.0.1:8787")
        XCTAssertTrue(store.isHandheldPaired)
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
}
