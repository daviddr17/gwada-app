import XCTest
@testable import GwadaPOS

final class PosLineVoidTests: XCTestCase {
    func testVoidLinePath_matchesLANContract() {
        XCTAssertEqual(PosLanProtocol.voidLinePath, "/v1/lines/void")
    }

    func testSyncLineVoidedPayload_codableRoundTrip() throws {
        let payload = PosSyncLineVoidedPayload(
            restaurantId: "restaurant-1",
            tableSessionId: "session-1",
            lineId: "line-1",
            quantity: 2,
            voidReasonId: "reason-1",
            note: "Gast",
            wasFired: true,
            waiterProfileId: "waiter-1",
            idempotencyKey: "void-1"
        )

        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PosSyncLineVoidedPayload.self, from: data)

        XCTAssertEqual(decoded.restaurantId, payload.restaurantId)
        XCTAssertEqual(decoded.tableSessionId, payload.tableSessionId)
        XCTAssertEqual(decoded.lineId, payload.lineId)
        XCTAssertEqual(decoded.quantity, payload.quantity)
        XCTAssertEqual(decoded.voidReasonId, payload.voidReasonId)
        XCTAssertEqual(decoded.note, payload.note)
        XCTAssertEqual(decoded.wasFired, payload.wasFired)
        XCTAssertEqual(decoded.waiterProfileId, payload.waiterProfileId)
        XCTAssertEqual(decoded.idempotencyKey, payload.idempotencyKey)
    }

    @MainActor
    func testSyncLineVoided_enqueuesOnceWithIdempotencyKey() {
        PosSyncQueue.shared.clearAll()
        defer { PosSyncQueue.shared.clearAll() }
        let payload = PosSyncLineVoidedPayload(
            restaurantId: "restaurant-1",
            tableSessionId: "session-1",
            lineId: "line-1",
            quantity: 1,
            voidReasonId: "reason-1",
            note: nil,
            wasFired: false,
            waiterProfileId: nil,
            idempotencyKey: "void-idempotency-key"
        )

        PosSyncQueue.shared.enqueueLineVoided(payload)
        PosSyncQueue.shared.enqueueLineVoided(payload)

        XCTAssertEqual(PosSyncQueue.shared.items.count, 1)
        XCTAssertEqual(PosSyncQueue.shared.items.first?.kind, .lineVoided)
        XCTAssertEqual(PosSyncQueue.shared.items.first?.id, payload.idempotencyKey)
    }

    func testPolicy_unfired_allowsWithoutCap() {
        XCTAssertTrue(PosLineVoidPolicy.allowsVoid(lineFired: false, hasVoidCap: false))
    }

    func testPolicy_fired_requiresCap() {
        XCTAssertFalse(PosLineVoidPolicy.allowsVoid(lineFired: true, hasVoidCap: false))
        XCTAssertTrue(PosLineVoidPolicy.allowsVoid(lineFired: true, hasVoidCap: true))
    }

    func testVoid_partialQuantity_updatesOpenCents() {
        let sid = "void-partial-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Schnitzel",
                openQuantity: 3, openCents: 5550, course: 2, firedAt: nil,
                detail: "", menuItemId: "m1", lineQuantity: 3, lineTotalCents: 5550
            )
        ])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: nil, hasVoidCap: false,
            idempotencyKey: "k1"
        )
        guard case .success(.ok(let rem, let kitchen, let idempotentReplay)) = r else {
            return XCTFail("\(r)")
        }
        XCTAssertEqual(rem, 2)
        XCTAssertFalse(kitchen)
        XCTAssertFalse(idempotentReplay)
        let line = PosHubState.shared.localOpenLines(sessionId: sid)[0]
        XCTAssertEqual(line.openQuantity, 2)
        XCTAssertEqual(line.openCents, 3700) // 2/3 of 5550 via PosSettlementMath
    }

    func testVoid_unfiredFull_setsNoKitchenStorno() {
        let sid = "void-unfired-full-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Wasser",
                openQuantity: 2, openCents: 600, course: 1, firedAt: nil,
                detail: "", lineQuantity: 2, lineTotalCents: 600
            ),
        ])

        let result = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 2,
            voidReasonId: "reason-1", note: nil, hasVoidCap: false,
            idempotencyKey: "unfired-full"
        )

        guard case .success(.ok(let remaining, let kitchenStorno, let idempotentReplay)) = result else {
            return XCTFail("\(result)")
        }
        XCTAssertEqual(remaining, 0)
        XCTAssertFalse(kitchenStorno)
        XCTAssertFalse(idempotentReplay)
        XCTAssertTrue(PosHubState.shared.localOpenLines(sessionId: sid).isEmpty)
    }

    func testVoid_fired_withoutCap_fails() {
        let sid = "void-fired-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        var line = SessionOpenLine(
            id: "L1", orderLineId: "L1", name: "Cola",
            openQuantity: 1, openCents: 350, course: 1, firedAt: Date(),
            detail: "", lineQuantity: 1, lineTotalCents: 350
        )
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [line])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: nil, hasVoidCap: false,
            idempotencyKey: "k2"
        )
        XCTAssertEqual(r, .failure(.voidCapRequired))
    }

    func testVoid_fired_withCap_setsKitchenStorno() {
        let sid = "void-kitchen-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Cola",
                openQuantity: 2, openCents: 700, course: 1, firedAt: Date(),
                detail: "", lineQuantity: 2, lineTotalCents: 700
            )
        ])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: "Gast", hasVoidCap: true,
            idempotencyKey: "k3"
        )
        guard case .success(.ok(let rem, let kitchen, let idempotentReplay)) = r else {
            return XCTFail("\(r)")
        }
        XCTAssertEqual(rem, 1)
        XCTAssertTrue(kitchen)
        XCTAssertFalse(idempotentReplay)
        XCTAssertEqual(PosHubState.shared.localOpenLines(sessionId: sid)[0].openQuantity, 1)
    }

    func testVoidNote_truncatesTo80() {
        let long = String(repeating: "a", count: 120)
        XCTAssertEqual(PosLineVoidPolicy.normalizedVoidNote(long)?.count, 80)
        XCTAssertNil(PosLineVoidPolicy.normalizedVoidNote("   "))
        XCTAssertNil(PosLineVoidPolicy.normalizedVoidNote(nil))
    }

    func testVoid_longNote_succeeds() {
        let sid = "void-long-note-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Wasser",
                openQuantity: 1, openCents: 320, course: 1, firedAt: Date(),
                detail: "", lineQuantity: 1, lineTotalCents: 320
            ),
        ])
        let longNote = String(repeating: "x", count: 200)
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: longNote, hasVoidCap: true,
            idempotencyKey: "long-note"
        )
        guard case .success(.ok(_, let kitchen, let idempotentReplay)) = r else {
            return XCTFail("\(r)")
        }
        XCTAssertTrue(kitchen)
        XCTAssertFalse(idempotentReplay)
    }

    func testVoid_emptyIdempotencyKey_failsWithoutMutation() {
        let sid = "void-no-idem-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Wasser",
                openQuantity: 2, openCents: 600, course: 1, firedAt: nil,
                detail: "", lineQuantity: 2, lineTotalCents: 600
            ),
        ])
        for emptyKey in ["", "   ", "\n"] {
            let r = PosHubState.shared.voidLocalOpenLine(
                sessionId: sid, lineId: "L1", quantity: 1,
                voidReasonId: "reason-1", note: nil, hasVoidCap: false,
                idempotencyKey: emptyKey
            )
            XCTAssertEqual(r, .failure(.missingIdempotencyKey), "key: \(emptyKey.debugDescription)")
        }
        XCTAssertEqual(PosHubState.shared.localOpenLines(sessionId: sid)[0].openQuantity, 2)
    }

    func testVoid_idempotent() {
        let sid = "void-idem-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Wasser",
                openQuantity: 2, openCents: 600, course: 1, firedAt: nil,
                detail: "", lineQuantity: 2, lineTotalCents: 600
            )
        ])
        let key = "same-key"
        _ = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "r", note: nil, hasVoidCap: false, idempotencyKey: key
        )
        let second = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "r", note: nil, hasVoidCap: false, idempotencyKey: key
        )
        guard case .success(.ok(let rem, _, let idempotentReplay)) = second else {
            return XCTFail("\(second)")
        }
        XCTAssertEqual(rem, 1)
        XCTAssertTrue(idempotentReplay)
        XCTAssertEqual(PosHubState.shared.localOpenLines(sessionId: sid)[0].openQuantity, 1)
    }
}
