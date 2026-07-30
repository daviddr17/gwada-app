import XCTest

/// Smoke: Tisch öffnen → Gang-Chips + Speisekarte-Grid (Phase 2 Bestellaufnahme).
/// Erwartet: Handheld bereits an Hub gekoppelt (oder Solo mit Floor-Daten).
final class Phase2OrderIntakeSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOpenTableShowsCourseChipsAndMenu() throws {
        let app = XCUIApplication()
        // Kein -UITesting: Pairing-/Enrollment-Store behalten.
        app.launch()

        let tablesTab = app.tabBars.buttons["Tische"]
        if tablesTab.waitForExistence(timeout: 8) {
            tablesTab.tap()
        } else {
            // Pairing-Gate: Solo als Fallback (ohne Hub-Floor ggf. skip)
            let solo = app.buttons["DEBUG: Solo ohne Kasse"]
            XCTAssertTrue(
                solo.waitForExistence(timeout: 12),
                "Erwarte Tische-Tab oder Solo-Debug-Button"
            )
            solo.tap()
            XCTAssertTrue(tablesTab.waitForExistence(timeout: 12))
            tablesTab.tap()
        }

        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(
            tableCard.waitForExistence(timeout: 15),
            "Tisch 1 sollte in der Übersicht stehen (Hub-Floor oder Solo-Daten)"
        )
        tableCard.tap()

        let navTisch = app.navigationBars["Tisch 1"]
        XCTAssertTrue(
            navTisch.waitForExistence(timeout: 10),
            "Session-Navigation für Tisch 1 sollte erscheinen"
        )

        let hauptgang = app.descendants(matching: .any)["pos.course.2"]
        XCTAssertTrue(
            hauptgang.waitForExistence(timeout: 8),
            "Aktiver-Gang-Chip Hauptgang (pos.course.2) in der Session"
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.course.1"].exists,
            "Gang-Chip Vorspeise"
        )
        XCTAssertTrue(
            app.scrollViews.firstMatch.exists || app.collectionViews.firstMatch.exists,
            "Session sollte Scroll-/Menü-Chrome zeigen"
        )
    }
}
