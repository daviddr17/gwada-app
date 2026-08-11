import XCTest
@testable import GwadaPOS

final class PosCashBagLanTests: XCTestCase {
    func testCashBagLanPaths_matchContract() {
        XCTAssertEqual(PosLanProtocol.cashBagIssuePath, "/v1/cash-bags/issue")
        XCTAssertEqual(PosLanProtocol.cashBagClosePath, "/v1/cash-bags/close")
        XCTAssertEqual(PosLanProtocol.cashBagHandoverPath, "/v1/cash-bags/handover")
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.cashBagIssuePath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.cashBagClosePath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.cashBagHandoverPath))
    }

    func testCollectGateMessage_isGermanBlockerCopy() {
        XCTAssertEqual(
            PosRuntime.collectRequiresOpenCashBagMessage,
            "Zuerst Wechselgeld / Börse öffnen."
        )
    }

    func testApplyLocalCashSale_failsWithoutOpenBag() {
        let hub = PosHubState.shared
        hub.resetForFactoryReset()
        PosLocalStore.saveCashBags([])
        PosLocalStore.saveCashBagMovements([])
        PosLocalStore.flushForTests()
        defer {
            PosLocalStore.saveCashBags([])
            PosLocalStore.saveCashBagMovements([])
        }

        let result = hub.applyLocalCashSale(
            cashierProfileId: "staff-no-bag",
            amountCents: 1_000,
            paymentId: "pay-1",
            idempotencyKey: "sale-1"
        )
        XCTAssertEqual(result, .failure(.noOpenBag))
    }
}
