import XCTest
@testable import GwadaPOS

final class PosSyncOrderItemCodableTests: XCTestCase {
    func testCreateOrderPayloadBatchesAllCartLinesIntoOneOrder() {
        let lines = [
            PosCartLine(
                menuItemId: "starter",
                name: "Starter",
                unitPriceCents: 800,
                quantity: 1,
                course: PosCourse.starter,
                notes: "first",
                modifiers: [.ohne(ingredientId: "onion", name: "Zwiebel")]
            ),
            PosCartLine(
                menuItemId: "main",
                name: "Main",
                unitPriceCents: 1_600,
                quantity: 2,
                course: PosCourse.main,
                notes: "",
                modifiers: [.option(choiceId: "large", name: "Groß", priceDeltaCents: 200)]
            ),
        ]

        let payload = PosSyncCreateOrderPayload.make(
            restaurantId: "restaurant",
            tableSessionId: "session",
            lines: lines,
            localOrderId: "local-order"
        )

        XCTAssertEqual(payload.localOrderId, "local-order")
        XCTAssertEqual(payload.items.count, 2)
        XCTAssertEqual(payload.items.map(\.menuItemId), ["starter", "main"])
        XCTAssertEqual(payload.items[0].course, PosCourse.starter)
        XCTAssertEqual(payload.items[0].ohneIngredientIds, ["onion"])
        XCTAssertEqual(payload.items[0].notes, "first")
        XCTAssertEqual(payload.items[1].course, PosCourse.main)
        XCTAssertEqual(payload.items[1].modifiers?.first?.optionChoiceId, "large")
        XCTAssertNil(payload.items[1].notes)
    }

    func testSyncOrderItemRoundTripKeepsCourseAndModifiers() throws {
        let item = PosSyncOrderItem(
            menuItemId: "m1", quantity: 2, notes: "extra",
            course: 1,
            ohneIngredientIds: ["ing-1"],
            modifiers: [
                PosCloudModifierPayload(
                    type: "option", label: "Groß", ingredientId: nil,
                    optionChoiceId: "c1", priceDeltaCents: 50
                ),
            ]
        )
        let data = try JSONEncoder().encode(item)
        let decoded = try JSONDecoder().decode(PosSyncOrderItem.self, from: data)
        XCTAssertEqual(decoded.course, 1)
        XCTAssertEqual(decoded.modifiers?.count, 1)
        XCTAssertEqual(decoded.ohneIngredientIds, ["ing-1"])
    }

    func testLegacyPayloadWithoutCourseStillDecodes() throws {
        let data = Data(#"{"menuItemId":"m1","quantity":1}"#.utf8)
        let decoded = try JSONDecoder().decode(PosSyncOrderItem.self, from: data)
        XCTAssertEqual(decoded.menuItemId, "m1")
        XCTAssertNil(decoded.course)
    }
}
