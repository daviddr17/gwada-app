import XCTest
@testable import GwadaPOS

final class PosSecurityBatchATests: XCTestCase {
    func testValidateCollectRejectsUnknownLineIds() {
        let tableId = "sec-table-\(UUID().uuidString)"
        let sessionId = "sec-session-\(UUID().uuidString)"
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
                    sessionMetaBySessionId: [sessionId: PosLanSessionFloorMeta(orderCount: 1, openCents: 1850)]
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
                    menuItemId: "item-schnitzel",
                    name: "Schnitzel",
                    unitPriceCents: 1850,
                    quantity: 1,
                    course: 2,
                    notes: "",
                    modifiers: []
                ),
            ]
        )
        let realId = PosHubState.shared.localOpenLines(sessionId: sessionId)[0].id
        XCTAssertEqual(
            PosHubState.shared.validateCollectLines(sessionId: sessionId, lineIds: [realId, "ghost"]),
            .unknownLines
        )
        XCTAssertEqual(
            PosHubState.shared.collectLocalLines(sessionId: sessionId, lineIds: [realId, "ghost"]),
            0
        )
        XCTAssertEqual(PosHubState.shared.localOpenLines(sessionId: sessionId).count, 1)
    }

    func testCollectAttemptIdIsIdempotent() {
        let id = "attempt-\(UUID().uuidString)"
        XCTAssertTrue(PosHubState.shared.registerCollectAttemptId(id))
        XCTAssertFalse(PosHubState.shared.registerCollectAttemptId(id))
    }

    func testAllowedCollectMethods() {
        XCTAssertTrue(PosSecurityPolicy.isAllowedCollectMethod("cash"))
        XCTAssertTrue(PosSecurityPolicy.isAllowedCollectMethod("card"))
        XCTAssertFalse(PosSecurityPolicy.isAllowedCollectMethod("bitcoin"))
        XCTAssertTrue(PosSecurityPolicy.isHubLanSettleMethod("cash"))
        XCTAssertFalse(PosSecurityPolicy.isHubLanSettleMethod("voucher"))
        XCTAssertFalse(PosSecurityPolicy.isHubLanSettleMethod("card"))
        XCTAssertFalse(PosSecurityPolicy.isHubLanSettleMethod("paypal"))
    }

    func testMakeReceiptAttachesDemoTseOnlyWhenPolicyAllows() {
        let line = SessionOpenLine(
            id: "l1",
            orderLineId: "l1",
            name: "Cola",
            openQuantity: 1,
            openCents: 400,
            course: 2,
            firedAt: nil,
            detail: "",
            menuItemId: nil
        )
        let receipt = PosOfflineCaches.makeReceipt(
            sessionId: "s1",
            tableLabel: "Tisch 1",
            diningTableId: "t1",
            lines: [line],
            method: .cash,
            tipCents: 0,
            receivedAmountCents: 500,
            label: nil,
            waiterName: "Test"
        )
        #if DEBUG
        XCTAssertNotNil(receipt.tse)
        XCTAssertTrue(PosSecurityPolicy.allowsDemoFiscalTse)
        #else
        XCTAssertNil(receipt.tse)
        XCTAssertFalse(PosSecurityPolicy.allowsDemoFiscalTse)
        #endif
    }
}
