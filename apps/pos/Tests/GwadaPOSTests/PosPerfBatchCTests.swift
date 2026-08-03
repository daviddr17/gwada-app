import XCTest
@testable import GwadaPOS

final class PosPerfBatchCTests: XCTestCase {
    func test_encodedSnapshotJSON_cachedForSameVersion() {
        PosHubState.shared.loadCachedOrDemo()
        let first = PosHubState.shared.encodedSnapshotJSON()
        let second = PosHubState.shared.encodedSnapshotJSON()
        XCTAssertEqual(first, second)
        XCTAssertFalse(first.isEmpty)
    }

    func test_encodedSnapshotJSON_changesAfterVersionBump() {
        PosHubState.shared.loadCachedOrDemo()
        let before = PosHubState.shared.encodedSnapshotJSON()
        let versionBefore = PosHubState.shared.makeSnapshot().snapshotVersion
        PosHubState.shared.bumpSnapshotVersion()
        let after = PosHubState.shared.encodedSnapshotJSON()
        let versionAfter = PosHubState.shared.makeSnapshot().snapshotVersion
        XCTAssertNotEqual(versionBefore, versionAfter)
        // generatedAt / version field differ → bytes differ
        XCTAssertNotEqual(before, after)
    }

    func test_makeSnapshot_stableGeneratedAtWithinVersion() {
        PosHubState.shared.loadCachedOrDemo()
        let a = PosHubState.shared.makeSnapshot()
        let b = PosHubState.shared.makeSnapshot()
        XCTAssertEqual(a.generatedAt, b.generatedAt)
        XCTAssertEqual(a.snapshotVersion, b.snapshotVersion)
    }

    func test_localStore_saveBootstrapDoesNotBlockCaller() {
        // Smoke: async schedule returns quickly; flush completes write.
        let demo = DemoSnapshotFactory.makeBootstrap(hubDeviceId: "perf-test-hub")
        PosLocalStore.saveBootstrap(demo)
        PosLocalStore.flushForTests()
        let loaded = PosLocalStore.loadBootstrap()
        XCTAssertEqual(loaded?.restaurantId, demo.restaurantId)
    }
}
