import XCTest
@testable import GwadaPOS

final class PosSecurityBatchBTests: XCTestCase {
    func test_appendLocalOpenLines_usesCartLineIds() {
        let sessionId = "sess-b-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sessionId) }

        var line = PosCartLine(
            menuItemId: "m1",
            name: "Cola",
            unitPriceCents: 350,
            quantity: 1,
            course: PosCourse.default,
            notes: "",
            modifiers: []
        )
        line.id = "client-line-fixed-1"

        let ids = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: [line])
        XCTAssertEqual(ids, ["client-line-fixed-1"])
        let open = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(open.map(\.id), ["client-line-fixed-1"])
        XCTAssertEqual(open.map(\.orderLineId), ["client-line-fixed-1"])
    }

    func test_remapOpenLineIds_rewritesLocalToCloud() {
        let sessionId = "sess-remap-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sessionId) }

        var line = PosCartLine(
            menuItemId: "m1",
            name: "Bier",
            unitPriceCents: 400,
            quantity: 1,
            course: PosCourse.default,
            notes: "",
            modifiers: []
        )
        line.id = "local-1"
        _ = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: [line])

        PosHubState.shared.remapOpenLineIds(
            sessionId: sessionId,
            mappings: [(localLineId: "local-1", cloudLineId: "cloud-99")]
        )
        let open = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(open.first?.id, "cloud-99")
        XCTAssertEqual(open.first?.orderLineId, "cloud-99")
    }

    func test_orderLineIdMap_resolveAndRemember() {
        let local = "local-\(UUID().uuidString)"
        let cloud = "cloud-\(UUID().uuidString)"
        PosOrderLineIdMap.shared.remember(localLineId: local, cloudLineId: cloud)
        XCTAssertEqual(PosOrderLineIdMap.shared.resolve(local), cloud)
        XCTAssertEqual(PosOrderLineIdMap.shared.resolve(cloud), cloud)
    }

    func test_tokenHash_isStableSha256Hex() {
        let hash = PosTokenHash.sha256Hex("abc")
        XCTAssertEqual(hash.count, 64)
        XCTAssertEqual(hash, PosTokenHash.sha256Hex("abc"))
        XCTAssertNotEqual(hash, PosTokenHash.sha256Hex("abd"))
    }
}
