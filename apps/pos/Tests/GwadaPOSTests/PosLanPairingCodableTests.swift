import XCTest
@testable import GwadaPOS

final class PosLanPairingCodableTests: XCTestCase {
    func test_pairStatus_roundTrips() throws {
        let status = PosLanPairStatus(
            state: .approved,
            token: "tok_abc",
            hub: PosLanHubInfo(deviceId: "d1", displayName: "Kasse", role: "hub")
        )
        let data = try JSONEncoder().encode(status)
        let decoded = try JSONDecoder().decode(PosLanPairStatus.self, from: data)
        XCTAssertEqual(decoded, status)
        XCTAssertEqual(decoded.state, .approved)
        XCTAssertEqual(decoded.token, "tok_abc")
    }

    func test_pairState_decodesRawString() throws {
        let json = Data(#"{"state":"pending"}"#.utf8)
        let decoded = try JSONDecoder().decode(PosLanPairStatus.self, from: json)
        XCTAssertEqual(decoded.state, .pending)
        XCTAssertNil(decoded.token)
    }
}
