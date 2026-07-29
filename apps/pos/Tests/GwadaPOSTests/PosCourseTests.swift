import XCTest
@testable import GwadaPOS

final class PosCourseTests: XCTestCase {
    func testParseLegacy() {
        XCTAssertEqual(PosCourse.parse("starter"), 1)
        XCTAssertEqual(PosCourse.parse("main"), 2)
        XCTAssertEqual(PosCourse.parse("side"), 2)
        XCTAssertEqual(PosCourse.parse("3"), 3)
        XCTAssertEqual(PosCourse.parse(nil), 2)
    }

    func testLabels() {
        XCTAssertEqual(PosCourse.label(1), "Vorspeise")
        XCTAssertEqual(PosCourse.label(4), "Gang 4")
    }
}
