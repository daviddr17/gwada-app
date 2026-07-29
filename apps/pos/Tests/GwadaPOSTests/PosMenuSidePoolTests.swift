import XCTest
@testable import GwadaPOS

final class PosMenuSidePoolTests: XCTestCase {
    func test_sideItems_returnsOnlyActiveBeilagenCategoryItems() throws {
        let json = Data(
            """
            {
              "categories": [
                { "id": "cat-main", "name": "Hauptgerichte", "sortOrder": 0 },
                { "id": "cat-sides", "name": "Beilagen", "sortOrder": 1 }
              ],
              "items": [
                {
                  "id": "main-1",
                  "name": "Schnitzel",
                  "priceCents": 1200,
                  "vatRate": 19,
                  "categoryId": "cat-main",
                  "active": true
                },
                {
                  "id": "side-1",
                  "name": "Pommes",
                  "priceCents": 450,
                  "sidePriceCents": 350,
                  "vatRate": 19,
                  "categoryId": "cat-sides",
                  "active": true
                },
                {
                  "id": "side-2",
                  "name": "Salat",
                  "priceCents": 400,
                  "sidePriceCents": 300,
                  "vatRate": 19,
                  "categoryId": "cat-sides",
                  "active": false
                }
              ],
              "optionGroups": []
            }
            """.utf8
        )
        let catalog = try JSONDecoder().decode(PosCloudMenuCatalog.self, from: json)
        let sides = PosMenuSidePool.sideItems(from: catalog)
        XCTAssertEqual(sides.map(\.id), ["side-1"])
    }

    func test_optionGroup_isSelectionCountValid() {
        let group = PosCloudMenuOptionGroup(
            id: "og-1",
            name: "Extras",
            active: true,
            minSelect: 1,
            maxSelect: 2,
            choices: []
        )
        XCTAssertFalse(group.isSelectionCountValid(0))
        XCTAssertTrue(group.isSelectionCountValid(1))
        XCTAssertTrue(group.isSelectionCountValid(2))
        XCTAssertFalse(group.isSelectionCountValid(3))
    }
}
