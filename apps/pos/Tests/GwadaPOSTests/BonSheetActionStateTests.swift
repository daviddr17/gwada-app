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

    func testRejectsSendReentryUntilCurrentSendFinishes() {
        var state = BonSheetActionState()

        XCTAssertTrue(state.beginSending())
        XCTAssertFalse(state.beginSending())

        state.finishSending()
        XCTAssertTrue(state.beginSending())
    }

    func testRejectsFireReentryForSameCourseUntilCurrentFireFinishes() {
        var state = BonSheetActionState()

        XCTAssertTrue(state.beginFiring(course: 2))
        XCTAssertFalse(state.beginFiring(course: 2))
        XCTAssertTrue(state.beginFiring(course: 3))

        state.finishFiring(course: 2)
        XCTAssertTrue(state.beginFiring(course: 2))
    }
}
