import XCTest
@testable import GwadaPOS

final class PosSessionOverviewMathTests: XCTestCase {
    func test_startPhase_emptyIsOrdering() {
        XCTAssertEqual(PosSessionOverviewMath.startPhase(openLines: []), .ordering)
    }

    func test_startPhase_withOpenLinesIsOverview() {
        let line = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Cola",
            openQuantity: 1, openCents: 390, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 390
        )
        XCTAssertEqual(PosSessionOverviewMath.startPhase(openLines: [line]), .overview)
    }

    func test_paidCents_partialOnOpenLine() {
        let line = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Pasta",
            openQuantity: 1, openCents: 1000, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 2, lineTotalCents: 2000
        )
        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [line], receipts: []),
            1000
        )
    }

    func test_paidCents_includesReceiptAmountExTip() {
        let receipt = PosLocalReceipt(
            localId: "r1", paymentId: nil, orderId: nil, orderNumber: 1,
            tableSessionId: "s", tableLabel: "Tisch 1", diningTableId: "t",
            method: "cash", status: "paid", amountCents: 500, tipCents: 100,
            receivedAmountCents: nil, paidAt: "", fiscalPending: false,
            canVoidCash: false, dayYmd: "2026-08-03", label: nil,
            items: nil, waiterName: nil, tse: nil
        )
        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [], receipts: [receipt]),
            500
        )
    }

    func test_paidCents_receiptsWinOverPartial_noDoubleCount() {
        let line = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Pasta",
            openQuantity: 1, openCents: 1000, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 2, lineTotalCents: 2000
        )
        let receipt = PosLocalReceipt(
            localId: "r1", paymentId: nil, orderId: nil, orderNumber: 1,
            tableSessionId: "s", tableLabel: "Tisch 1", diningTableId: "t",
            method: "cash", status: "paid", amountCents: 500, tipCents: 100,
            receivedAmountCents: nil, paidAt: "", fiscalPending: false,
            canVoidCash: false, dayYmd: "2026-08-03", label: nil,
            items: nil, waiterName: nil, tse: nil
        )
        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [line], receipts: [receipt]),
            500,
            "paidCents must use receipts only when non-empty, not partial + receipts"
        )
    }

    func test_overviewReceipts_realSessionWithoutMatchDoesNotUseTableFallback() {
        let receipt = makeReceipt(sessionId: "old-session")

        XCTAssertEqual(
            PosSessionOverviewMath.overviewReceipts(
                resolvedSessionId: "current-session",
                tableReceipts: [receipt]
            ),
            []
        )
    }

    func test_overviewReceipts_realSessionUsesOnlyMatchingReceipts() {
        let matching = makeReceipt(localId: "matching", sessionId: "current-session")
        let stale = makeReceipt(localId: "stale", sessionId: "old-session")

        XCTAssertEqual(
            PosSessionOverviewMath.overviewReceipts(
                resolvedSessionId: "current-session",
                tableReceipts: [stale, matching]
            ),
            [matching]
        )
    }

    func test_overviewReceipts_pendingSessionKeepsTableFallback() {
        let receipt = makeReceipt(sessionId: "old-session")

        XCTAssertEqual(
            PosSessionOverviewMath.overviewReceipts(
                resolvedSessionId: "pending-local",
                tableReceipts: [receipt]
            ),
            [receipt]
        )
    }

    func test_paidCents_ignoresVoidedReceipts() {
        let paid = makeReceipt(localId: "paid", status: "paid", amountCents: 500)
        let voided = makeReceipt(localId: "voided", status: "voided", amountCents: 900)

        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [], receipts: [paid, voided]),
            500
        )
    }

    func test_openLinesByCourse_groupsSorted() {
        let g3 = SessionOpenLine(
            id: "d", orderLineId: "d", name: "Salat",
            openQuantity: 1, openCents: 890, course: 3,
            firedAt: nil, detail: "Dessert", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 890
        )
        let g2a = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Cola",
            openQuantity: 1, openCents: 390, course: 2,
            firedAt: nil, detail: "Hauptgang", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 390
        )
        let g2b = SessionOpenLine(
            id: "b", orderLineId: "b", name: "Pasta",
            openQuantity: 1, openCents: 1490, course: 2,
            firedAt: nil, detail: "Hauptgang · scharf", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 1490
        )
        let groups = PosSessionOverviewMath.openLinesByCourse([g3, g2a, g2b])
        XCTAssertEqual(groups.map(\.course), [2, 3])
        XCTAssertEqual(groups[0].lines.map(\.id), ["a", "b"])
        XCTAssertEqual(groups[1].lines.map(\.id), ["d"])
    }

    func test_overviewLineDetail_stripsCourseLabel() {
        let onlyCourse = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Cola",
            openQuantity: 1, openCents: 390, course: 2,
            firedAt: nil, detail: "Hauptgang", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 390
        )
        XCTAssertEqual(PosSessionOverviewMath.overviewLineDetail(onlyCourse), "")

        let withMods = SessionOpenLine(
            id: "b", orderLineId: "b", name: "Pasta",
            openQuantity: 1, openCents: 1490, course: 2,
            firedAt: nil, detail: "Hauptgang · scharf", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 1490
        )
        XCTAssertEqual(PosSessionOverviewMath.overviewLineDetail(withMods), "scharf")
    }

    private func makeReceipt(
        localId: String = "r1",
        sessionId: String = "s",
        status: String = "paid",
        amountCents: Int = 500
    ) -> PosLocalReceipt {
        PosLocalReceipt(
            localId: localId, paymentId: nil, orderId: nil, orderNumber: 1,
            tableSessionId: sessionId, tableLabel: "Tisch 1", diningTableId: "t",
            method: "cash", status: status, amountCents: amountCents, tipCents: 0,
            receivedAmountCents: nil, paidAt: "", fiscalPending: false,
            canVoidCash: false, dayYmd: "2026-08-03", label: nil,
            items: nil, waiterName: nil, tse: nil
        )
    }
}
