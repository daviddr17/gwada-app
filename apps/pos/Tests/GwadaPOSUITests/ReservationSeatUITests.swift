import XCTest

/// Solo UI-Walk + Seat/Platzieren mit Screenshots unter /tmp/gwada-pos-ui-shots.
final class ReservationSeatUITests: XCTestCase {
    private let shotDir = "/tmp/gwada-pos-ui-shots"

    override func setUpWithError() throws {
        continueAfterFailure = true
        try? FileManager.default.createDirectory(
            atPath: shotDir,
            withIntermediateDirectories: true
        )
    }

    @MainActor
    func testSeatFlow_screenshots() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-UITesting", "-UITestingResetEnrollment"]
        app.launch()

        try reachTablesViaSolo(app: app)
        shot(app, "02-tables-home")

        // Floor: Seat-Hint (Demo-Resa oft ohne festen Tisch → Hint auf freien Tischen)
        let floorHint = app.descendants(matching: .any)["pos.floor.seatHint"].firstMatch
        if floorHint.waitForExistence(timeout: 8) {
            shot(app, "03-floor-with-seat-hint")
            floorHint.tap()
            XCTAssertTrue(
                app.navigationBars["Platzieren"].waitForExistence(timeout: 8)
                    || app.descendants(matching: .any)["pos.seat.sheet"].waitForExistence(timeout: 5),
                "Seat-Sheet vom Floor-Hint"
            )
            shot(app, "04-seat-sheet-from-floor")
            if app.buttons["Abbrechen"].waitForExistence(timeout: 2) {
                app.buttons["Abbrechen"].tap()
            } else {
                app.swipeDown()
            }
            _ = app.tabBars.buttons["Tische"].waitForExistence(timeout: 5)
        } else {
            shot(app, "03-floor-no-seat-hint")
        }

        // Timeline: expand confirmed card → Platzieren
        app.tabBars.buttons["Reservierungen"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["pos.reservations.dateStrip"].waitForExistence(timeout: 12)
                || app.buttons["Walk-in"].waitForExistence(timeout: 5)
        )
        shot(app, "05-reservations-tab")

        // Demo: Anna Müller confirmed
        let anna = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Anna")).firstMatch
        if anna.waitForExistence(timeout: 8) {
            anna.tap()
            shot(app, "06-reservation-card-expanded")
            let seatBtn = app.descendants(matching: .any)["pos.reservations.seat"].firstMatch
            let seatByLabel = app.buttons["Platzieren"].firstMatch
            if seatBtn.waitForExistence(timeout: 5) {
                seatBtn.tap()
            } else if seatByLabel.waitForExistence(timeout: 3) {
                seatByLabel.tap()
            } else {
                XCTFail("Platzieren-Button auf confirmed-Karte fehlt")
                shot(app, "06b-no-platzieren-button")
                return
            }
            XCTAssertTrue(
                app.navigationBars["Platzieren"].waitForExistence(timeout: 8),
                "Seat-Sheet von Timeline"
            )
            shot(app, "07-seat-sheet-from-timeline")

            let confirm = app.descendants(matching: .any)["pos.seat.confirm"].firstMatch
            let confirmLabel = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "platzieren")).firstMatch
            if confirm.waitForExistence(timeout: 3), confirm.isEnabled {
                confirm.tap()
            } else if confirmLabel.waitForExistence(timeout: 3), confirmLabel.isEnabled {
                confirmLabel.tap()
            } else {
                // Tisch wählen falls nötig
                let tableRow = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Tisch")).firstMatch
                if tableRow.waitForExistence(timeout: 3) {
                    tableRow.tap()
                    shot(app, "07b-table-selected")
                    if confirm.waitForExistence(timeout: 2) { confirm.tap() }
                    else if confirmLabel.waitForExistence(timeout: 2) { confirmLabel.tap() }
                } else {
                    shot(app, "07c-cannot-confirm")
                }
            }

            // Nach Erfolg: Session oder Tabs
            sleep(2)
            shot(app, "08-after-seat")
            let onSession = app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS[c] %@", "Tisch"))
                .firstMatch.waitForExistence(timeout: 8)
                || app.navigationBars["Tisch 1"].waitForExistence(timeout: 3)
                || app.navigationBars["Tisch 2"].waitForExistence(timeout: 2)
            if onSession {
                shot(app, "09-table-session-after-seat")
            } else {
                shot(app, "09-no-session-navigation")
            }
        } else {
            shot(app, "05b-no-anna-demo")
            XCTFail("Demo-Reservierung Anna nicht sichtbar")
        }

        // Walk-in Sheet smoke — nur wenn Tab-Leiste sichtbar (nicht in Session-Push)
        if app.tabBars.buttons["Tische"].waitForExistence(timeout: 3) {
            app.tabBars.buttons["Tische"].tap()
            if app.buttons["Walk-in"].waitForExistence(timeout: 5) {
                app.buttons["Walk-in"].tap()
                shot(app, "10-walkin-sheet")
                if app.buttons["Abbrechen"].waitForExistence(timeout: 2) {
                    app.buttons["Abbrechen"].tap()
                }
            }

            if app.tabBars.buttons["Mehr"].waitForExistence(timeout: 3) {
                app.tabBars.buttons["Mehr"].tap()
                shot(app, "11-mehr-tab")
                app.tabBars.buttons["Tische"].tap()
                shot(app, "12-tables-final")
                XCTAssertTrue(
                    app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "von 2 Tischen")).firstMatch
                        .waitForExistence(timeout: 5),
                    "Immer 2 Demo-Tische"
                )
            }
        }
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
        if soloCode.waitForExistence(timeout: 12) {
            soloCode.tap()
        } else if soloKasse.waitForExistence(timeout: 4) {
            soloKasse.tap()
        } else {
            shot(app, "01-no-solo-entry")
            XCTFail("Kein Solo-Debug-Einstieg")
            return
        }
        XCTAssertTrue(tables.waitForExistence(timeout: 15))
        tables.tap()
        shot(app, "01-after-solo")
    }

    @MainActor
    private func shot(_ app: XCUIApplication, _ name: String) {
        let path = "\(shotDir)/\(name).png"
        let shot = app.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let data = shot.pngRepresentation as Data? {
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }
}
