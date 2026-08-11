import XCTest

/// Solo: Tisch umziehen ohne „Umziehen bitte an der Kasse.“
final class MoveSessionUITests: XCTestCase {
    private let shotDir = "/tmp/gwada-pos-ui-shots-move"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try? FileManager.default.createDirectory(
            atPath: shotDir,
            withIntermediateDirectories: true
        )
    }

    @MainActor
    func testSoloMoveSession_opensSheetAndMovesWithoutKasseBlock() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        try occupyTable(named: "Tisch 1", app: app)
        try openTable(named: "Tisch 1", app: app)
        shot(app, "01-session-occupied")

        let moveMenu = app.buttons["pos.session.moveMenu"].firstMatch
        XCTAssertTrue(moveMenu.waitForExistence(timeout: 8), "Session-Menü erwartet")
        moveMenu.tap()

        let moveItem = app.buttons["Tisch umziehen"].firstMatch
        XCTAssertTrue(moveItem.waitForExistence(timeout: 5), "Menüpunkt Tisch umziehen erwartet")
        XCTAssertTrue(moveItem.isEnabled, "Mit echter Session muss Umziehen aktiv sein")
        moveItem.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.session.moveSheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Umziehen"].waitForExistence(timeout: 5),
            "Move-Sheet erwartet"
        )
        shot(app, "02-move-sheet")

        XCTAssertFalse(
            app.staticTexts["Umziehen bitte an der Kasse."].exists,
            "Kasse-Blockade darf nicht erscheinen"
        )

        // Freier Demo-Tisch: „Fenster“ (Tisch 2)
        let target = app.staticTexts["Fenster"].firstMatch
        if target.waitForExistence(timeout: 4) {
            target.tap()
        } else {
            let t2 = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Fenster")).firstMatch
            let anyTisch = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Tisch")).firstMatch
            if t2.waitForExistence(timeout: 2) {
                t2.tap()
            } else {
                XCTAssertTrue(anyTisch.waitForExistence(timeout: 5), "Kein Ziel-Tisch")
                anyTisch.tap()
            }
        }
        shot(app, "03-target-selected")

        let confirm = app.buttons["pos.session.moveConfirm"].firstMatch
        if confirm.waitForExistence(timeout: 3) {
            XCTAssertTrue(confirm.isEnabled, "Umziehen sollte in Solo enabled sein")
            confirm.tap()
        } else {
            let navConfirm = app.navigationBars["Umziehen"].buttons["Umziehen"]
            XCTAssertTrue(navConfirm.waitForExistence(timeout: 3))
            navConfirm.tap()
        }

        XCTAssertFalse(
            app.staticTexts["Umziehen bitte an der Kasse."].waitForExistence(timeout: 2),
            "Alte Kasse-Blockade noch aktiv"
        )

        // Nach Erfolg: zurück zum Floor, Quelltisch frei, Ziel belegt.
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.table.Tisch 1"].waitForExistence(timeout: 10),
            "Floor nach Move erwartet"
        )
        XCTAssertTrue(
            app.staticTexts["Tippen zum Eröffnen"].waitForExistence(timeout: 8),
            "Quelltisch muss frei sein"
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.table.Fenster"].waitForExistence(timeout: 5),
            "Ziel-Tisch Fenster auf Floor"
        )
        shot(app, "04-after-move")
    }

    // MARK: - Helpers (aligned with TableMergeUITests)

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
    private func occupyTable(named name: String, app: XCUIApplication) throws {
        try openTable(named: name, app: app)
        try ensureOrderingPhase(app: app)

        let mainCourse = app.descendants(matching: .any)["pos.course.2"]
        if mainCourse.waitForExistence(timeout: 4) { mainCourse.tap() }

        let item = app.staticTexts["Wiener Schnitzel"].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 8), "Demo-Menü erwartet")
        tap(item)
        let add = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "hinzufügen")).firstMatch
        if add.waitForExistence(timeout: 2), add.isHittable { add.tap() }
        let done = app.buttons["Fertig"]
        if done.waitForExistence(timeout: 1), done.isHittable { done.tap() }

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        tap(bon)
        let send = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "schicken")).firstMatch
        XCTAssertTrue(send.waitForExistence(timeout: 6))
        XCTAssertTrue(send.isEnabled)
        send.tap()

        let continueOrdering = app.buttons["Weiter bestellen"]
        if continueOrdering.waitForExistence(timeout: 4), continueOrdering.isHittable {
            continueOrdering.tap()
        } else {
            app.swipeDown()
        }
        navigateBackToTables(from: name, app: app)
    }

    @MainActor
    private func openTable(named name: String, app: XCUIApplication) throws {
        let table = app.descendants(matching: .any)["pos.table.\(name)"]
        XCTAssertTrue(table.waitForExistence(timeout: 12), "\(name) erwartet")
        table.tap()
        XCTAssertTrue(app.navigationBars[name].waitForExistence(timeout: 8))
    }

    @MainActor
    private func ensureOrderingPhase(app: XCUIApplication) throws {
        let overview = app.descendants(matching: .any)["pos.session.overview"]
        guard overview.waitForExistence(timeout: 2) else { return }
        app.swipeUp()
        let order = app.descendants(matching: .any)["pos.session.overview.order"]
        XCTAssertTrue(order.waitForExistence(timeout: 5))
        tap(order)
    }

    @MainActor
    private func navigateBackToTables(from name: String, app: XCUIApplication) {
        let back = app.navigationBars[name].buttons.element(boundBy: 0)
        XCTAssertTrue(back.waitForExistence(timeout: 6))
        back.tap()
        XCTAssertTrue(app.descendants(matching: .any)["pos.table.\(name)"].waitForExistence(timeout: 8))
    }

    @MainActor
    private func tap(_ element: XCUIElement) {
        if element.isHittable {
            element.tap()
        } else {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    @MainActor
    private func shot(_ app: XCUIApplication, _ name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        try? screenshot.pngRepresentation.write(
            to: URL(fileURLWithPath: "\(shotDir)/\(name).png")
        )
    }
}
