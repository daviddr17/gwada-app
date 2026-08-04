import XCTest

/// Gründlicher Solo-Durchlauf: Session-Kernpfad + Tabs (Reservierungen, Mehr).
final class ComprehensiveScreenWalkUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testWalkAllMainScreens_solo() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        XCTAssertTrue(app.descendants(matching: .any)["pos.table.Tisch 1"].waitForExistence(timeout: 15))

        // --- Session zuerst (wie stabile Phase2/Overview-Smokes) ---
        try openTisch1(app: app)
        try ensureOrderingPhase(app: app)

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.course.2"].waitForExistence(timeout: 10)
                || app.descendants(matching: .any)["pos.bon.open"].waitForExistence(timeout: 4),
            "Ordering: Gang-Chips oder Bon-Dock"
        )

        if app.descendants(matching: .any)["pos.course.2"].exists {
            app.descendants(matching: .any)["pos.course.2"].tap()
        }

        try addQuickItem(app: app, name: "Wiener Schnitzel")

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        tapHittable(bon)
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5)
        )

        let clear = app.descendants(matching: .any)["pos.bon.clearDraft"]
        if clear.waitForExistence(timeout: 3), clear.isHittable {
            clear.tap()
        }
        swipeOrCloseBon(app: app)

        // Move-Menü (ersetzt doppelte Umzieh-Icons)
        if app.navigationBars["Tisch 1"].waitForExistence(timeout: 4) {
            XCTAssertTrue(
                app.descendants(matching: .any)["pos.session.moveMenu"].waitForExistence(timeout: 5)
                    || app.buttons["Umziehen"].waitForExistence(timeout: 3),
                "Umziehen-Menü in der Session-Toolbar"
            )
        }

        // Zurück zum Floor
        if app.navigationBars.buttons["Tische"].waitForExistence(timeout: 2) {
            app.navigationBars.buttons["Tische"].tap()
        } else if app.tabBars.buttons["Tische"].waitForExistence(timeout: 2) {
            app.tabBars.buttons["Tische"].tap()
        }

        // --- Andere Tabs ---
        app.tabBars.buttons["Reservierungen"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.reservations.dateStrip"].waitForExistence(timeout: 10)
                || app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Reserv")).firstMatch
                .waitForExistence(timeout: 5)
                || app.buttons["Walk-in"].waitForExistence(timeout: 5),
            "Reservierungen-Tab sollte laden"
        )

        app.tabBars.buttons["Mehr"].tap()
        XCTAssertTrue(
            app.buttons["Speisekarte aktualisieren"].waitForExistence(timeout: 8)
                || app.staticTexts["Aufgaben"].waitForExistence(timeout: 5)
        )
        XCTAssertTrue(app.buttons["Gerät sperren"].exists || app.staticTexts["Schicht"].exists)

        app.tabBars.buttons["Tische"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["pos.table.Tisch 1"].waitForExistence(timeout: 10))
    }

    // MARK: - Helpers

    @MainActor
    private func reachTablesViaSolo(app: XCUIApplication) throws {
        let tables = app.tabBars.buttons["Tische"]
        if tables.waitForExistence(timeout: 4) {
            tables.tap()
            return
        }
        let soloCode = app.buttons["DEBUG: Solo ohne Code"]
        let soloKasse = app.buttons["DEBUG: Solo ohne Kasse"]
        if soloCode.waitForExistence(timeout: 10) {
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
        let table = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(table.waitForExistence(timeout: 15))
        table.tap()
        XCTAssertTrue(app.navigationBars["Tisch 1"].waitForExistence(timeout: 10))
    }

    @MainActor
    private func ensureOrderingPhase(app: XCUIApplication) throws {
        let overview = app.descendants(matching: .any)["pos.session.overview"]
        guard overview.waitForExistence(timeout: 2) else { return }

        app.swipeUp()
        let order = app.descendants(matching: .any)["pos.session.overview.order"]
        let orderByLabel = app.buttons["Bestellen"].firstMatch
        if order.waitForExistence(timeout: 5) {
            tapHittable(order)
        } else if orderByLabel.waitForExistence(timeout: 5) {
            tapHittable(orderByLabel)
        } else {
            XCTFail("Bestellen in Übersicht erwartet")
        }
        _ = overview.waitForExistence(timeout: 1)
    }

    @MainActor
    private func addQuickItem(app: XCUIApplication, name: String) throws {
        let haupt = app.descendants(matching: .any)["pos.course.2"]
        if haupt.waitForExistence(timeout: 4) { haupt.tap() }

        let item = app.staticTexts[name].firstMatch
        if !item.waitForExistence(timeout: 4) {
            let scroll = app.scrollViews.firstMatch
            if scroll.exists {
                for _ in 0 ..< 4 { scroll.swipeUp() }
            }
        }
        XCTAssertTrue(item.waitForExistence(timeout: 10), "Menü: \(name)")
        tapHittable(item)
        let add = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "hinzufügen")).firstMatch
        if add.waitForExistence(timeout: 1.5), add.isHittable { add.tap() }
        let fertig = app.buttons["Fertig"]
        if fertig.waitForExistence(timeout: 0.8), fertig.isHittable { fertig.tap() }
        let abbrechen = app.buttons["Abbrechen"]
        if abbrechen.waitForExistence(timeout: 0.5), abbrechen.isHittable { abbrechen.tap() }
    }

    @MainActor
    private func tapHittable(_ el: XCUIElement) {
        if el.isHittable {
            el.tap()
        } else {
            el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    @MainActor
    private func swipeOrCloseBon(app: XCUIApplication) {
        if app.buttons["Weiter bestellen"].waitForExistence(timeout: 1) {
            app.buttons["Weiter bestellen"].tap()
            return
        }
        app.swipeDown()
        sleep(1)
    }
}
