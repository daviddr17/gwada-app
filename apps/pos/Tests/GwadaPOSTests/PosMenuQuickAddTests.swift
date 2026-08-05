import XCTest
@testable import GwadaPOS

final class PosMenuQuickAddTests: XCTestCase {
    func test_plainItem_quickAdds() {
        let item = PosCloudMenuItem.demo(
            id: "cola",
            name: "Cola",
            description: "",
            priceCents: 390,
            categoryId: "drinks"
        )
        XCTAssertTrue(PosMenuQuickAdd.shouldQuickAdd(item: item, optionGroups: []))
    }

    func test_optionalSides_opensSheet() {
        let item = PosCloudMenuItem(
            id: "item-schnitzel",
            name: "Wiener Schnitzel",
            description: "",
            priceCents: 1850,
            sidePriceCents: nil,
            sides: PosCloudMenuItemSideConfig(required: false, max: 2, includedCount: 1),
            vatRate: 0.19,
            categoryId: "main",
            listNumber: nil,
            optionGroupIds: [],
            recipe: nil,
            active: true
        )
        XCTAssertFalse(PosMenuQuickAdd.shouldQuickAdd(item: item, optionGroups: []))
    }

    func test_recipe_opensSheet() {
        let item = PosCloudMenuItem(
            id: "item-schnitzel",
            name: "Wiener Schnitzel",
            description: "",
            priceCents: 1850,
            sidePriceCents: nil,
            sides: nil,
            vatRate: 0.19,
            categoryId: "main",
            listNumber: nil,
            optionGroupIds: [],
            recipe: [
                PosCloudRecipeIngredient(ingredientId: "t", name: "Tomaten", amount: 1),
            ],
            active: true
        )
        XCTAssertFalse(PosMenuQuickAdd.shouldQuickAdd(item: item, optionGroups: []))
    }

    func test_demoSchnitzel_opensSheet() {
        let menu = DemoSnapshotFactory.makeDemoMenu()
        let schnitzel = try! XCTUnwrap(menu.items.first { $0.id == "item-schnitzel" })
        XCTAssertFalse(PosMenuQuickAdd.shouldQuickAdd(item: schnitzel, optionGroups: menu.optionGroups))
    }
}
