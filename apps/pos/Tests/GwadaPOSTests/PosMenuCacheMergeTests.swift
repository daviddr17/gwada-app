import XCTest
@testable import GwadaPOS

final class PosMenuCacheMergeTests: XCTestCase {
    func test_applyBootstrap_keepsMenuWhenUnchanged() {
        let hub = PosHubState.shared
        hub.configure(hubDeviceId: "test-hub")
        let first = DemoSnapshotFactory.makeBootstrap(hubDeviceId: "test-hub")
        var seeded = first
        seeded.menuRevision = "rev-1"
        hub.applyBootstrap(seeded)
        let menuCount = hub.menu?.items.count ?? 0
        XCTAssertGreaterThan(menuCount, 0)

        var floorOnly = first
        floorOnly.menuRevision = "rev-1"
        floorOnly.menuUnchanged = true
        floorOnly.menu = PosCloudMenuCatalog(categories: [], items: [], optionGroups: [])
        floorOnly.floor.openSessions = []
        hub.applyBootstrap(floorOnly)

        XCTAssertEqual(hub.menu?.items.count, menuCount)
        XCTAssertEqual(hub.menuRevision, "rev-1")
        XCTAssertTrue(hub.makeSnapshot().floor.openSessions.isEmpty)
    }
}
