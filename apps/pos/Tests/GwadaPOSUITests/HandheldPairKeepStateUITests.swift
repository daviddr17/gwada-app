import XCTest

/// Pairing ohne Store-Wipe — für manuellen/CI-Smoke gegen laufenden Hub.
final class HandheldPairKeepStateUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testPairToLocalHubKeepState() throws {
        let app = XCUIApplication()
        app.launch()

        // Bereits in Kellner-Tabs?
        if app.tabBars.buttons["Tische"].waitForExistence(timeout: 3) {
            return
        }

        let openLan = app.buttons["Stattdessen mit iPad-Kasse koppeln"]
        if openLan.waitForExistence(timeout: 4) {
            openLan.tap()
        }

        let host = app.textFields.firstMatch
        if host.waitForExistence(timeout: 8) {
            host.tap()
            if let value = host.value as? String, !value.isEmpty {
                let delete = String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count)
                host.typeText(delete)
            }
            host.typeText("127.0.0.1:8787")
        }

        let pair = app.buttons["Koppeln"]
        XCTAssertTrue(pair.waitForExistence(timeout: 8), "Koppeln-Button erwartet")
        pair.tap()

        let waiting = app.staticTexts["Warte auf Freigabe am iPad"]
        XCTAssertTrue(waiting.waitForExistence(timeout: 15), "Sollte auf Freigabe warten")
    }
}
