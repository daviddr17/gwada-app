import XCTest
@testable import GwadaPOS

final class PosLocalOpenLinesTests: XCTestCase {
    func testAppendAndLoadLocalOpenLinesWithoutCloudSignIn() {
        let sessionId = "local-open-\(UUID().uuidString)"
        defer {
            PosHubState.shared.clearLocalOpenLines(sessionId: sessionId)
            PosHubState.shared.clearFired(sessionId: sessionId)
        }

        let cart = [
            PosCartLine(
                menuItemId: "item-a",
                name: "Schnitzel",
                unitPriceCents: 1850,
                quantity: 2,
                course: 2,
                notes: "",
                modifiers: []
            )
        ]
        PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: cart)
        let lines = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].name, "Schnitzel")
        XCTAssertEqual(lines[0].openQuantity, 2)
        XCTAssertEqual(lines[0].openCents, 3700)
        XCTAssertEqual(lines[0].menuItemId, "item-a")
        XCTAssertNil(lines[0].firedAt)

        PosHubState.shared.markLocalCourseFired(sessionId: sessionId, course: 2)
        let fired = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertNotNil(fired[0].firedAt)
    }
}
