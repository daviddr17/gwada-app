import XCTest

/// Smoke: Solo → Reservierungen → scrollbare Tagesleiste + Demo-Resa sichtbar.
final class ReservationsDateStripUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testDateStripScrollAndDemoReservations() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        let tables = app.tabBars.buttons["Tische"]
        if !tables.waitForExistence(timeout: 4) {
            let solo = app.buttons["DEBUG: Solo ohne Code"]
            XCTAssertTrue(solo.waitForExistence(timeout: 12))
            solo.tap()
            XCTAssertTrue(tables.waitForExistence(timeout: 15))
        }

        let resaTab = app.tabBars.buttons["Reservierungen"]
        XCTAssertTrue(resaTab.waitForExistence(timeout: 8))
        resaTab.tap()

        let strip = app.descendants(matching: .any)["pos.reservations.dateStrip"]
        XCTAssertTrue(strip.waitForExistence(timeout: 10), "Tagesleiste erwartet")

        // Demo heute: Anna Müller
        let anna = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Anna")).firstMatch
        XCTAssertTrue(
            anna.waitForExistence(timeout: 8)
                || app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Müller")).firstMatch
                .waitForExistence(timeout: 3),
            "Demo-Reservierung Anna Müller heute"
        )

        // In die Zukunft scrollen (Leiste ist horizontal scrollbar)
        strip.swipeLeft()
        strip.swipeLeft()
        XCTAssertTrue(strip.exists)

        XCTAssertTrue(app.navigationBars["Reservierungen"].waitForExistence(timeout: 3))
    }
}
