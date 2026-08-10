import XCTest
@testable import GwadaPOS

final class PosSessionMergeTests: XCTestCase {
    func testPolicy_blocksAnyKassierenLock() {
        XCTAssertTrue(PosSessionMergePolicy.canMerge(sourceLocked: false, targetLocked: false))
        XCTAssertFalse(PosSessionMergePolicy.canMerge(sourceLocked: true, targetLocked: false))
        XCTAssertFalse(PosSessionMergePolicy.canMerge(sourceLocked: false, targetLocked: true))
    }

    func testMerge_absorbsLinesAndSumsCovers_freesSourceTable() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let t1 = tables[0].id
        let t2 = tables[1].id
        let s1 = hub.openLocalSession(diningTableId: t1, coverCount: 2)
        let s2 = hub.openLocalSession(diningTableId: t2, coverCount: 3)
        hub.appendLocalOpenLines(sessionId: s1, from: [makeCartLine(id: "merge-source-line")])

        let result = hub.mergeLocalSessions(
            sourceSessionId: s1,
            targetSessionId: s2,
            idempotencyKey: "idem-merge-1"
        )

        guard case .success(.ok(let target, let covers, let replay)) = result else {
            return XCTFail("expected ok \(result)")
        }
        XCTAssertEqual(target, s2)
        XCTAssertEqual(covers, 5)
        XCTAssertFalse(replay)
        XCTAssertEqual(hub.localOpenLines(sessionId: s2).map(\.id), ["merge-source-line"])
        let floor = hub.makeSnapshot().floor
        XCTAssertNil(floor.openSessions.first(where: { $0.id == s1 }))
        XCTAssertEqual(floor.openSessions.first(where: { $0.id == s2 })?.cover_count, 5)
        XCTAssertFalse(floor.openSessions.contains(where: { $0.dining_table_id == t1 }))
    }

    func testMerge_kassierenLock_rejects() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        hub.setKassierenLock(
            sessionId: source,
            state: PosKassierenLockState(
                mode: PosKassierenLockState.modePositions,
                evenN: 2,
                evenPlanN: nil,
                evenSharesCompleted: 0,
                settledShareCents: 0
            )
        )

        let result = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: "idem-merge-locked"
        )

        XCTAssertEqual(result, .failure(.kassierenActive))
        XCTAssertNotNil(hub.makeSnapshot().floor.openSessions.first(where: { $0.id == source }))
    }

    func testMerge_idempotentReplay() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        hub.appendLocalOpenLines(sessionId: source, from: [makeCartLine(id: "merge-replay-line")])
        let key = "idem-merge-replay"

        let first = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: key
        )
        let lineCountAfterFirst = hub.localOpenLines(sessionId: target).count
        let second = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: key
        )

        guard case .success(.ok(_, _, let firstReplay)) = first,
              case .success(.ok(let replayTarget, let replayCovers, let secondReplay)) = second
        else {
            return XCTFail("expected idempotent ok results: \(first), \(second)")
        }
        XCTAssertFalse(firstReplay)
        XCTAssertEqual(replayTarget, target)
        XCTAssertEqual(replayCovers, 5)
        XCTAssertTrue(secondReplay)
        XCTAssertEqual(hub.localOpenLines(sessionId: target).count, lineCountAfterFirst)
    }

    private func makeHub() -> PosHubState {
        let hub = PosHubState.shared
        hub.resetForFactoryReset()
        hub.configure(hubDeviceId: "merge-test-hub")
        hub.loadCachedOrDemo()
        return hub
    }

    private func makeCartLine(id: String) -> PosCartLine {
        var line = PosCartLine(
            menuItemId: "item-merge-test",
            name: "Merge Test",
            unitPriceCents: 1250,
            quantity: 1,
            course: 1,
            notes: "",
            modifiers: []
        )
        line.id = id
        return line
    }
}
