import XCTest

enum PosUITestSessionHelpers {
    @MainActor
    static func ensureOrderingPhase(app: XCUIApplication) {
        let overview = app.descendants(matching: .any)["pos.session.overview"]
        guard overview.waitForExistence(timeout: 2) else { return }

        app.swipeUp()
        let order = app.descendants(matching: .any)["pos.session.overview.order"]
        let orderByLabel = app.buttons["Bestellen"].firstMatch
        if order.waitForExistence(timeout: 5) {
            tapHittable(order)
        } else if orderByLabel.waitForExistence(timeout: 5) {
            tapHittable(orderByLabel)
        }
        _ = overview.waitForExistence(timeout: 1)
    }

    @MainActor
    static func tapHittable(_ el: XCUIElement) {
        if el.isHittable {
            el.tap()
        } else {
            el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }
}
