import XCTest
@testable import GwadaPOS

@MainActor
final class PosSyncQueuePhase5Tests: XCTestCase {
    override func setUp() {
        super.setUp()
        // Queue is a singleton with disk — clear by replacing items via known API.
        while PosSyncQueue.shared.pendingCount > 0 {
            // Drain by removing through private persist isn't exposed; enqueue with unique then we test dedupe only.
            break
        }
    }

    func test_enqueueCollectCash_dedupesByPaymentAttemptId() {
        let attempt = "phase5-attempt-\(UUID().uuidString)"
        let payload = PosSyncCollectCashPayload(
            restaurantId: "r1",
            tableSessionId: "s1",
            allocations: [PosSyncCashAllocation(orderLineId: "l1", quantity: 1)],
            tipCents: 0,
            receivedAmountCents: nil,
            paymentAttemptId: attempt,
            receiptLocalId: "receipt-1",
            method: "cash",
            amountCents: 500
        )
        let before = PosSyncQueue.shared.pendingCount
        PosSyncQueue.shared.enqueueCollectCash(payload)
        PosSyncQueue.shared.enqueueCollectCash(payload)
        XCTAssertEqual(PosSyncQueue.shared.pendingCount, before + 1)
        XCTAssertTrue(PosSyncQueue.shared.items.contains { $0.id == attempt })
    }

    func test_collectPayload_roundTripPreservesAttemptAndReceipt() throws {
        let payload = PosSyncCollectCashPayload(
            restaurantId: "r1",
            tableSessionId: "s1",
            allocations: [PosSyncCashAllocation(orderLineId: "line-a", quantity: 2)],
            tipCents: 50,
            receivedAmountCents: 1000,
            paymentAttemptId: "pay-1",
            receiptLocalId: "rec-1",
            method: "card",
            amountCents: 1200
        )
        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PosSyncCollectCashPayload.self, from: data)
        XCTAssertEqual(decoded.resolvedPaymentAttemptId, "pay-1")
        XCTAssertEqual(decoded.receiptLocalId, "rec-1")
        XCTAssertEqual(decoded.resolvedMethod, "card")
        XCTAssertEqual(decoded.amountCents, 1200)
    }

    func test_legacyCollectPayload_decodesWithoutNewFields() throws {
        let legacy = """
        {"restaurantId":"r","tableSessionId":"s","allocations":[{"orderLineId":"l","quantity":1}],"tipCents":0}
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(PosSyncCollectCashPayload.self, from: legacy)
        XCTAssertEqual(decoded.resolvedMethod, "cash")
        XCTAssertNil(decoded.resolvedPaymentAttemptId)
        XCTAssertNil(decoded.receiptLocalId)
    }

    func test_markReceiptSynced_clearsFiscalPending() {
        let receipt = PosOfflineCaches.makeReceipt(
            sessionId: "s-phase5",
            tableLabel: "T1",
            diningTableId: "t1",
            lines: [
                SessionOpenLine(
                    id: "ol1",
                    orderLineId: "ol1",
                    name: "Cola",
                    openQuantity: 1,
                    openCents: 350,
                    course: 1,
                    firedAt: nil,
                    detail: "",
                    menuItemId: "m1"
                ),
            ],
            method: .cash,
            tipCents: 0,
            receivedAmountCents: 500,
            label: "Test",
            waiterName: "Test"
        )
        PosOfflineCaches.appendReceipt(receipt)
        XCTAssertTrue(receipt.fiscalPending)
        PosOfflineCaches.markReceiptSynced(localId: receipt.localId, paymentId: "cloud-pay-1")
        let found = PosOfflineCaches.loadReceipts().first { $0.localId == receipt.localId }
        XCTAssertEqual(found?.paymentId, "cloud-pay-1")
        XCTAssertEqual(found?.fiscalPending, false)
    }
}
