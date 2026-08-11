import XCTest
@testable import GwadaPOS

final class PosSessionMoveTests: XCTestCase {
    func testMoveSessionPath_matchesLANContract() {
        XCTAssertEqual(PosLanProtocol.moveSessionPath, "/v1/sessions/move")
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.moveSessionPath))
    }

    @MainActor
    func testHubMovePersistence_finishesBeforeReturning() async {
        PosSyncQueue.shared.clearAll()
        defer { PosSyncQueue.shared.clearAll() }
        let payload = PosSyncMoveSessionPayload(
            restaurantId: "restaurant-1",
            tableSessionId: "session-1",
            toTableId: "table-2"
        )

        await Task.detached {
            PosRuntime.persistHubSessionMove(payload)
        }.value

        XCTAssertEqual(PosSyncQueue.shared.items.first?.kind, .moveSession)
        XCTAssertEqual(PosSyncQueue.shared.pendingCount, 1)
    }

    func testMoveLocalSession_relocatesOpenSessionToFreeTable() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let from = tables[0].id
        let to = tables[1].id
        let sessionId = hub.openLocalSession(diningTableId: from, coverCount: 2)

        XCTAssertTrue(hub.moveLocalSession(sessionId: sessionId, toTableId: to))
        let moved = hub.makeSnapshot().floor.openSessions.first(where: { $0.id == sessionId })
        XCTAssertEqual(moved?.dining_table_id, to)

        // Ziel bereits belegt durch dieselbe Session → zweiter Move auf denselben Tisch failt.
        XCTAssertFalse(hub.moveLocalSession(sessionId: sessionId, toTableId: to))
    }

    private func makeHub() -> PosHubState {
        let hub = PosHubState.shared
        hub.resetForFactoryReset()
        PosLocalStore.saveOpenLines([:])
        PosLocalStore.saveKassierenLocks([:])
        PosLocalStore.flushForTests()
        PosDraftCartStore.clearAll()
        hub.configure(hubDeviceId: "move-test-hub")
        hub.applyBootstrap(DemoSnapshotFactory.makeBootstrap(hubDeviceId: "move-test-hub"))
        return hub
    }
}
