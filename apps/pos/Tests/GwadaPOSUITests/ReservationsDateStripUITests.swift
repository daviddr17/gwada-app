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

        let header = app.descendants(matching: .any)["pos.reservations.dateHeader"]
        XCTAssertTrue(header.waitForExistence(timeout: 5), "Datum/KW-Header")
        XCTAssertTrue(
            header.label.contains("KW") || app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "KW")).firstMatch.exists,
            "KW im Header sichtbar"
        )

        // Heutiger Chip muss nach Scroll sichtbar/selektiert sein (nicht Leisten-Anfang heute−30).
        let cal = Calendar.current
        let y = cal.component(.year, from: Date())
        let m = cal.component(.month, from: Date())
        let d = cal.component(.day, from: Date())
        let todayId = String(format: "pos.reservations.day.%04d-%02d-%02d", y, m, d)
        let todayChip = app.descendants(matching: .any)[todayId]
        XCTAssertTrue(todayChip.waitForExistence(timeout: 8), "Heutiger Tag-Chip nach Auto-Scroll")

        header.tap()
        let datePicker = app.descendants(matching: .any)["pos.reservations.datePicker"]
        XCTAssertTrue(
            datePicker.waitForExistence(timeout: 5)
                || app.navigationBars["Datum wählen"].waitForExistence(timeout: 3),
            "Datum-Picker-Sheet"
        )
        if app.buttons["Fertig"].waitForExistence(timeout: 2) {
            app.buttons["Fertig"].tap()
        } else if app.buttons["Schließen"].waitForExistence(timeout: 2) {
            app.buttons["Schließen"].tap()
        } else {
            app.swipeDown()
        }

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
