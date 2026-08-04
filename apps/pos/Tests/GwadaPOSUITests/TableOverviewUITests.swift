import XCTest

/// Smoke: Solo → Tisch mit offenen Positionen → Übersicht → Bestellen → Speisekarte.
final class TableOverviewUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOverviewShowsOpenLinesThenOrder_solo() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        try openTisch1(app: app)
        try ensureTableHasOpenLines(app: app)

        let overview = app.descendants(matching: .any)["pos.session.overview"]
        XCTAssertTrue(overview.waitForExistence(timeout: 10), "Übersicht mit offenen Positionen erwartet")

        app.swipeUp()
        let order = app.descendants(matching: .any)["pos.session.overview.order"]
        let orderByLabel = app.buttons["Bestellen"].firstMatch
        if order.waitForExistence(timeout: 5) {
            if order.isHittable {
                order.tap()
            } else {
                order.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        } else {
            XCTAssertTrue(orderByLabel.waitForExistence(timeout: 5), "Bestellen-Button in Übersicht erwartet")
            if orderByLabel.isHittable {
                orderByLabel.tap()
            } else {
                orderByLabel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        }

        XCTAssertFalse(
            overview.waitForExistence(timeout: 2),
            "Übersicht sollte nach Bestellen verschwinden"
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.course.2"].waitForExistence(timeout: 6)
                || app.descendants(matching: .any)["pos.bon.open"].waitForExistence(timeout: 4)
                || app.staticTexts["Wiener Schnitzel"].firstMatch.waitForExistence(timeout: 4),
            "Speisekarte sollte nach Bestellen sichtbar sein"
        )
    }

    // MARK: - Steps

    @MainActor
    private func reachTablesViaSolo(app: XCUIApplication) throws {
        let tables = app.tabBars.buttons["Tische"]
        if tables.waitForExistence(timeout: 4) {
            tables.tap()
            return
        }
        let soloCode = app.buttons["DEBUG: Solo ohne Code"]
        let soloKasse = app.buttons["DEBUG: Solo ohne Kasse"]
        if soloCode.waitForExistence(timeout: 8) {
            soloCode.tap()
        } else if soloKasse.waitForExistence(timeout: 4) {
            soloKasse.tap()
        } else {
            XCTFail("Kein Solo-Debug-Einstieg")
        }
        XCTAssertTrue(tables.waitForExistence(timeout: 15))
        tables.tap()
    }

    @MainActor
    private func openTisch1(app: XCUIApplication) throws {
        app.tabBars.buttons["Tische"].tap()
        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(tableCard.waitForExistence(timeout: 15), "Tisch 1 erwartet")
        tableCard.tap()
        XCTAssertTrue(app.navigationBars["Tisch 1"].waitForExistence(timeout: 10))
    }

    /// Übersicht direkt (persistierte offene Positionen) oder frisch über Bon schicken.
    @MainActor
    private func ensureTableHasOpenLines(app: XCUIApplication) throws {
        let overview = app.descendants(matching: .any)["pos.session.overview"]
        if overview.waitForExistence(timeout: 4) {
            return
        }

        let orderEntry = app.buttons["Bestellen"].firstMatch
        if orderEntry.waitForExistence(timeout: 2), orderEntry.isHittable {
            orderEntry.tap()
        }

        guard app.descendants(matching: .any)["pos.bon.open"].waitForExistence(timeout: 8) else {
            throw XCTSkip("Speisekarte nicht geladen — offene Positionen konnten nicht gesät werden")
        }

        try addDemoItem(app: app)
        try sendCartViaBon(app: app)
        try navigateBackToTables(app: app)
        try openTisch1(app: app)
    }

    @MainActor
    private func addDemoItem(app: XCUIApplication) throws {
        let haupt = app.descendants(matching: .any)["pos.course.2"]
        if haupt.waitForExistence(timeout: 5) { haupt.tap() }

        let item = app.staticTexts["Wiener Schnitzel"].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 8), "Menü: Wiener Schnitzel")
        if item.isHittable {
            item.tap()
        } else {
            item.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        let add = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "hinzufügen")).firstMatch
        if add.waitForExistence(timeout: 1.5), add.isHittable { add.tap() }
        let fertig = app.buttons["Fertig"]
        if fertig.waitForExistence(timeout: 0.8), fertig.isHittable { fertig.tap() }
    }

    @MainActor
    private func sendCartViaBon(app: XCUIApplication) throws {
        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8), "Bon-Dock erwartet")
        if bon.isHittable {
            bon.tap()
        } else {
            bon.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5),
            "Bon-Sheet erwartet"
        )

        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "schicken")).firstMatch
        XCTAssertTrue(schicken.waitForExistence(timeout: 6), "Schicken-Button erwartet")
        guard schicken.isEnabled else {
            throw XCTSkip("Schicken nicht aktiv — offene Positionen konnten nicht gesendet werden")
        }
        schicken.tap()
        sleep(1)

        let weiter = app.buttons["Weiter bestellen"]
        if weiter.waitForExistence(timeout: 4), weiter.isHittable {
            weiter.tap()
        } else {
            app.swipeDown()
        }
        sleep(1)
    }

    @MainActor
    private func navigateBackToTables(app: XCUIApplication) throws {
        let back = app.navigationBars["Tisch 1"].buttons.element(boundBy: 0)
        XCTAssertTrue(back.waitForExistence(timeout: 5), "Zurück zur Tischübersicht")
        back.tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.table.Tisch 1"].waitForExistence(timeout: 8),
            "Tischübersicht erwartet"
        )
    }
}
