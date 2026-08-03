import XCTest
@testable import GwadaPOS

@MainActor
final class PosHandheldOutboxTests: XCTestCase {
    override func setUp() {
        super.setUp()
        PosHandheldOutbox.shared.clear()
    }

    override func tearDown() {
        PosHandheldOutbox.shared.clear()
        super.tearDown()
    }

    func test_enqueueCreateOrder_persistsAndCounts() {
        let lines = [
            PosCartLine(
                menuItemId: "m1",
                name: "Cola",
                unitPriceCents: 350,
                quantity: 1,
                course: PosCourse.default,
                notes: "",
                modifiers: []
            ),
        ]
        let payload = PosHandheldOutbox.CreateOrderPayload.make(
            eventId: "evt-1",
            diningTableId: "t1",
            sessionId: "s1",
            coverCount: 2,
            lines: lines
        )
        PosHandheldOutbox.shared.enqueueCreateOrder(payload)
        XCTAssertEqual(PosHandheldOutbox.shared.pendingCount, 1)
        XCTAssertEqual(PosHandheldOutbox.shared.items.first?.id, "evt-1")

        // Same eventId replaces
        PosHandheldOutbox.shared.enqueueCreateOrder(payload)
        XCTAssertEqual(PosHandheldOutbox.shared.pendingCount, 1)
    }

    func test_createOrderPayload_preservesClientLineIds() {
        var line = PosCartLine(
            menuItemId: "m1",
            name: "Bier",
            unitPriceCents: 400,
            quantity: 2,
            course: 1,
            notes: "kalt",
            modifiers: []
        )
        line.id = "client-line-xyz"
        let payload = PosHandheldOutbox.CreateOrderPayload.make(
            diningTableId: "t1",
            sessionId: "s1",
            coverCount: 2,
            lines: [line]
        )
        XCTAssertEqual(payload.items.first?.clientLineId, "client-line-xyz")
        XCTAssertEqual(payload.cartLines.first?.id, "client-line-xyz")
        XCTAssertEqual(payload.cartLines.first?.quantity, 2)
    }

    func test_hubState_registerOrderEventId_isIdempotent() {
        let id = "order-evt-\(UUID().uuidString)"
        XCTAssertTrue(PosHubState.shared.registerOrderEventId(id))
        XCTAssertFalse(PosHubState.shared.registerOrderEventId(id))
    }
}
