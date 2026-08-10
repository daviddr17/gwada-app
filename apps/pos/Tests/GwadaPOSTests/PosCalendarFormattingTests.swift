import XCTest
@testable import GwadaPOS

final class PosCalendarFormattingTests: XCTestCase {
    func testWeekdayShort_tuesday11Aug2026_isDi() throws {
        var comps = DateComponents()
        comps.year = 2026
        comps.month = 8
        comps.day = 11
        let date = try XCTUnwrap(PosCalendarFormatting.germanGregorian.date(from: comps))
        XCTAssertEqual(PosCalendarFormatting.weekdayShort(date), "Di.")
        XCTAssertEqual(PosCalendarFormatting.dayNumber(date), "11")
    }

    func testHeaderIncludesIsoWeek() throws {
        var comps = DateComponents()
        comps.year = 2026
        comps.month = 8
        comps.day = 11
        let date = try XCTUnwrap(PosCalendarFormatting.germanGregorian.date(from: comps))
        let label = PosCalendarFormatting.headerLabel(date)
        XCTAssertTrue(label.contains("2026"), label)
        XCTAssertTrue(label.contains("KW"), label)
        XCTAssertEqual(PosCalendarFormatting.isoWeekOfYear(date), 33)
    }

    func testMondayOfIsoWeek_jumpsToMonday() throws {
        let monday = try XCTUnwrap(PosCalendarFormatting.mondayOfIsoWeek(week: 33, yearForWeek: 2026))
        XCTAssertEqual(PosCalendarFormatting.weekdayShort(monday), "Mo.")
        XCTAssertEqual(PosCalendarFormatting.isoWeekOfYear(monday), 33)
        XCTAssertEqual(PosCalendarFormatting.dayNumber(monday), "10")
    }
}
