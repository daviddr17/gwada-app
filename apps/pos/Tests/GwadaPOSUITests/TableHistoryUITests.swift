import XCTest

/// Smoke: Solo → bestellen → kassieren alles → Historie-Phase.
final class TableHistoryUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testPaidHistoryAfterFullCollect_solo() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        try openTisch1(app: app)
        PosUITestSessionHelpers.ensureOrderingPhase(app: app)
        try addSchnitzel(app: app)
        try sendAndPayAll(app: app)

        let history = app.descendants(matching: .any)["pos.session.history"]
        let historyTitle = app.descendants(matching: .any)["pos.session.history.title"]
        let freigeben = app.descendants(matching: .any)["pos.session.history.release"]
        let freigebenLabel = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "freigeben")).firstMatch

        XCTAssertTrue(
            history.waitForExistence(timeout: 12)
                || historyTitle.waitForExistence(timeout: 4)
                || freigeben.waitForExistence(timeout: 4)
                || freigebenLabel.waitForExistence(timeout: 4),
            "Nach Vollzahlung sollte Historie (oder Freigeben) sichtbar sein"
        )

        if history.waitForExistence(timeout: 2) {
            XCTAssertTrue(
                app.staticTexts["Wiener Schnitzel"].firstMatch.waitForExistence(timeout: 6)
                    || app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "bezahlt")).firstMatch.exists,
                "Historie sollte bezahlte Position zeigen"
            )
        }
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
        XCTAssertTrue(table.waitForExistence(timeout: 15), "Tisch 1 erwartet")
        table.tap()
        XCTAssertTrue(app.navigationBars["Tisch 1"].waitForExistence(timeout: 10))
    }

    @MainActor
    private func addSchnitzel(app: XCUIApplication) throws {
        let haupt = app.descendants(matching: .any)["pos.course.2"]
        if haupt.waitForExistence(timeout: 5) { haupt.tap() }
        let item = app.staticTexts["Wiener Schnitzel"].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 10), "Menü: Wiener Schnitzel")
        PosUITestSessionHelpers.tapHittable(item)
        let add = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "hinzufügen")).firstMatch
        if add.waitForExistence(timeout: 1.5), add.isHittable { add.tap() }
        let fertig = app.buttons["Fertig"]
        if fertig.waitForExistence(timeout: 0.8), fertig.isHittable { fertig.tap() }
    }

    @MainActor
    private func sendAndPayAll(app: XCUIApplication) throws {
        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        PosUITestSessionHelpers.tapHittable(bon)
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5)
        )

        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "schicken")).firstMatch
        XCTAssertTrue(schicken.waitForExistence(timeout: 6), "Schicken")
        if schicken.isEnabled { schicken.tap() }
        sleep(1)

        let bill = app.descendants(matching: .any)["pos.bon.zurRechnung"]
        XCTAssertTrue(bill.waitForExistence(timeout: 8))
        PosUITestSessionHelpers.tapHittable(bill)

        XCTAssertTrue(app.descendants(matching: .any)["pos.kassieren"].waitForExistence(timeout: 12))

        let rest = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Rest")).firstMatch
        let alles = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Alles")).firstMatch
        if rest.waitForExistence(timeout: 4), rest.isHittable {
            rest.tap()
        } else if alles.waitForExistence(timeout: 2), alles.isHittable {
            alles.tap()
        } else {
            let diese = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Diese Zahlung")).firstMatch
            XCTAssertTrue(diese.waitForExistence(timeout: 5), "Zahlungs-CTA")
            PosUITestSessionHelpers.tapHittable(diese)
        }

        XCTAssertTrue(app.descendants(matching: .any)["pos.payment.sheet"].waitForExistence(timeout: 8))
        try payCashPassend(app: app)
        try dismissGuestReceiptIfNeeded(app: app)

        // Kassieren schließen falls noch offen
        let fertig = app.buttons["Fertig"]
        if fertig.waitForExistence(timeout: 3), fertig.isHittable {
            fertig.tap()
        }
    }

    @MainActor
    private func payCashPassend(app: XCUIApplication) throws {
        let cash = app.descendants(matching: .any)["pos.pay.method.cash"]
        if cash.waitForExistence(timeout: 6) { cash.tap() }
        let passend = app.buttons["Passend"]
        if passend.waitForExistence(timeout: 4) {
            passend.tap()
        } else {
            let tender = app.descendants(matching: .any).matching(
                NSPredicate(format: "identifier BEGINSWITH %@", "pos.pay.tender.")
            ).firstMatch
            if tender.waitForExistence(timeout: 3) { tender.tap() }
        }
        let finish = app.buttons.matching(
            NSPredicate(format: "label == %@ OR label CONTAINS %@", "Barzahlung abschließen", "stimmt so")
        ).firstMatch
        XCTAssertTrue(finish.waitForExistence(timeout: 6), "Bar abschließen")
        if finish.isEnabled { finish.tap() }
        sleep(2)
    }

    @MainActor
    private func dismissGuestReceiptIfNeeded(app: XCUIApplication) throws {
        let close = app.descendants(matching: .any)["pos.guestReceipt.close"]
        if close.waitForExistence(timeout: 6) {
            PosUITestSessionHelpers.tapHittable(close)
        } else {
            let schliessen = app.buttons["Schließen"]
            if schliessen.waitForExistence(timeout: 2) { schliessen.tap() }
        }
    }
}
