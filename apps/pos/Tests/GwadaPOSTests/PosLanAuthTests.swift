import XCTest
@testable import GwadaPOS

final class PosLanAuthTests: XCTestCase {
    func test_dataPaths_requireToken() {
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.snapshotPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.openSessionPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.createOrderPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.reservationsPath))
    }

    func test_openPaths_doNotRequireToken() {
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.healthPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairRequestPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairStatusPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairDebugApproveAllPath))
    }

    func test_kdsDataPaths_requireLanSecret_notPairToken() {
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsTicketsPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsAdvancePath))
        XCTAssertTrue(PosLanAuth.requiresKdsLanSecret(pathOnly: PosLanProtocol.kdsTicketsPath))
        XCTAssertTrue(PosLanAuth.requiresKdsLanSecret(pathOnly: PosLanProtocol.kdsAdvancePath))
        XCTAssertFalse(PosLanAuth.requiresKdsLanSecret(pathOnly: PosLanProtocol.kdsPath))
        XCTAssertFalse(PosLanAuth.requiresKdsLanSecret(pathOnly: PosLanProtocol.snapshotPath))
    }

    func test_hubLanSecret_persists() {
        PosHubLanSecret.resetForTests()
        let a = PosHubLanSecret.current()
        let b = PosHubLanSecret.current()
        XCTAssertFalse(a.isEmpty)
        XCTAssertEqual(a, b)
        PosHubLanSecret.resetForTests()
    }
}
