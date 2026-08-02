import XCTest

/// Smoke: Solo → Tisch → Bon → (wenn Positionen) Schicken → Kassieren.
/// Menü-Configure bewusst nicht angefasst — überdeckt den Bon-Dock (isHittable=false).
/// LAN-Pairing: `HandheldPairToLocalHubUITests`.
final class Phase3OrderFlowSmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testBonSendFireAndBill() throws {
        let app = XCUIApplication()
        app.launch()

        let tables = app.tabBars.buttons["Tische"]
        if !tables.waitForExistence(timeout: 4) {
            let solo = app.buttons["DEBUG: Solo ohne Code"]
            XCTAssertTrue(solo.waitForExistence(timeout: 12), "Onboarding braucht DEBUG Solo")
            solo.tap()
            XCTAssertTrue(tables.waitForExistence(timeout: 12))
        }
        tables.tap()

        let tableCard = app.descendants(matching: .any)["pos.table.Tisch 1"]
        XCTAssertTrue(tableCard.waitForExistence(timeout: 15))
        tableCard.tap()

        let bon = app.descendants(matching: .any)["pos.bon.open"]
        XCTAssertTrue(bon.waitForExistence(timeout: 10), "Bon-Dock sollte sichtbar sein")
        bon.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["pos.bon.sheet"].waitForExistence(timeout: 5)
                || app.navigationBars["Bon"].waitForExistence(timeout: 5),
            "Bon-Sheet sollte öffnen"
        )

        let schicken = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "schicken")).firstMatch
        guard schicken.waitForExistence(timeout: 3), schicken.isEnabled else {
            // Ohne Cart-Linien: Bon-Chrome reicht (wie BonSheetSmoke).
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
            "Zur Rechnung sollte Kassieren öffnen (nicht mehr SplitPay)"
        )
    }
}
