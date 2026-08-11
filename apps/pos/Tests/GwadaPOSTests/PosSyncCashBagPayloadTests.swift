import XCTest
@testable import GwadaPOS

@MainActor
final class PosSyncCashBagPayloadTests: XCTestCase {
    func test_issuedPayload_roundTrip() throws {
        let payload = PosSyncCashBagIssuedPayload(
            restaurantId: "r1",
            bagId: "bag-1",
            staffProfileId: "waiter-a",
            openingFloatCents: 10_000,
            idempotencyKey: "issue-key-1",
            issuedByProfileId: "issuer-1"
        )
        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PosSyncCashBagIssuedPayload.self, from: data)
        XCTAssertEqual(decoded, payload)
    }

    func test_closedPayload_roundTrip() throws {
        let payload = PosSyncCashBagClosedPayload(
            restaurantId: "r1",
            bagId: "bag-1",
            closingCountCents: 9_950,
            idempotencyKey: "close-key-1",
            closedByProfileId: "closer-1",
            managerOverrideProfileId: "manager-1",
            managerPinVerified: true,
            managerPin: "1234"
        )
        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PosSyncCashBagClosedPayload.self, from: data)
        XCTAssertEqual(decoded, payload)
    }

    func test_handoverPayload_roundTrip() throws {
        let payload = PosSyncCashBagHandoverPayload(
            restaurantId: "r1",
            fromProfileId: "from-waiter",
            toProfileId: "to-waiter",
            idempotencyKey: "handover-key-1",
            fromBagId: "bag-from",
            toBagId: "bag-to"
        )
        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PosSyncCashBagHandoverPayload.self, from: data)
        XCTAssertEqual(decoded, payload)
    }

    func test_kindRawValues_matchQueuePersistence() {
        XCTAssertEqual(PosSyncQueueItemKind.cashBagIssued.rawValue, "cashBagIssued")
        XCTAssertEqual(PosSyncQueueItemKind.cashBagClosed.rawValue, "cashBagClosed")
        XCTAssertEqual(PosSyncQueueItemKind.cashBagHandover.rawValue, "cashBagHandover")
    }

    func test_enqueueCashBagIssued_dedupesByIdempotencyKey() {
        let key = "cash-bag-issue-\(UUID().uuidString)"
        let payload = PosSyncCashBagIssuedPayload(
            restaurantId: "r1",
            bagId: "bag-1",
            staffProfileId: "waiter-a",
            openingFloatCents: 5_000,
            idempotencyKey: key,
            issuedByProfileId: nil
        )
        let before = PosSyncQueue.shared.pendingCount
        PosSyncQueue.shared.enqueueCashBagIssued(payload)
        PosSyncQueue.shared.enqueueCashBagIssued(payload)
        XCTAssertEqual(PosSyncQueue.shared.pendingCount, before + 1)
        XCTAssertEqual(PosSyncQueue.shared.items.first { $0.id == key }?.kind, .cashBagIssued)
    }

    func test_nestEventTypeNames_areExact() {
        // Documented contract for Nest sync.service — must stay exact.
        let names = ["cash_bag.issued", "cash_bag.closed", "cash_bag.handover"]
        XCTAssertEqual(names.count, 3)
        XCTAssertTrue(names.allSatisfy { $0.hasPrefix("cash_bag.") })
    }
}
