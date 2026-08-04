import XCTest
@testable import GwadaPOS

@MainActor
final class PosSettlementSplitTests: XCTestCase {
    func test_allocationAmountCents_proportional() {
        XCTAssertEqual(
            PosSettlementMath.allocationAmountCents(lineTotalCents: 4000, lineQuantity: 4, allocQuantity: 1),
            1000
        )
        XCTAssertEqual(
            PosSettlementMath.allocationAmountCents(lineTotalCents: 4000, lineQuantity: 4, allocQuantity: 4),
            4000
        )
    }

    func test_sliceAmountCents_sumsToLineTotal() {
        let total = 101
        let qty = 3
        var paid = 0
        var sum = 0
        for _ in 0 ..< qty {
            let slice = PosSettlementMath.sliceAmountCents(
                lineTotalCents: total,
                lineQuantity: qty,
                paidQuantityBefore: paid,
                allocQuantity: 1
            )
            sum += slice
            paid += 1
        }
        XCTAssertEqual(sum, total)
        XCTAssertEqual(
            PosSettlementMath.unitCents(lineTotalCents: total, lineQuantity: qty, unitIndex: 1)
                + PosSettlementMath.unitCents(lineTotalCents: total, lineQuantity: qty, unitIndex: 2)
                + PosSettlementMath.unitCents(lineTotalCents: total, lineQuantity: qty, unitIndex: 3),
            total
        )
    }

    func test_settlePartialQuantity_keepsRemainderConsistent() {
        let sessionId = "sess-split-\(UUID().uuidString)"
        let lineId = "line-odd-\(UUID().uuidString)"
        PosHubState.shared.clearLocalOpenLines(sessionId: sessionId)
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sessionId) }

        // 101 ct / 3 Stk — nicht über Cart (unit×qty wäre immer ganzzahlig teilbar).
        PosHubState.shared.replaceLocalOpenLines(
            sessionId: sessionId,
            lines: [
                SessionOpenLine(
                    id: lineId,
                    orderLineId: lineId,
                    name: "Odd Cents",
                    openQuantity: 3,
                    openCents: 101,
                    course: 1,
                    firedAt: nil,
                    detail: "",
                    menuItemId: "item-odd",
                    lineQuantity: 3,
                    lineTotalCents: 101
                ),
            ]
        )

        let first = PosHubState.shared.settleCollectAllocations(
            sessionId: sessionId,
            allocations: [(lineId, 1)]
        )
        XCTAssertEqual(first?.paidCents, 34)

        var remaining = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(remaining.first?.openQuantity, 2)
        XCTAssertEqual(remaining.first?.openCents, 67)

        let second = PosHubState.shared.settleCollectAllocations(
            sessionId: sessionId,
            allocations: [(lineId, 1)]
        )
        // Zweite Einheit aus Original-Serie: 67−34 = 33 (nicht round(67/2)=34)
        XCTAssertEqual(second?.paidCents, 33)

        remaining = PosHubState.shared.localOpenLines(sessionId: sessionId)
        XCTAssertEqual(remaining.first?.openQuantity, 1)
        XCTAssertEqual(remaining.first?.openCents, 34)

        let third = PosHubState.shared.settleCollectAllocations(
            sessionId: sessionId,
            allocations: [(lineId, 1)]
        )
        XCTAssertEqual(third?.paidCents, 34)
        XCTAssertTrue(PosHubState.shared.localOpenLines(sessionId: sessionId).isEmpty)
        XCTAssertEqual((first?.paidCents ?? 0) + (second?.paidCents ?? 0) + (third?.paidCents ?? 0), 101)
    }

    func test_payAllocation_make() {
        let line = SessionOpenLine(
            id: "l1",
            orderLineId: "ol",
            name: "Cola",
            openQuantity: 4,
            openCents: 1200,
            course: 1,
            firedAt: nil,
            detail: "",
            menuItemId: nil,
            lineQuantity: 4,
            lineTotalCents: 1200
        )
        let alloc = PosPayAllocation.make(from: line, quantity: 1)
        XCTAssertEqual(alloc?.quantity, 1)
        XCTAssertEqual(alloc?.amountCents, 300)
    }

    func test_kassierenLock_persistsPerSession() {
        let sessionId = "sess-lock-\(UUID().uuidString)"
        PosHubState.shared.clearKassierenLock(sessionId: sessionId)
        defer { PosHubState.shared.clearKassierenLock(sessionId: sessionId) }

        let state = PosKassierenLockState(
            mode: PosKassierenLockState.modeEven,
            evenN: 2,
            evenPlanN: 3,
            evenSharesCompleted: 1,
            settledShareCents: 1500
        )
        PosHubState.shared.setKassierenLock(sessionId: sessionId, state: state)
        let loaded = PosHubState.shared.kassierenLock(sessionId: sessionId)
        XCTAssertEqual(loaded?.mode, PosKassierenLockState.modeEven)
        XCTAssertEqual(loaded?.evenPlanN, 3)
        XCTAssertEqual(loaded?.evenSharesCompleted, 1)
    }
}
