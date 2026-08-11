import XCTest

/// Solo: Wechselgeld ausgeben → Schicht beenden (Soll=Ist) + Schichtübergabe-Checkbox.
final class CashBagHandoverUITests: XCTestCase {
    private let shotDir = "/tmp/gwada-pos-ui-shots-cashbag"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try? FileManager.default.createDirectory(
            atPath: shotDir,
            withIntermediateDirectories: true
        )
    }

    @MainActor
    func testIssueCloseHappyPath_andHandoverTransferBagToggle() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        openMehr(app: app)
        shot(app, "01-mehr")

        // --- Issue ---
        let issueMenu = app.descendants(matching: .any)["pos.cashBag.issueMenu"].firstMatch
        XCTAssertTrue(
            issueMenu.waitForExistence(timeout: 10)
                || app.buttons["Wechselgeld ausgeben"].waitForExistence(timeout: 4),
            "Wechselgeld ausgeben erwartet"
        )
        if issueMenu.exists {
            tap(issueMenu)
        } else {
            app.buttons["Wechselgeld ausgeben"].tap()
        }

        let issueSheet = app.descendants(matching: .any)["pos.cashBag.issueSheet"].firstMatch
        XCTAssertTrue(
            issueSheet.waitForExistence(timeout: 8)
                || app.navigationBars["Wechselgeld ausgeben"].waitForExistence(timeout: 5),
            "Issue-Sheet erwartet"
        )
        shot(app, "02-issue-sheet")

        let issueConfirm = app.buttons["Ausgeben"].firstMatch
        XCTAssertTrue(issueConfirm.waitForExistence(timeout: 5), "Ausgeben erwartet")
        XCTAssertTrue(issueConfirm.isEnabled, "Kellner + Betrag sollten vorausgefüllt sein")
        issueConfirm.tap()

        XCTAssertTrue(
            app.tabBars.buttons["Mehr"].waitForExistence(timeout: 10),
            "Nach Issue zurück zu Mehr"
        )
        // Sheet dismiss kann kurz brauchen, bis Close-Menü erscheint.
        let closeMenu = app.descendants(matching: .any)["pos.cashBag.closeMenu"].firstMatch
        let closeByLabel = app.buttons["Schicht beenden"].firstMatch
        XCTAssertTrue(
            closeMenu.waitForExistence(timeout: 10) || closeByLabel.waitForExistence(timeout: 4),
            "Nach Issue muss Schicht beenden sichtbar sein"
        )
        shot(app, "03-after-issue")

        // --- Close (Soll = Ist, vorausgefüllt) ---
        if closeMenu.exists {
            tap(closeMenu)
        } else {
            closeByLabel.tap()
        }

        let closeSheet = app.descendants(matching: .any)["pos.cashBag.closeSheet"].firstMatch
        XCTAssertTrue(
            closeSheet.waitForExistence(timeout: 8)
                || app.navigationBars["Schicht beenden"].waitForExistence(timeout: 5),
            "Close-Sheet erwartet"
        )
        XCTAssertTrue(
            app.staticTexts["Erwartet"].waitForExistence(timeout: 5)
                || app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "100")).firstMatch
                .waitForExistence(timeout: 3),
            "Soll-Anzeige erwartet"
        )
        shot(app, "04-close-sheet")

        let closeConfirm = app.descendants(matching: .any)["pos.cashBag.closeConfirm"].firstMatch
        XCTAssertTrue(closeConfirm.waitForExistence(timeout: 5), "Close-Confirm erwartet")
        XCTAssertTrue(closeConfirm.isEnabled, "Ist vorausgefüllt → Confirm enabled")
        tap(closeConfirm)

        XCTAssertTrue(app.tabBars.buttons["Mehr"].waitForExistence(timeout: 10))
        XCTAssertFalse(
            app.descendants(matching: .any)["pos.cashBag.closeMenu"].waitForExistence(timeout: 3),
            "Nach Close darf Schicht beenden nicht mehr sichtbar sein"
        )
        shot(app, "05-after-close")

        // --- Handover sheet + Portemonnaie-Checkbox ---
        let handoverMenu = app.descendants(matching: .any)["pos.shift.handoverMenu"].firstMatch
        XCTAssertTrue(
            handoverMenu.waitForExistence(timeout: 8)
                || app.buttons["Schichtübergabe"].waitForExistence(timeout: 4),
            "Schichtübergabe erwartet"
        )
        if handoverMenu.exists {
            tap(handoverMenu)
        } else {
            app.buttons["Schichtübergabe"].tap()
        }

        let handoverSheet = app.descendants(matching: .any)["pos.shift.handoverSheet"].firstMatch
        XCTAssertTrue(
            handoverSheet.waitForExistence(timeout: 8)
                || app.navigationBars["Schichtübergabe"].waitForExistence(timeout: 5),
            "Handover-Sheet erwartet"
        )
        let transferToggle = app.descendants(matching: .any)["pos.shift.handoverTransferBag"].firstMatch
        XCTAssertTrue(
            transferToggle.waitForExistence(timeout: 6)
                || app.switches["Portemonnaie mitübergeben"].waitForExistence(timeout: 4),
            "Portemonnaie-Checkbox erwartet"
        )
        shot(app, "06-handover-sheet")
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
    private func openMehr(app: XCUIApplication) {
        let mehr = app.tabBars.buttons["Mehr"]
        XCTAssertTrue(mehr.waitForExistence(timeout: 10), "Mehr-Tab erwartet")
        mehr.tap()
        XCTAssertTrue(
            app.buttons["Speisekarte aktualisieren"].waitForExistence(timeout: 8)
                || app.staticTexts["Schicht"].waitForExistence(timeout: 5)
                || app.navigationBars["Mehr"].waitForExistence(timeout: 5),
            "Mehr-Inhalt erwartet"
        )
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
