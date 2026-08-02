import XCTest
@testable import GwadaPOS

final class PosLocalCollectTests: XCTestCase {
    func testCollectLocalLinesRemovesPaidAndReducesOpenCents() {
        let tableId = "collect-\(UUID().uuidString)"
        let sessionId = "session-\(UUID().uuidString)"
        PosHubState.shared.applyBootstrap(
            PosCloudBootstrap(
                restaurantId: DemoSnapshotFactory.restaurantId,
                restaurantName: DemoSnapshotFactory.restaurantName,
                brandAccentHex: nil,
                generatedAt: ISO8601DateFormatter().string(from: Date()),
                register: PosCloudRegisterStatus(isOpen: true, sessionId: "reg", openedAt: nil),
                floor: PosLanFloorSnapshot(
                    areas: [],
                    tables: [
                        PosLanFloorTable(
                            id: tableId,
                            area_id: "a",
                            table_number: 1,
                            table_name: nil,
                            capacity: 4,
                            is_active: true
                        ),
                    ],
                    openSessions: [
                        PosLanOpenSession(
                            id: sessionId,
                            dining_table_id: tableId,
                            cover_count: 2,
                            opened_at: ISO8601DateFormatter().string(from: Date())
                        ),
                    ],
                    orderCountBySessionId: [sessionId: 1],
                    sessionMetaBySessionId: [sessionId: PosLanSessionFloorMeta(orderCount: 1, openCents: 3700)]
                ),
                menu: DemoSnapshotFactory.makeDemoMenu(),
                kitchen: nil
            )
        )
        defer {
            PosHubState.shared.clearLocalOpenLines(sessionId: sessionId)
        }

        PosHubState.shared.appendLocalOpenLines(
            sessionId: sessionId,
            from: [
                PosCartLine(
                    menuItemId: "item-schnitzel",
                    name: "Schnitzel",
                    unitPriceCents: 1850,
                    quantity: 2,
                    course: 2,
                    notes: "",
                    modifiers: []
                ),
            ]
        )
        let before = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(before.count, 1)
        let paid = PosHubState.shared.collectLocalLines(sessionId: sessionId, lineIds: Set(before.map(\.id)))
        XCTAssertEqual(paid, 3700)
        XCTAssertTrue(PosHubState.shared.localOpenLines(sessionId: sessionId).isEmpty)
        let meta = PosHubState.shared.makeSnapshot().floor.sessionMetaBySessionId[sessionId]
        XCTAssertEqual(meta?.openCents, 0)
    }
}
