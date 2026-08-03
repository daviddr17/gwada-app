import XCTest
@testable import GwadaPOS

@MainActor
final class PosHubPhase6UxTests: XCTestCase {
    func test_conflictPresentation_mapsSessionGone() {
        let payload = PosHandheldOutbox.CreateOrderPayload(
            eventId: "evt-1",
            diningTableId: "t1",
            sessionId: "s1",
            coverCount: 2,
            items: [
                .init(
                    menuItemId: "m1",
                    quantity: 2,
                    notes: nil,
                    course: 1,
                    clientLineId: "c1",
                    name: "Cola",
                    unitPriceCents: 350
                ),
            ]
        )
        let conflict = OutboxConflictPresentation.fromHardReject(
            message: "session_gone",
            payload: payload,
            tableLabel: "12"
        )
        XCTAssertEqual(conflict.id, "evt-1")
        XCTAssertEqual(conflict.title, "Bestellung nicht übernommen")
        XCTAssertTrue(conflict.reason.contains("nicht mehr offen"))
        XCTAssertEqual(conflict.detailLines, ["2× Cola"])
        XCTAssertEqual(conflict.tableHint, "Tisch 12")
    }

    func test_conflictPresentation_keepsGenericMessage() {
        let payload = PosHandheldOutbox.CreateOrderPayload.make(
            eventId: "evt-2",
            diningTableId: "t2",
            sessionId: "s2",
            coverCount: 1,
            lines: [
                PosCartLine(
                    menuItemId: "m2",
                    name: "Bier",
                    unitPriceCents: 400,
                    quantity: 1,
                    course: 1,
                    notes: "",
                    modifiers: []
                ),
            ]
        )
        let conflict = OutboxConflictPresentation.fromHardReject(
            message: "invalid_payload",
            payload: payload,
            tableLabel: nil
        )
        XCTAssertEqual(conflict.reason, "invalid_payload")
        XCTAssertNil(conflict.tableHint)
        XCTAssertFalse(conflict.detailLines.isEmpty)
    }

    func test_hubDisconnectedAt_persistsAcrossSetClear() {
        let key = "gwada_pos_hub_disconnected_at"
        UserDefaults.standard.removeObject(forKey: key)
        let since = Date(timeIntervalSince1970: 1_700_000_000)
        UserDefaults.standard.set(since.timeIntervalSince1970, forKey: key)
        XCTAssertEqual(
            UserDefaults.standard.object(forKey: key) as? Double,
            since.timeIntervalSince1970
        )
        UserDefaults.standard.removeObject(forKey: key)
        XCTAssertNil(UserDefaults.standard.object(forKey: key))
    }
}
