import XCTest
@testable import GwadaPOS

final class PosHandheldSnapshotCacheTests: XCTestCase {
    func test_saveAndLoad_roundTrip() {
        let snap = DemoSnapshotFactory.makeSnapshot(hubDeviceId: "cache-test-hub")
        PosHandheldSnapshotCache.save(snap)
        PosHandheldSnapshotCache.flushForTests()
        let loaded = PosHandheldSnapshotCache.load()
        XCTAssertEqual(loaded?.restaurantId, snap.restaurantId)
        XCTAssertEqual(loaded?.hub.deviceId, snap.hub.deviceId)
        XCTAssertEqual(loaded?.floor.tables.count, snap.floor.tables.count)
        XCTAssertNotNil(loaded?.menu)
        PosHandheldSnapshotCache.clear()
        PosHandheldSnapshotCache.flushForTests()
    }

    func test_clear_removesFile() {
        let snap = DemoSnapshotFactory.makeSnapshot(hubDeviceId: "cache-clear-hub")
        PosHandheldSnapshotCache.save(snap)
        PosHandheldSnapshotCache.flushForTests()
        XCTAssertNotNil(PosHandheldSnapshotCache.load())
        PosHandheldSnapshotCache.clear()
        PosHandheldSnapshotCache.flushForTests()
        XCTAssertNil(PosHandheldSnapshotCache.load())
    }
}
