import XCTest
@testable import GwadaPOS

final class PosPairingStoreTests: XCTestCase {
    private func makeStore(now: @escaping () -> Date = { Date() }) -> PosPairingStore {
        let store = PosPairingStore(now: now, persistEnabled: false)
        store.configureHubInfo(PosLanHubInfo(deviceId: "hub1", displayName: "Kasse", role: "hub"))
        return store
    }

    private var req: PosLanPairRequest {
        PosLanPairRequest(deviceName: "iPhone Test", installationId: "install-123")
    }

    func test_createPending_producesSixDigitCodeAndPendingStatus() {
        let store = makeStore()
        let challenge = store.createPending(req)
        XCTAssertEqual(challenge.verificationCode.count, 6)
        XCTAssertTrue(challenge.verificationCode.allSatisfy(\.isNumber))
        XCTAssertEqual(store.status(pairId: challenge.pairId).state, .pending)
        XCTAssertEqual(store.pendingList().count, 1)
    }

    func test_approve_issuesTokenAndStatusApproved() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)
        XCTAssertNotNil(token)
        let status = store.status(pairId: challenge.pairId)
        XCTAssertEqual(status.state, .approved)
        XCTAssertEqual(status.token, token)
        XCTAssertEqual(store.pendingList().count, 0)
        XCTAssertEqual(store.approvedList().count, 1)
    }

    func test_verify_trueOnlyForIssuedToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        XCTAssertTrue(store.verify(token: token))
        XCTAssertFalse(store.verify(token: "nope"))
    }

    func test_reject_setsRejectedNoToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        store.reject(pairId: challenge.pairId)
        let status = store.status(pairId: challenge.pairId)
        XCTAssertEqual(status.state, .rejected)
        XCTAssertNil(status.token)
    }

    func test_pendingExpiresAfterTTL() {
        var current = Date(timeIntervalSince1970: 1_000_000)
        let store = makeStore(now: { current })
        let challenge = store.createPending(req)
        current = current.addingTimeInterval(store.pendingTTL + 1)
        XCTAssertEqual(store.status(pairId: challenge.pairId).state, .expired)
        XCTAssertEqual(store.pendingList().count, 0)
    }

    func test_revoke_invalidatesToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        store.revoke(token: token)
        XCTAssertFalse(store.verify(token: token))
        XCTAssertEqual(store.approvedList().count, 0)
    }

    func test_unknownPairId_isRejected() {
        let store = makeStore()
        XCTAssertEqual(store.status(pairId: "unknown").state, .rejected)
    }

    func test_approvedTokens_surviveNewStoreInstanceWhenPersisted() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("gwada-pair-test-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let first = PosPairingStore(now: { Date() }, persistEnabled: true, persistURL: url)
        first.configureHubInfo(PosLanHubInfo(deviceId: "hub1", displayName: "Kasse", role: "hub"))
        let challenge = first.createPending(req)
        let token = first.approve(pairId: challenge.pairId)!

        let second = PosPairingStore(now: { Date() }, persistEnabled: true, persistURL: url)
        XCTAssertTrue(second.verify(token: token))
        XCTAssertEqual(second.approvedList().count, 1)
    }

    func test_persistedFile_containsHashNotPlaintext() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("gwada-pair-hash-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let store = PosPairingStore(now: { Date() }, persistEnabled: true, persistURL: url)
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        let raw = try String(contentsOf: url, encoding: .utf8)
        XCTAssertFalse(raw.contains(token), "Klartext-Token darf nicht auf Disk liegen")
        XCTAssertTrue(raw.contains("tokenHashes") || raw.contains(PosTokenHash.sha256Hex(token)))
    }

    func test_status_deliversPlaintextTokenOnlyOnce() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        XCTAssertEqual(store.status(pairId: challenge.pairId).token, token)
        XCTAssertNil(store.status(pairId: challenge.pairId).token)
        XCTAssertEqual(store.status(pairId: challenge.pairId).state, .approved)
    }

    func test_tokenExpires_andRefreshWithinGrace() {
        var current = Date(timeIntervalSince1970: 2_000_000)
        let store = makeStore(now: { current })
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        XCTAssertTrue(store.verify(token: token))

        current = current.addingTimeInterval(store.tokenTTL + 1)
        XCTAssertFalse(store.verify(token: token), "nach TTL nicht mehr gültig")

        let refreshed = store.refresh(token: token)
        XCTAssertNotNil(refreshed, "innerhalb Grace noch refreshbar")
        XCTAssertNotEqual(refreshed?.token, token)
        XCTAssertTrue(store.verify(token: refreshed!.token))
        XCTAssertFalse(store.verify(token: token))
    }

    func test_refreshDenied_afterGrace() {
        var current = Date(timeIntervalSince1970: 3_000_000)
        let store = makeStore(now: { current })
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        current = current.addingTimeInterval(store.tokenTTL + store.refreshGraceTTL + 1)
        XCTAssertNil(store.refresh(token: token))
        XCTAssertFalse(store.verify(token: token))
    }

    func test_status_includesTokenExpiresAt() {
        let store = makeStore()
        let challenge = store.createPending(req)
        _ = store.approve(pairId: challenge.pairId)
        let status = store.status(pairId: challenge.pairId)
        XCTAssertEqual(status.state, .approved)
        XCTAssertNotNil(status.tokenExpiresAt)
    }

    func test_migratesLegacyPlaintextTokensFile() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("gwada-pair-legacy-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let legacyToken = "legacy-plain-token-abc"
        let legacyJSON = """
        {"tokens":["\(legacyToken)"],"approvedByPair":{}}
        """
        try Data(legacyJSON.utf8).write(to: url)

        let store = PosPairingStore(now: { Date() }, persistEnabled: true, persistURL: url)
        XCTAssertTrue(store.verify(token: legacyToken))
        let rewritten = try String(contentsOf: url, encoding: .utf8)
        XCTAssertFalse(rewritten.contains(legacyToken))
        XCTAssertTrue(rewritten.contains(PosTokenHash.sha256Hex(legacyToken)))
    }
}
