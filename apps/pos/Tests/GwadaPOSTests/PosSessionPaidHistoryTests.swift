import XCTest
@testable import GwadaPOS

final class PosSessionPaidHistoryTests: XCTestCase {
    private func receipt(
        sessionId: String,
        status: String = "paid",
        paidAt: String = "2026-08-04T10:00:00Z",
        items: [PosLocalReceiptLine]
    ) -> PosLocalReceipt {
        PosLocalReceipt(
            localId: UUID().uuidString,
            paymentId: nil,
            orderId: nil,
            orderNumber: 1,
            tableSessionId: sessionId,
            tableLabel: "Tisch 1",
            diningTableId: "t1",
            method: "cash",
            status: status,
            amountCents: items.reduce(0) { $0 + $1.totalCents },
            tipCents: 0,
            receivedAmountCents: nil,
            paidAt: paidAt,
            fiscalPending: false,
            canVoidCash: true,
            dayYmd: "2026-08-04",
            label: nil,
            items: items,
            waiterName: nil,
            tse: nil
        )
    }

    func test_rebuild_empty() {
        XCTAssertTrue(PosSessionPaidHistory.rebuild(from: []).isEmpty)
    }

    func test_rebuild_mergesPartialPays() {
        let sid = "hist-session-\(UUID().uuidString)"
        let r1 = receipt(
            sessionId: sid,
            paidAt: "2026-08-04T10:00:00Z",
            items: [
                PosLocalReceiptLine(quantity: 1, name: "Schnitzel", detail: "", totalCents: 1850, course: 2)
            ]
        )
        let r2 = receipt(
            sessionId: sid,
            paidAt: "2026-08-04T10:05:00Z",
            items: [
                PosLocalReceiptLine(quantity: 1, name: "Schnitzel", detail: "", totalCents: 1850, course: 2)
            ]
        )
        let lines = PosSessionPaidHistory.rebuild(from: [r1, r2])
        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].quantity, 2)
        XCTAssertEqual(lines[0].amountCents, 3700)
        XCTAssertEqual(lines[0].lastPaidAt, "2026-08-04T10:05:00Z")
    }

    func test_rebuild_ignoresVoided() {
        let sid = "hist-void-\(UUID().uuidString)"
        let paid = receipt(
            sessionId: sid,
            items: [PosLocalReceiptLine(quantity: 1, name: "Cola", detail: "", totalCents: 350, course: 2)]
        )
        let voided = receipt(
            sessionId: sid,
            status: "voided",
            items: [PosLocalReceiptLine(quantity: 1, name: "Cola", detail: "", totalCents: 350, course: 2)]
        )
        let lines = PosSessionPaidHistory.rebuild(from: [paid, voided])
        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].quantity, 1)
    }

    func test_storeRebuildAndClear() {
        let sid = "hist-store-\(UUID().uuidString)"
        defer {
            PosPaidHistoryStore.clear(sessionId: sid)
            PosLocalStore.flushForTests()
            PosPaidHistoryStore.resetCacheForTests()
        }
        PosPaidHistoryStore.resetCacheForTests()
        let built = PosPaidHistoryStore.rebuild(
            sessionId: sid,
            receipts: [
                receipt(
                    sessionId: sid,
                    items: [
                        PosLocalReceiptLine(quantity: 1, name: "Bier", detail: "", totalCents: 400, course: 2)
                    ]
                )
            ]
        )
        XCTAssertEqual(built.count, 1)
        XCTAssertEqual(PosPaidHistoryStore.lines(sessionId: sid).count, 1)
        PosPaidHistoryStore.clear(sessionId: sid)
        XCTAssertTrue(PosPaidHistoryStore.lines(sessionId: sid).isEmpty)
    }

    func test_startPhase_matrix() {
        let open = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Cola",
            openQuantity: 1, openCents: 350, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 350
        )
        XCTAssertEqual(
            PosSessionOverviewMath.startPhase(openLines: [], historyNonEmpty: false),
            .ordering
        )
        XCTAssertEqual(
            PosSessionOverviewMath.startPhase(openLines: [open], historyNonEmpty: false),
            .overview
        )
        XCTAssertEqual(
            PosSessionOverviewMath.startPhase(openLines: [], historyNonEmpty: true),
            .history
        )
        XCTAssertEqual(
            PosSessionOverviewMath.startPhase(openLines: [open], historyNonEmpty: true),
            .overview
        )
    }
}
