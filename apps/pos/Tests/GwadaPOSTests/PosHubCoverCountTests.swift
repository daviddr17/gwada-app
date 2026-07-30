import XCTest
@testable import GwadaPOS

final class PosHubCoverCountTests: XCTestCase {
    func testUpdateCoverCountMutatesOpenSession() {
        let tableId = "cover-test-\(UUID().uuidString)"
        seedBootstrap(tableId: tableId)
        let sessionId = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: 2)

        XCTAssertTrue(PosHubState.shared.updateCoverCount(sessionId: sessionId, count: 4))

        let session = PosHubState.shared.makeSnapshot().floor.openSessions.first { $0.id == sessionId }
        XCTAssertEqual(session?.cover_count, 4)
    }

    func testUpdateCoverCountClampsToValidRange() {
        let tableId = "cover-test-\(UUID().uuidString)"
        seedBootstrap(tableId: tableId)
        let sessionId = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: 2)

        XCTAssertTrue(PosHubState.shared.updateCoverCount(sessionId: sessionId, count: 0))
        XCTAssertEqual(
            PosHubState.shared.makeSnapshot().floor.openSessions.first { $0.id == sessionId }?.cover_count,
            1
        )

        XCTAssertTrue(PosHubState.shared.updateCoverCount(sessionId: sessionId, count: 99))
        XCTAssertEqual(
            PosHubState.shared.makeSnapshot().floor.openSessions.first { $0.id == sessionId }?.cover_count,
            50
        )
    }

    private func seedBootstrap(tableId: String) {
        PosHubState.shared.applyBootstrap(
            PosCloudBootstrap(
                restaurantId: DemoSnapshotFactory.restaurantId,
                restaurantName: DemoSnapshotFactory.restaurantName,
                brandAccentHex: nil,
                generatedAt: ISO8601DateFormatter().string(from: Date()),
                register: PosCloudRegisterStatus(isOpen: true, sessionId: "register-test", openedAt: nil),
                floor: PosLanFloorSnapshot(
                    areas: [],
                    tables: [
                        PosLanFloorTable(
                            id: tableId,
                            area_id: "area-test",
                            table_number: 99,
                            table_name: nil,
                            capacity: 4,
                            is_active: true
                        ),
                    ],
                    openSessions: [],
                    orderCountBySessionId: [:],
                    sessionMetaBySessionId: [:]
                ),
                menu: PosCloudMenuCatalog(categories: [], items: [], optionGroups: []),
                kitchen: nil
            )
        )
    }
}
