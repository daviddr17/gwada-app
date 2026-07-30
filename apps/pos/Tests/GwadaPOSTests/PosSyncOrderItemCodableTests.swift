import XCTest
@testable import GwadaPOS

final class PosSyncOrderItemCodableTests: XCTestCase {
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
