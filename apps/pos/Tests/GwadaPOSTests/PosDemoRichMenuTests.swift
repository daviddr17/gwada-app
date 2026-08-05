import XCTest
@testable import GwadaPOS

final class PosDemoRichMenuTests: XCTestCase {
    func test_demoMenu_hasBeilagenCategoryAndSideItems() {
        let menu = DemoSnapshotFactory.makeDemoMenu()
        XCTAssertTrue(menu.categories.contains { $0.name == "Beilagen" })
        let sides = PosMenuSidePool.sideItems(from: menu)
        XCTAssertEqual(Set(sides.map(\.name)), Set(["Pommes", "Kroketten"]))
        XCTAssertEqual(sides.first { $0.name == "Pommes" }?.priceCents, 450)
        XCTAssertEqual(sides.first { $0.name == "Pommes" }?.sidePriceCents, 450)
        XCTAssertEqual(sides.first { $0.name == "Kroketten" }?.priceCents, 490)
        XCTAssertEqual(sides.first { $0.name == "Kroketten" }?.sidePriceCents, 490)
    }

    func test_demoSchnitzel_hasRecipeAndSidesConfig() {
        let menu = DemoSnapshotFactory.makeDemoMenu()
        let schnitzel = menu.items.first { $0.id == "item-schnitzel" }
        XCTAssertEqual(schnitzel?.name, "Wiener Schnitzel")
        let recipeNames = Set(schnitzel?.recipe?.map(\.name) ?? [])
        XCTAssertEqual(recipeNames, Set(["Tomaten", "Zwiebeln"]))
        XCTAssertEqual(schnitzel?.sides?.required, false)
        XCTAssertEqual(schnitzel?.sides?.max, 2)
        XCTAssertEqual(schnitzel?.sides?.includedCount, 1)
    }

    func test_demo_optionGroups_empty() {
        XCTAssertTrue(DemoSnapshotFactory.makeDemoMenu().optionGroups.isEmpty)
    }
}
