import XCTest

/// Solo smoke: zwei belegte Tische zusammenführen und Covers/Quelltisch prüfen.
final class TableMergeUITests: XCTestCase {
    private let shotDir = "/tmp/gwada-pos-ui-shots-merge"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try? FileManager.default.createDirectory(
            atPath: shotDir,
            withIntermediateDirectories: true
        )
    }

    @MainActor
    func testMergeTwoOccupiedTables_solo() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        try occupyTable(named: "Tisch 1", app: app)
        try occupyTable(named: "Fenster", app: app)
        try openTable(named: "Tisch 1", app: app)

        let moveMenu = app.buttons["pos.session.moveMenu"].firstMatch
        XCTAssertTrue(moveMenu.waitForExistence(timeout: 8), "Session-Menü erwartet")
        moveMenu.tap()

        let mergeMenu = app.buttons["pos.session.mergeMenu"]
        XCTAssertTrue(mergeMenu.waitForExistence(timeout: 5), "Tisch mergen erwartet")
        XCTAssertTrue(mergeMenu.isEnabled, "Mit zweitem belegten Tisch muss Mergen aktiv sein")
        mergeMenu.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.session.mergeSheet"].waitForExistence(timeout: 8),
            "Merge-Sheet erwartet"
        )
        XCTAssertTrue(app.staticTexts["2 Gäste"].firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "offen")).firstMatch
                .waitForExistence(timeout: 5),
            "Offener Betrag am Ziel erwartet"
        )
        shot(app, "01-target-picker")

        let target = app.staticTexts["Fenster"].firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 5), "Fenster als Ziel erwartet")
        target.tap()

        let confirm = app.buttons["pos.session.mergeConfirm"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 3))
        XCTAssertTrue(confirm.isEnabled)
        confirm.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.table.Tisch 1"].waitForExistence(timeout: 10),
            "Floor nach Merge erwartet"
        )
        XCTAssertTrue(app.staticTexts["4 Gäste"].waitForExistence(timeout: 8), "Covers müssen summiert sein")
        XCTAssertTrue(
            app.staticTexts["Tippen zum Eröffnen"].waitForExistence(timeout: 5),
            "Quelltisch muss frei sein"
        )
        shot(app, "02-merged-floor")
    }

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
