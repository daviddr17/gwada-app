import XCTest
@testable import GwadaPOS

final class BonSheetActionStateTests: XCTestCase {
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
