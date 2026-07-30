import XCTest
@testable import GwadaPOS

final class PosCartSignatureTests: XCTestCase {
    func testSignatureIgnoresModifierOrder() {
        let a = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "",
            modifiers: [
                .option(choiceId: "o2", name: "Scharf", priceDeltaCents: 0),
                .option(choiceId: "o1", name: "Pommes", priceDeltaCents: 100),
            ]
        )
        let b = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "",
            modifiers: [
                .option(choiceId: "o1", name: "Pommes", priceDeltaCents: 100),
                .option(choiceId: "o2", name: "Scharf", priceDeltaCents: 0),
            ]
        )
        XCTAssertEqual(a.configurationSignature, b.configurationSignature)
    }

    func testSignatureDiffersOnNotesCourseAndSides() {
        let base = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "", modifiers: []
        )
        var withNote = base
        withNote.notes = "ohne Zwiebel"
        var otherCourse = base
        otherCourse.course = 1
        var withSide = base
        withSide.modifiers = [
            PosCartModifier(
                id: "side-s1", type: "side", label: "Beilage: Salat",
                ingredientId: nil, optionChoiceId: "s1", priceDeltaCents: 200
            )
        ]
        XCTAssertNotEqual(base.configurationSignature, withNote.configurationSignature)
        XCTAssertNotEqual(base.configurationSignature, otherCourse.configurationSignature)
        XCTAssertNotEqual(base.configurationSignature, withSide.configurationSignature)
    }
}
