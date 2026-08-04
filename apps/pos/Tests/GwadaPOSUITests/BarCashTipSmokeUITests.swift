import XCTest

/// Smoke: Solo → bestellen → Kassieren Bar mit Aufrunden-Betrag und „Stimmt so“.
final class BarCashTipSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testBarMachThenStimmtSo_solo() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        try openTisch1(app: app)
        PosUITestSessionHelpers.ensureOrderingPhase(app: app)
        try addDemoItems(app: app, schnitzelTaps: 2, colaTaps: 0)
        try sendAndOpenKassieren(app: app)

        // Teilzahlung: 1× Schnitzel mit Mach-Aufrunden
        try setBasketQty(app: app, lineName: "Wiener Schnitzel", qty: 1)
        tapAmountButton(app, titlePrefix: "Diese Zahlung")
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.payment.sheet"].waitForExistence(timeout: 8),
            "Payment Sheet erwartet"
        )
        try payCashWithMach(app: app)
        try dismissGuestReceiptIfNeeded(app: app)

        // Rest: Stimmt so
        XCTAssertTrue(app.descendants(matching: .any)["pos.kassieren"].waitForExistence(timeout: 8))
        tapAmountButton(app, titlePrefix: "Rest")
        XCTAssertTrue(app.descendants(matching: .any)["pos.payment.sheet"].waitForExistence(timeout: 8))
        try payCashStimmtSo(app: app)
        try dismissGuestReceiptIfNeeded(app: app)

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Alles bezahlt")).firstMatch
                .waitForExistence(timeout: 10)
                || app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "freigeben")).firstMatch
                .waitForExistence(timeout: 5),
            "Nach Rest-Bar sollte alles bezahlt / Freigeben sichtbar sein"
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

    @MainActor
    private func addDemoItems(app: XCUIApplication, schnitzelTaps: Int, colaTaps: Int) throws {
        // Hauptgang (Schnitzel)
        let haupt = app.descendants(matching: .any)["pos.course.2"]
        if haupt.waitForExistence(timeout: 5) { haupt.tap() }

        for _ in 0 ..< schnitzelTaps {
            let item = app.staticTexts["Wiener Schnitzel"].firstMatch
            XCTAssertTrue(item.waitForExistence(timeout: 8), "Menü: Wiener Schnitzel")
            if item.isHittable {
                item.tap()
            } else {
                item.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
            // Configure-Sheet ggf. schließen / bestätigen
            let add = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "hinzufügen")).firstMatch
            if add.waitForExistence(timeout: 1.5), add.isHittable { add.tap() }
            let fertig = app.buttons["Fertig"]
            if fertig.waitForExistence(timeout: 0.8), fertig.isHittable { fertig.tap() }
        }

        // Getränke-Gang oft course 0 oder Kategorie scrollen — Cola per Label
        let scroll = app.scrollViews.firstMatch
        if scroll.exists {
            scroll.swipeUp()
            scroll.swipeUp()
        }
        for _ in 0 ..< colaTaps {
            let cola = app.staticTexts["Cola 0,4"].firstMatch
            if !cola.waitForExistence(timeout: 4) {
                scroll.swipeUp()
            }
            XCTAssertTrue(cola.waitForExistence(timeout: 6), "Menü: Cola 0,4")
            if cola.isHittable {
                cola.tap()
            } else {
                cola.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        }
    }

    @MainActor
    private func sendAndOpenKassieren(app: XCUIApplication) throws {
        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        if bon.isHittable {
            bon.tap()
        } else {
            bon.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5)
        )

        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "schicken")).firstMatch
        XCTAssertTrue(schicken.waitForExistence(timeout: 6), "Schicken-Button")
        if schicken.isEnabled { schicken.tap() }
        // Zweiter Gang falls getrennt
        let schicken2 = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "schicken")).firstMatch
        if schicken2.waitForExistence(timeout: 2), schicken2.isEnabled { schicken2.tap() }
        sleep(1)

        let bill = app.descendants(matching: .any)["pos.bon.zurRechnung"]
        XCTAssertTrue(bill.waitForExistence(timeout: 8), "Zur Rechnung")
        XCTAssertTrue(bill.isEnabled)
        bill.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.kassieren"].waitForExistence(timeout: 12),
            "Kassieren-Screen"
        )
    }

    @MainActor
    private func setBasketQty(app: XCUIApplication, lineName: String, qty: Int) throws {
        let name = app.staticTexts[lineName].firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 6), "Kassieren-Zeile \(lineName)")
        // Stepper „Mehr“ in derselben Zeilen-Nähe: erst alle Mehr, dann klicken
        let mehrButtons = app.buttons.matching(NSPredicate(format: "label == %@", "Mehr"))
        XCTAssertTrue(mehrButtons.firstMatch.waitForExistence(timeout: 5), "Mengen-Stepper Mehr")
        // Erste Zeile = Schnitzel wenn zuerst gelistet; sonst erstes Mehr
        for _ in 0 ..< qty {
            let mehr = mehrButtons.element(boundBy: 0)
            XCTAssertTrue(mehr.exists)
            mehr.tap()
        }
    }

    @MainActor
    private func payCashWithMach(app: XCUIApplication) throws {
        let cash = app.descendants(matching: .any)["pos.pay.method.cash"]
        XCTAssertTrue(cash.waitForExistence(timeout: 8), "Zahlungsart Bar")
        cash.tap()

        // Aufrunden-Chip (nur Betrag, z. B. „4 €“) — erster €-Chip nach „Kein“.
        let roundUp = app.buttons.matching(
            NSPredicate(format: "label ENDSWITH %@ AND label != %@", "€", "Kein")
        ).firstMatch
        if roundUp.waitForExistence(timeout: 4) {
            roundUp.tap()
        }
        let passend = app.buttons["Passend"]
        if passend.waitForExistence(timeout: 3) {
            passend.tap()
        } else {
            let given = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "€")).firstMatch
            if given.waitForExistence(timeout: 2) { given.tap() }
        }
        let finish = app.buttons.matching(
            NSPredicate(format: "label == %@ OR label == %@", "Barzahlung abschließen", "Bar · stimmt so")
        ).firstMatch
        XCTAssertTrue(finish.waitForExistence(timeout: 5), "Bar abschließen")
        XCTAssertTrue(finish.isEnabled)
        finish.tap()
        sleep(2)
    }

    @MainActor
    private func payCashStimmtSo(app: XCUIApplication) throws {
        let sheet = app.descendants(matching: .any)["pos.payment.sheet"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 8))

        let cash = sheet.descendants(matching: .any)["pos.pay.method.cash"]
        XCTAssertTrue(cash.waitForExistence(timeout: 8), "Zahlungsart Bar")
        cash.tap()

        let kein = sheet.buttons["Kein"]
        if kein.waitForExistence(timeout: 2) { kein.tap() }

        // Tender unter dem Fold — runterscrollen
        sheet.swipeUp()
        sheet.swipeUp()

        // Ersten Nicht-Passend-Tender tippen (Schein > Rechnung)
        let over = sheet.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "pos.pay.tender.")
        )
        var tapped = false
        let n = min(over.count, 8)
        for i in 0 ..< n {
            let el = over.element(boundBy: i)
            guard el.exists else { continue }
            let id = el.identifier
            if id == "pos.pay.tender.exact" { continue }
            el.tap()
            tapped = true
            break
        }
        if !tapped {
            // Fallback: bekannte Scheine
            for label in ["50 €", "50.00 €", "20 €", "20.00 €", "10 €", "10.00 €", "5 €", "5.00 €"] {
                let b = sheet.buttons[label]
                if b.waitForExistence(timeout: 1) {
                    b.tap()
                    tapped = true
                    break
                }
            }
        }
        XCTAssertTrue(tapped, "Gegeben-Schein > Rechnung erwartet")

        let stimmt = sheet.descendants(matching: .any)["pos.pay.stimmtSo"]
        XCTAssertTrue(stimmt.waitForExistence(timeout: 5), "Stimmt-so Toggle")
        if (stimmt.value as? String) != "1" {
            stimmt.tap()
        }

        let finish = sheet.buttons.matching(
            NSPredicate(format: "label == %@ OR label == %@", "Bar · stimmt so", "Barzahlung abschließen")
        ).firstMatch
        XCTAssertTrue(finish.waitForExistence(timeout: 5))
        XCTAssertTrue(finish.isEnabled, "Abschluss-Button sollte aktiv sein")
        finish.tap()
        sleep(2)
    }

    @MainActor
    private func dismissGuestReceiptIfNeeded(app: XCUIApplication) throws {
        let receipt = app.descendants(matching: .any)["pos.guestReceipt"]
        guard receipt.waitForExistence(timeout: 8) else { return }

        // Beleg oft lang — Schließen unten, sonst Sheet nach unten wischen.
        let close = app.descendants(matching: .any)["pos.guestReceipt.close"]
        if close.waitForExistence(timeout: 3) {
            app.swipeUp()
            if close.isHittable {
                close.tap()
            } else {
                close.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            }
        } else if app.buttons["Schließen"].waitForExistence(timeout: 2) {
            app.buttons["Schließen"].tap()
        }
        if receipt.exists {
            app.swipeDown()
            sleep(1)
            if receipt.exists { app.swipeDown() }
        }

        // Sheet kann kurz hängen — nicht hart failen, weiter mit Kassieren
        _ = app.descendants(matching: .any)["pos.kassieren"].waitForExistence(timeout: 8)
        sleep(1)
    }

    @MainActor
    private func tapButton(_ app: XCUIApplication, label: String) {
        let b = app.buttons[label]
        XCTAssertTrue(b.waitForExistence(timeout: 8), "Button \(label)")
        if b.isHittable {
            b.tap()
        } else {
            b.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    /// `PosAmountButton` Accessibility: „Diese Zahlung, 18.50 €“.
    @MainActor
    private func tapAmountButton(_ app: XCUIApplication, titlePrefix: String) {
        let b = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", titlePrefix)
        ).firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 8), "Amount-Button \(titlePrefix)")
        XCTAssertTrue(b.isEnabled, "\(titlePrefix) sollte enabled sein (Korb/canPay)")
        if b.isHittable {
            b.tap()
        } else {
            b.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }
}
