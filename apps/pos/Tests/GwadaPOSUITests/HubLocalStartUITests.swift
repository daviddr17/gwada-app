import XCTest

/// iPad: Onboarding → DEBUG lokal → Hub lauscht; iPhone kann danach koppeln.
final class HubLocalStartUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testDebugLocalHubStartsWithoutCloud() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting"]
        app.launch()

        // PIN-Lock erscheint nur wenn PIN gesetzt — sonst direkt Wizard/Hub
        let debug = app.buttons["DEBUG: Lokal ohne Cloud starten"]
        if debug.waitForExistence(timeout: 8) {
            debug.tap()
        } else {
            // Bereits enrolled: Sidebar erwarten
            let tables = app.buttons["Tische"]
            XCTAssertTrue(
                tables.waitForExistence(timeout: 8) || app.staticTexts["Tische"].waitForExistence(timeout: 2),
                "Erwarte Hub-UI oder Onboarding-Debug"
            )
            return
        }

        // Nach completeHubOnboarding: Hub-UI (Sidebar „Tische“)
        let tablesNav = app.buttons["Tische"]
        let tablesStatic = app.staticTexts["Tische"]
        XCTAssertTrue(
            tablesNav.waitForExistence(timeout: 12) || tablesStatic.waitForExistence(timeout: 2),
            "Nach lokalem Hub-Start sollte die Kassen-UI sichtbar sein"
        )
    }
}
