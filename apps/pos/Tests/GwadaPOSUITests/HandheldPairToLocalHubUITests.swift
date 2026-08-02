import XCTest

/// iPhone → Hub unter 127.0.0.1:8787 — wartet auf Freigabe am iPad.
/// Ohne Hub: XCTSkip. Mit `-UITestingResetEnrollment` frischer Onboarding-Stand.
final class HandheldPairToLocalHubUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testStartPairingAgainstLocalHub() throws {
        try XCTSkipUnless(hubHealthOk(), "iPad-Hub :8787 nicht erreichbar — Pair-UITest übersprungen")

        let app = XCUIApplication()
        app.launchArguments += ["-UITestingResetEnrollment"]
        app.launch()

        let openLan = app.buttons["Stattdessen mit iPad-Kasse koppeln"]
        XCTAssertTrue(openLan.waitForExistence(timeout: 12), "Onboarding erwartet (ResetEnrollment)")
        openLan.tap()

        let host = app.textFields.firstMatch
        XCTAssertTrue(host.waitForExistence(timeout: 8), "Pairing-Sheet erwartet")
        host.tap()
        if let value = host.value as? String, !value.isEmpty {
            host.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count))
        }
        host.typeText("127.0.0.1:8787")

        let pair = app.buttons["Koppeln"]
        XCTAssertTrue(pair.waitForExistence(timeout: 8))
        pair.tap()

        XCTAssertTrue(
            app.staticTexts["Warte auf Freigabe am iPad"].waitForExistence(timeout: 15),
            "Nach Koppeln sollte der Warte-Screen mit Code erscheinen"
        )
    }

    private func hubHealthOk() -> Bool {
        let exp = expectation(description: "hub-health")
        var ok = false
        URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8787/v1/health")!) { _, response, _ in
            ok = (response as? HTTPURLResponse)?.statusCode == 200
            exp.fulfill()
        }.resume()
        wait(for: [exp], timeout: 2)
        return ok
    }
}
