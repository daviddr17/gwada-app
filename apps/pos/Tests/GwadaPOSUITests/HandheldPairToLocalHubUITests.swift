import XCTest

/// iPhone → Hub unter 127.0.0.1:8787 — wartet auf Freigabe am iPad.
final class HandheldPairToLocalHubUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testStartPairingAgainstLocalHub() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting"]
        app.launch()

        let openLan = app.buttons["Stattdessen mit iPad-Kasse koppeln"]
        XCTAssertTrue(openLan.waitForExistence(timeout: 12), "Onboarding erwartet")
        openLan.tap()

        let pair = app.buttons["Koppeln"]
        XCTAssertTrue(pair.waitForExistence(timeout: 8), "Pairing-Sheet erwartet")
        pair.tap()

        let waitTitle = app.staticTexts["Warte auf Freigabe am iPad"]
        XCTAssertTrue(
            waitTitle.waitForExistence(timeout: 15),
            "Nach Koppeln sollte der Warte-Screen mit Code erscheinen (Hub muss auf :8787 laufen)"
        )
    }
}
