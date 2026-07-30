import XCTest
@testable import GwadaPOS

final class PosFireCourseStateTests: XCTestCase {
    func testTracksFiredCoursesPerSession() {
        var store = PosFiredCourseStore()

        store.mark(sessionId: "session-1", course: 1)

        XCTAssertTrue(store.hasAny(sessionId: "session-1"))
        XCTAssertTrue(store.has(sessionId: "session-1", course: 1))
        XCTAssertFalse(store.has(sessionId: "session-1", course: 2))
        XCTAssertFalse(store.hasAny(sessionId: "session-2"))
    }

    func testClearRemovesAllFiredCoursesForSession() {
        var store = PosFiredCourseStore()
        store.mark(sessionId: "session-1", course: 1)
        store.mark(sessionId: "session-1", course: 2)

        store.clear(sessionId: "session-1")

        XCTAssertFalse(store.hasAny(sessionId: "session-1"))
        XCTAssertFalse(store.has(sessionId: "session-1", course: 1))
        XCTAssertFalse(store.has(sessionId: "session-1", course: 2))
    }
}
