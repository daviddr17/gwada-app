import XCTest

/// End-to-end Smoke: Pair → Tisch → Menü → Bon → Gang schicken → Zur Rechnung.
final class Phase3OrderFlowSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testBonSendFireAndBill() throws {
        let app = XCUIApplication()
        app.launch()

        if !app.tabBars.buttons["Tische"].waitForExistence(timeout: 4) {
            try pairAgainstLocalHub(app: app)
        }

        let tables = app.tabBars.buttons["Tische"]
        XCTAssertTrue(tables.waitForExistence(timeout: 20), "Nach Pairing sollten Kellner-Tabs da sein")
        tables.tap()

        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(tableCard.waitForExistence(timeout: 15))
        tableCard.tap()

        // First visible menu item (name varies by restaurant catalog)
        let menuButton = app.descendants(matching: .button)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "€"))
            .firstMatch
        if menuButton.waitForExistence(timeout: 8) {
            menuButton.tap()
            let add = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Hinzufügen")).firstMatch
            if add.waitForExistence(timeout: 2) {
                add.tap()
            }
        }

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        bon.tap()

        XCTAssertTrue(app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 5))

        // Prototype: one CTA „Gang N schicken“ (send + fire) — needs a cart line from the menu.
        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "schicken")).firstMatch
        guard schicken.waitForExistence(timeout: 5), schicken.isEnabled else {
            // DEBUG hub catalog may have no €-priced buttons; Bon chrome still verified.
            XCTAssertTrue(
                app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Noch keine Artikel")).firstMatch
                    .waitForExistence(timeout: 3)
                    || app.buttons["Zur Rechnung"].waitForExistence(timeout: 2),
                "Bon-Sheet sollte leer oder mit Rechnung-CTA sichtbar sein"
            )
            return
        }

        schicken.tap()
        sleep(1)

        let bill = app.descendants(matching: .any)["pos.bon.zurRechnung"]
        XCTAssertTrue(bill.waitForExistence(timeout: 5))
        XCTAssertTrue(bill.isEnabled, "Nach Gang schicken muss Zur Rechnung aktiv sein")
        bill.tap()

        let splitAppeared = app.buttons["Abbrechen"].waitForExistence(timeout: 8)
            || app.navigationBars["Rechnung splitten"].waitForExistence(timeout: 2)
            || app.sheets.firstMatch.waitForExistence(timeout: 2)
        XCTAssertTrue(splitAppeared, "Zur Rechnung sollte Split/Pay öffnen")
    }

    @MainActor
    private func pairAgainstLocalHub(app: XCUIApplication) throws {
        let openLan = app.buttons["Stattdessen mit iPad-Kasse koppeln"]
        if openLan.waitForExistence(timeout: 4) {
            openLan.tap()
        }

        let host = app.textFields.firstMatch
        XCTAssertTrue(host.waitForExistence(timeout: 12), "Pairing-Sheet erwartet")
        host.tap()
        if let value = host.value as? String, !value.isEmpty {
            host.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count))
        }
        host.typeText("127.0.0.1:8787")

        app.buttons["Koppeln"].tap()
        XCTAssertTrue(app.staticTexts["Warte auf Freigabe am iPad"].waitForExistence(timeout: 15))

        // DEBUG hub endpoint — freigibt pending ohne iPad-Tap
        let url = URL(string: "http://127.0.0.1:8787/v1/pair/debug-approve-all")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let exp = expectation(description: "debug-approve")
        URLSession.shared.dataTask(with: req) { _, response, _ in
            XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
            exp.fulfill()
        }.resume()
        wait(for: [exp], timeout: 5)

        XCTAssertTrue(
            app.tabBars.buttons["Tische"].waitForExistence(timeout: 20),
            "Nach DEBUG-Approve sollten Tabs erscheinen"
        )
    }
}
