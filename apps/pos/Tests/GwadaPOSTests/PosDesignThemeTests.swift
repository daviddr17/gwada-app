import XCTest
@testable import GwadaPOS

final class PosDesignThemeTests: XCTestCase {
    func testStatusDotColorsDistinct() {
        let all = PosTableVisualStatus.allCases.map(PosDesign.statusDotColor(for:))
        // At least frei vs besetzt vs bezahlt must differ (compare UIColor in light)
        let light = UITraitCollection(userInterfaceStyle: .light)
        let resolved = all.map { UIColor($0).resolvedColor(with: light) }
        XCTAssertNotEqual(resolved[0], resolved[1])
    }
}
