import XCTest
@testable import GwadaPOS

final class PosCloudMenuSidesCodableTests: XCTestCase {
    func test_menuItem_decodesSideFields() throws {
        let json = Data(
            """
            {
              "id": "main-1",
              "name": "Schnitzel",
              "description": "",
              "priceCents": 1200,
              "sidePriceCents": 350,
              "sides": { "required": true, "max": 2, "includedCount": 1 },
              "vatRate": 19,
              "categoryId": "cat-main",
              "active": true
            }
            """.utf8
        )
        let item = try JSONDecoder().decode(PosCloudMenuItem.self, from: json)
        XCTAssertEqual(item.sidePriceCents, 350)
        XCTAssertEqual(item.sides, PosCloudMenuItemSideConfig(required: true, max: 2, includedCount: 1))
    }

    func test_menuItem_decodesWithoutSideFields() throws {
        let json = Data(
            """
            {
              "id": "main-1",
              "name": "Schnitzel",
              "priceCents": 1200,
              "vatRate": 19,
              "categoryId": "cat-main"
            }
            """.utf8
        )
        let item = try JSONDecoder().decode(PosCloudMenuItem.self, from: json)
        XCTAssertNil(item.sidePriceCents)
        XCTAssertNil(item.sides)
    }

    func test_menuItem_roundTripsSideFields() throws {
        let json = Data(
            """
            {
              "id": "main-1",
              "name": "Schnitzel",
              "description": "",
              "priceCents": 1200,
              "sidePriceCents": 350,
              "sides": { "required": true, "max": 2, "includedCount": 1 },
              "vatRate": 19,
              "categoryId": "cat-main",
              "active": true
            }
            """.utf8
        )
        let decoded = try JSONDecoder().decode(PosCloudMenuItem.self, from: json)
        let data = try JSONEncoder().encode(decoded)
        let roundTripped = try JSONDecoder().decode(PosCloudMenuItem.self, from: data)
        XCTAssertEqual(roundTripped, decoded)
        XCTAssertEqual(roundTripped.sidePriceCents, 350)
        XCTAssertEqual(roundTripped.sides?.max, 2)
    }
}
