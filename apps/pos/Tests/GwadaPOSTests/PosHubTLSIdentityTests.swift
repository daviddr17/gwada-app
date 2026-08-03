import XCTest
@testable import GwadaPOS

final class PosHubTLSIdentityTests: XCTestCase {
    func test_loadOrCreate_producesIdentityAndFingerprint() throws {
        PosHubTLSIdentity.resetForTests()
        let identity = try PosHubTLSIdentity.loadOrCreate()
        let fp = try XCTUnwrap(PosHubTLSIdentity.certificateFingerprintSHA256Hex(identity: identity))
        XCTAssertEqual(fp.count, 64)
        XCTAssertTrue(fp.allSatisfy(\.isHexDigit))

        let again = try PosHubTLSIdentity.loadOrCreate()
        let fp2 = try XCTUnwrap(PosHubTLSIdentity.certificateFingerprintSHA256Hex(identity: again))
        XCTAssertEqual(fp, fp2)
        PosHubTLSIdentity.resetForTests()
    }

    func test_hubBaseURL_usesHttps() {
        let url = PosLanProtocol.hubBaseURL(host: "192.168.1.10")
        XCTAssertEqual(url.scheme, "https")
        XCTAssertEqual(url.port, Int(PosLanProtocol.hubPort))
        XCTAssertEqual(
            PosLanProtocol.normalizeHubBaseURLString("http://127.0.0.1:8787"),
            "https://127.0.0.1:8787"
        )
    }
}
