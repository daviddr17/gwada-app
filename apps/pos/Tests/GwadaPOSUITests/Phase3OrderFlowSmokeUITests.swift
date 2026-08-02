import XCTest

/// Smoke: Solo → Tisch → Bon → (wenn Positionen) Schicken → Kassieren.
/// Menü-Configure bewusst nicht angefasst — überdeckt den Bon-Dock.
final class Phase3OrderFlowSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testBonSendFireAndBill_solo() throws {
        let app = XCUIApplication()
        app.launch()
        try reachTablesViaSoloIfNeeded(app: app)
        try openBonOnTisch1(app: app)
        try assertBonChromeOrKassieren(app: app)
    }

    /// LAN-Pair → Bon. Skippt sauber, wenn kein iPad-Hub auf :8787 läuft
    /// (sonst Flakes in Single-Sim CI). Mit Hub: Pair + debug-approve + Bon.
    @MainActor
    func testBonAfterLanPair_whenHubUp() throws {
        try XCTSkipUnless(hubHealthOk(), "iPad-Hub :8787 nicht erreichbar — LAN-OrderFlow übersprungen")

        let app = XCUIApplication()
        app.launchArguments += ["-UITestingResetEnrollment"]
        app.launch()

        try pairAgainstLocalHub(app: app)
        try openBonOnTisch1(app: app)
        try assertBonChromeOrKassieren(app: app)
    }

    // MARK: - Shared

    @MainActor
    private func reachTablesViaSoloIfNeeded(app: XCUIApplication) throws {
        let tables = app.tabBars.buttons["Tische"]
        if tables.waitForExistence(timeout: 4) {
            tables.tap()
            return
        }
        let solo = app.buttons["DEBUG: Solo ohne Code"]
        XCTAssertTrue(solo.waitForExistence(timeout: 12), "Onboarding braucht DEBUG Solo")
        solo.tap()
        XCTAssertTrue(tables.waitForExistence(timeout: 12))
        tables.tap()
    }

    @MainActor
    private func openBonOnTisch1(app: XCUIApplication) throws {
        app.tabBars.buttons["Tische"].tap()

        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(tableCard.waitForExistence(timeout: 15), "Tisch 1 erwartet")
        tableCard.tap()

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 10), "Bon-Dock sollte sichtbar sein")
        if bon.isHittable {
            bon.tap()
        } else {
            bon.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 8)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5),
            "Bon-Sheet sollte öffnen"
        )
    }

    @MainActor
    private func assertBonChromeOrKassieren(app: XCUIApplication) throws {
        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "schicken")).firstMatch
        guard schicken.waitForExistence(timeout: 3), schicken.isEnabled else {
            XCTAssertTrue(
                app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Noch keine Artikel")).firstMatch
                    .waitForExistence(timeout: 3)
                    || app.descendants(matching: .any)["pos.bon.zurRechnung"].waitForExistence(timeout: 2),
                "Bon-Sheet sollte Inhalt oder Rechnung-CTA zeigen"
            )
            return
        }

        schicken.tap()
        sleep(1)

        let bill = app.descendants(matching: .any)["pos.bon.zurRechnung"]
        XCTAssertTrue(bill.waitForExistence(timeout: 5))
        XCTAssertTrue(bill.isEnabled)
        bill.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.kassieren"].waitForExistence(timeout: 10),
            "Zur Rechnung sollte Kassieren öffnen"
        )
    }

    @MainActor
    private func pairAgainstLocalHub(app: XCUIApplication) throws {
        let openLan = app.buttons["Stattdessen mit iPad-Kasse koppeln"]
        if openLan.waitForExistence(timeout: 4) {
            openLan.tap()
        } else {
            // Bereits cloud-ready: Pairing über Mehr ist optional — hier Onboarding erwarten.
            XCTFail("LAN-Pairing-Einstieg nicht sichtbar")
        }

        let host = app.textFields.firstMatch
        XCTAssertTrue(host.waitForExistence(timeout: 12), "Pairing-Sheet erwartet")
        host.tap()
        if let value = host.value as? String, !value.isEmpty {
            host.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count))
        }
        host.typeText("127.0.0.1:8787")

        app.buttons["Koppeln"].tap()
        XCTAssertTrue(
            app.staticTexts["Warte auf Freigabe am iPad"].waitForExistence(timeout: 15),
            "Nach Koppeln Warte-Screen erwartet"
        )

        try debugApproveAllPendingPairs()

        XCTAssertTrue(
            app.tabBars.buttons["Tische"].waitForExistence(timeout: 20),
            "Nach DEBUG-Approve sollten Tabs erscheinen"
        )
    }

    private func hubHealthOk() -> Bool {
        let exp = expectation(description: "hub-health")
        var ok = false
        let task = URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8787/v1/health")!) { _, response, _ in
            ok = (response as? HTTPURLResponse)?.statusCode == 200
            exp.fulfill()
        }
        task.resume()
        wait(for: [exp], timeout: 2)
        return ok
    }

    private func debugApproveAllPendingPairs() throws {
        let url = URL(string: "http://127.0.0.1:8787/v1/pair/debug-approve-all")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let exp = expectation(description: "debug-approve")
        var status = 0
        URLSession.shared.dataTask(with: req) { _, response, _ in
            status = (response as? HTTPURLResponse)?.statusCode ?? -1
            exp.fulfill()
        }.resume()
        wait(for: [exp], timeout: 5)
        XCTAssertEqual(status, 200, "debug-approve-all sollte 200 liefern")
    }
}
