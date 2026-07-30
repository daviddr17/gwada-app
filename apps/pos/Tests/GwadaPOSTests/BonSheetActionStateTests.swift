import XCTest
@testable import GwadaPOS

final class BonSheetActionStateTests: XCTestCase {
    func testCourseNeedsFireCombinesRemoteAndLocalFiredState() {
        let sessionId = "bon-fire-eligibility-\(UUID().uuidString)"
        defer { PosHubState.shared.clearFired(sessionId: sessionId) }
        let unfiredLine = SessionOpenLine(
            id: "line-1",
            orderLineId: "order-line-1",
            name: "Suppe",
            openQuantity: 1,
            openCents: 800,
            course: 1,
            firedAt: nil,
            detail: ""
        )
        var firedLine = unfiredLine
        firedLine.firedAt = Date()

        XCTAssertTrue(courseNeedsFire(openLines: [unfiredLine], course: 1, sessionId: sessionId))
        XCTAssertFalse(courseNeedsFire(openLines: [firedLine], course: 1, sessionId: sessionId))
        XCTAssertFalse(courseNeedsFire(openLines: [unfiredLine, firedLine], course: 1, sessionId: sessionId))

        PosHubState.shared.markFired(sessionId: sessionId, course: 1)

        XCTAssertFalse(courseNeedsFire(openLines: [unfiredLine], course: 1, sessionId: sessionId))
    }

    func testCourseNeedsSchickenWhenCartHasCourse() {
        let line = PosCartLine(
            menuItemId: "m1",
            name: "Brot",
            unitPriceCents: 300,
            quantity: 1,
            course: 2,
            notes: "",
            modifiers: []
        )
        XCTAssertTrue(courseNeedsSchicken(cart: [line], course: 2))
        XCTAssertFalse(courseNeedsSchicken(cart: [line], course: 1))
        XCTAssertFalse(courseNeedsSchicken(cart: [], course: 2))
    }

    func testRejectsSchickenReentryForSameCourse() {
        var state = BonSheetActionState()

        XCTAssertTrue(state.beginSchicken(course: 2))
        XCTAssertFalse(state.beginSchicken(course: 2))
        XCTAssertTrue(state.beginSchicken(course: 3))

        state.finishSchicken(course: 2)
        XCTAssertTrue(state.beginSchicken(course: 2))
    }
}
