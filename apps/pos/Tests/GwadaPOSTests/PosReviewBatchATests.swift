import XCTest
@testable import GwadaPOS

@MainActor
final class PosReviewBatchATests: XCTestCase {
    func test_settleCollectLines_isAtomicAndReturnsNilWhenEmpty() {
        let tableId = "rev-a-table-\(UUID().uuidString)"
        let sessionId = "rev-a-session-\(UUID().uuidString)"
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
                    sessionMetaBySessionId: [sessionId: PosLanSessionFloorMeta(orderCount: 1, openCents: 500)]
                ),
                menu: DemoSnapshotFactory.makeDemoMenu(),
                kitchen: nil
            )
        )
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sessionId) }

        PosHubState.shared.appendLocalOpenLines(
            sessionId: sessionId,
            from: [
                PosCartLine(
                    menuItemId: "item-cola",
                    name: "Cola",
                    unitPriceCents: 350,
                    quantity: 1,
                    course: 1,
                    notes: "",
                    modifiers: []
                ),
            ]
        )
        let lineId = PosHubState.shared.localOpenLines(sessionId: sessionId)[0].id
        let first = PosHubState.shared.settleCollectLines(sessionId: sessionId, lineIds: [lineId])
        XCTAssertNotNil(first)
        XCTAssertEqual(first?.paidCents, 350)
        XCTAssertEqual(first?.allocations.count, 1)
        // Second settle (race) → nil, nichts zu enqueueen
        XCTAssertNil(PosHubState.shared.settleCollectLines(sessionId: sessionId, lineIds: [lineId]))
        XCTAssertTrue(PosHubState.shared.localOpenLines(sessionId: sessionId).isEmpty)
    }

    func test_hubLanSettle_cashOnly() {
        XCTAssertTrue(PosSecurityPolicy.isHubLanSettleMethod(PosPaymentMethodKind.cash.rawValue))
        for method in [PosPaymentMethodKind.card, .paypal, .voucher] {
            XCTAssertFalse(
                PosSecurityPolicy.isHubLanSettleMethod(method.rawValue),
                method.rawValue
            )
        }
    }
}
