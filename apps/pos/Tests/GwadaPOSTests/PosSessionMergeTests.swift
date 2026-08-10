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

    func testMerge_targetKassierenLock_rejects() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        hub.setKassierenLock(
            sessionId: target,
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
            idempotencyKey: "idem-merge-target-locked"
        )

        XCTAssertEqual(result, .failure(.kassierenActive))
        let openSessionIds = Set(hub.makeSnapshot().floor.openSessions.map(\.id))
        XCTAssertTrue(openSessionIds.contains(source))
        XCTAssertTrue(openSessionIds.contains(target))
    }

    func testMerge_preservesFiredLineMetadataAndAbsorbsFiredCourse() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        let firedAt = Date(timeIntervalSince1970: 1_785_000_000)
        hub.appendLocalOpenLines(
            sessionId: source,
            from: [makeCartLine(id: "merge-fired-line", course: 2)]
        )
        hub.markFired(sessionId: source, course: 2)
        hub.markLocalCourseFired(sessionId: source, course: 2, at: firedAt)

        let result = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: "idem-merge-fired"
        )

        guard case .success = result else {
            return XCTFail("expected merge success: \(result)")
        }
        XCTAssertEqual(
            hub.localOpenLines(sessionId: target).first(where: { $0.id == "merge-fired-line" })?.firedAt,
            firedAt
        )
        XCTAssertTrue(hub.hasFired(sessionId: target, course: 2))
        XCTAssertFalse(hub.hasFired(sessionId: source, course: 2))
    }

    func testMerge_regeneratesCollidingSourceLineId() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        let collidingId = "merge-collision"
        hub.appendLocalOpenLines(
            sessionId: target,
            from: [makeCartLine(id: collidingId, name: "Target line")]
        )
        hub.appendLocalOpenLines(
            sessionId: source,
            from: [makeCartLine(id: collidingId, name: "Source line")]
        )

        let result = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: "idem-merge-collision"
        )

        guard case .success = result else {
            return XCTFail("expected merge success: \(result)")
        }
        let mergedLines = hub.localOpenLines(sessionId: target)
        XCTAssertEqual(mergedLines.count, 2)
        XCTAssertEqual(mergedLines.first(where: { $0.name == "Target line" })?.id, collidingId)
        let movedId = mergedLines.first(where: { $0.name == "Source line" })?.id
        XCTAssertNotEqual(movedId, collidingId)
        XCTAssertNotNil(movedId.flatMap(UUID.init(uuidString:)))
        XCTAssertEqual(Set(mergedLines.map(\.id)).count, 2)
    }

    func testMerge_deletesSourceDraft() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let sourceTableId = tables[0].id
        let source = hub.openLocalSession(diningTableId: sourceTableId, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)
        PosDraftCartStore.save(
            [makeCartLine(id: "merge-source-draft")],
            diningTableId: sourceTableId,
            sessionId: source
        )
        XCTAssertEqual(
            PosDraftCartStore.load(diningTableId: sourceTableId, sessionId: source).count,
            1
        )

        let result = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: "idem-merge-source-draft"
        )

        guard case .success = result else {
            return XCTFail("expected merge success: \(result)")
        }
        XCTAssertTrue(
            PosDraftCartStore.load(diningTableId: sourceTableId, sessionId: source).isEmpty
        )
    }

    func testMerge_missingIdempotencyKey_rejects() {
        let hub = makeHub()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let source = hub.openLocalSession(diningTableId: tables[0].id, coverCount: 2)
        let target = hub.openLocalSession(diningTableId: tables[1].id, coverCount: 3)

        let result = hub.mergeLocalSessions(
            sourceSessionId: source,
            targetSessionId: target,
            idempotencyKey: "   "
        )

        XCTAssertEqual(result, .failure(.missingIdempotencyKey))
        let openSessionIds = Set(hub.makeSnapshot().floor.openSessions.map(\.id))
        XCTAssertTrue(openSessionIds.contains(source))
        XCTAssertTrue(openSessionIds.contains(target))
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
        PosLocalStore.saveOpenLines([:])
        PosLocalStore.saveKassierenLocks([:])
        PosLocalStore.flushForTests()
        PosDraftCartStore.clearAll()
        hub.configure(hubDeviceId: "merge-test-hub")
        hub.applyBootstrap(DemoSnapshotFactory.makeBootstrap(hubDeviceId: "merge-test-hub"))
        return hub
    }

    private func makeCartLine(
        id: String,
        name: String = "Merge Test",
        course: Int = 1
    ) -> PosCartLine {
        var line = PosCartLine(
            menuItemId: "item-merge-test",
            name: name,
            unitPriceCents: 1250,
            quantity: 1,
            course: course,
            notes: "",
            modifiers: []
        )
        line.id = id
        return line
    }
}
