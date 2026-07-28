import XCTest
@testable import GwadaPOS

final class PosLanAuthTests: XCTestCase {
    func test_dataPaths_requireToken() {
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.snapshotPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.openSessionPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.createOrderPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.reservationsPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsTicketsPath))
    }

    func test_openPaths_doNotRequireToken() {
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.healthPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairRequestPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairStatusPath))
    }
}
