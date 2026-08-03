import XCTest
@testable import GwadaPOS

@MainActor
final class PosHubPhase4OpsGatesTests: XCTestCase {
    func test_hubOpsErrorMessage_mapsUnreachable() {
        let url = URL(string: "http://127.0.0.1:8787")!
        let msg = PosRuntime.hubOpsErrorMessage(HandheldHubClientError.unreachable(url))
        XCTAssertTrue(msg.contains("nicht erreichbar") || msg.contains("WLAN"))
    }

    func test_hubOpsErrorMessage_mapsHubRejected() {
        let msg = PosRuntime.hubOpsErrorMessage(
            HandheldHubClientError.hubRejected(status: 409, message: "session_gone")
        )
        XCTAssertEqual(msg, "session_gone")
    }

    func test_hubOpsErrorMessage_mapsTimeout() {
        let err = NSError(domain: NSURLErrorDomain, code: NSURLErrorTimedOut)
        let msg = PosRuntime.hubOpsErrorMessage(err)
        XCTAssertTrue(msg.lowercased().contains("zeit") || msg.lowercased().contains("timeout"))
    }

    func test_collectAndWriteGates_aliasOpenSessionGate() {
        let runtime = PosRuntime()
        XCTAssertEqual(runtime.canCollectAtRegister, runtime.canOpenNewTableSession)
        XCTAssertEqual(runtime.canWriteReservations, runtime.canOpenNewTableSession)
    }
}
