import XCTest
@testable import GwadaPOS

final class PosSessionAmberTests: XCTestCase {
    func testAgeMinutesFromOpenedAt() {
        let now = Date()
        let opened = ISO8601DateFormatter().string(from: now.addingTimeInterval(-44 * 60))
        XCTAssertEqual(PosDesign.sessionAgeMinutes(openedAt: opened, now: now), 44)
        let opened45 = ISO8601DateFormatter().string(from: now.addingTimeInterval(-45 * 60))
        XCTAssertEqual(PosDesign.sessionAgeMinutes(openedAt: opened45, now: now), 45)
    }

    func testTableStatusColorAmberOnlyWhenOpenAndOldEnough() {
        XCTAssertEqual(
            PosDesign.tableStatusChromeTone(isOpen: true, openCents: 100, ageMinutes: 44),
            .occupied
        )
        XCTAssertEqual(
            PosDesign.tableStatusChromeTone(isOpen: true, openCents: 100, ageMinutes: 45),
            .amber
        )
        XCTAssertEqual(
            PosDesign.tableStatusChromeTone(isOpen: false, openCents: 0, ageMinutes: 120),
            .free
        )
    }

    func testTimerAmberFlag() {
        XCTAssertFalse(PosDesign.sessionTimerIsAmber(ageMinutes: 44))
        XCTAssertTrue(PosDesign.sessionTimerIsAmber(ageMinutes: 45))
        XCTAssertFalse(PosDesign.sessionTimerIsAmber(ageMinutes: nil))
    }
}
