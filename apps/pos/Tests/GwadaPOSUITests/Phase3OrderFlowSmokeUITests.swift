import XCTest

/// End-to-end Smoke Phase 3: Pair (DEBUG-Approve) → Tisch → Menü → Bon → Senden → Fire → Zur Rechnung.
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
            // Configure sheet? dismiss with Hinzufügen if present
            let add = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Hinzufügen")).firstMatch
            if add.waitForExistence(timeout: 2) {
                add.tap()
            }
        }

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 8))
        bon.tap()

        XCTAssertTrue(app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 5))

        let send = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Senden")).firstMatch
        if send.waitForExistence(timeout: 3), send.isEnabled {
            send.tap()
            // Sheet may stay open with open lines
            sleep(1)
        }

        let fire = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "schicken")).firstMatch
        if fire.waitForExistence(timeout: 5), fire.isEnabled {
            fire.tap()
            sleep(1)
        }

        let bill = app.buttons["Zur Rechnung"]
        XCTAssertTrue(bill.waitForExistence(timeout: 5))
        bill.tap()

        // SplitPay sheet / navigation should appear (title varies)
        let splitGoneBon = !app.descendants(matching: .any)["pos.bon.sheet"].exists
            || app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS[c] %@ OR label CONTAINS[c] %@", "Split", "Rechnung")).firstMatch.waitForExistence(timeout: 5)
            || app.buttons["Fertig"].waitForExistence(timeout: 3)
            || app.buttons["Abbrechen"].waitForExistence(timeout: 3)
        XCTAssertTrue(splitGoneBon || app.sheets.firstMatch.exists, "Zur Rechnung sollte Split/Pay öffnen")
    }

    @MainActor
    private func pairAgainstLocalHub(app: XCUIApplication) throws {
        let host = app.textFields.firstMatch
        XCTAssertTrue(host.waitForExistence(timeout: 12), "Pairing-Gate erwartet")
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
