import XCTest

/// Smoke: Tisch öffnen → Bon-Dock → Bon-Sheet.
final class Phase3BonSheetSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOpenTableShowsBonSheet() throws {
        let app = XCUIApplication()
        // Kein -UITesting: Pairing-/Enrollment-Store behalten.
        app.launch()

        let tablesTab = app.tabBars.buttons["Tische"]
        if tablesTab.waitForExistence(timeout: 8) {
            tablesTab.tap()
        } else {
            let solo = app.buttons["DEBUG: Solo ohne Kasse"]
            XCTAssertTrue(solo.waitForExistence(timeout: 12))
            solo.tap()
            XCTAssertTrue(tablesTab.waitForExistence(timeout: 12))
            tablesTab.tap()
        }

        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(tableCard.waitForExistence(timeout: 15))
        tableCard.tap()

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(
            bon.waitForExistence(timeout: 10),
            "Die Session sollte den Bon-Dock-Button zeigen."
        )
        bon.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 5),
            "Der Bon-Dock-Button sollte den Bon-Sheet öffnen."
        )
        XCTAssertTrue(
            app.navigationBars["Bon"].waitForExistence(timeout: 5),
            "Der Bon-Sheet sollte seinen Navigationstitel zeigen."
        )
    }
}
