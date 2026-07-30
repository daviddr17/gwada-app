import XCTest

/// iPad: offene Pairing-Anfrage freigeben (Person-Plus → Freigeben).
final class HubApprovePairingUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testApprovePendingHandheld() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting"]
        app.launch()

        // Sidebar / Hub muss schon laufen (enrolled)
        let handsets = app.buttons["Handgeräte verbinden"]
        XCTAssertTrue(
            handsets.waitForExistence(timeout: 12),
            "Erwarte Hub-UI mit Handgeräte-Button"
        )
        handsets.tap()

        let freigeben = app.buttons["Freigeben"].firstMatch
        XCTAssertTrue(
            freigeben.waitForExistence(timeout: 15),
            "Pending Pairing sollte „Freigeben“ zeigen — zuerst am iPhone „Koppeln“ tippen"
        )
        freigeben.tap()
    }
}
