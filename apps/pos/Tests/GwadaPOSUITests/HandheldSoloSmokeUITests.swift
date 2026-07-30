import XCTest

/// Smoke: iPhone Pairing-Gate → DEBUG Solo → Kellner-Tabs sichtbar.
final class HandheldSoloSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testSoloModeReachesTablesTab() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting"]
        app.launch()

        let solo = app.buttons["DEBUG: Solo ohne Kasse"]
        XCTAssertTrue(
            solo.waitForExistence(timeout: 12),
            "Pairing-Gate mit Solo-Debug sollte auf iPhone erscheinen"
        )
        solo.tap()

        let tables = app.tabBars.buttons["Tische"]
        XCTAssertTrue(
            tables.waitForExistence(timeout: 12),
            "Nach Solo sollte der Tab „Tische“ sichtbar sein"
        )
        XCTAssertTrue(tables.isSelected || tables.exists)

        // Phase-1 Sanity: Menü/Tisch-UI läuft ohne Crash weiter
        tables.tap()
        XCTAssertTrue(app.tabBars.buttons["Reservierungen"].exists)
        XCTAssertTrue(app.tabBars.buttons["Mehr"].exists)
    }
}
