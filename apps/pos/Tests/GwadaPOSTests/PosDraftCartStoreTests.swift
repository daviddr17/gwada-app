import XCTest
@testable import GwadaPOS

final class PosDraftCartStoreTests: XCTestCase {
    private var tableId: String!
    private var sessionId: String!

    override func setUp() {
        super.setUp()
        tableId = "table-draft-\(UUID().uuidString)"
        sessionId = "session-draft-\(UUID().uuidString)"
        PosDraftCartStore.resetCacheForTests()
        PosDraftCartStore.clear(diningTableId: tableId, sessionId: sessionId)
        PosLocalStore.flushForTests()
        PosDraftCartStore.resetCacheForTests()
    }

    override func tearDown() {
        PosDraftCartStore.clear(diningTableId: tableId, sessionId: sessionId)
        PosLocalStore.flushForTests()
        PosDraftCartStore.resetCacheForTests()
        super.tearDown()
    }

    private func sampleLine(name: String = "Cola") -> PosCartLine {
        PosCartLine(
            menuItemId: "item-1",
            name: name,
            unitPriceCents: 350,
            quantity: 1,
            course: 2,
            notes: "",
            modifiers: []
        )
    }

    func testSaveLoadUnderTableKey() {
        PosDraftCartStore.save([sampleLine()], diningTableId: tableId, sessionId: nil)
        let loaded = PosDraftCartStore.load(diningTableId: tableId, sessionId: nil)
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded[0].name, "Cola")
    }

    func testRemapTableDraftToSessionOnLoad() {
        PosDraftCartStore.save([sampleLine(name: "Bier")], diningTableId: tableId, sessionId: nil)
        let loaded = PosDraftCartStore.load(diningTableId: tableId, sessionId: sessionId)
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded[0].name, "Bier")
        // Tisch-Key leer, Session-Key gesetzt
        XCTAssertTrue(PosDraftCartStore.load(diningTableId: tableId, sessionId: nil).isEmpty)
        XCTAssertEqual(
            PosDraftCartStore.load(diningTableId: tableId, sessionId: sessionId).count,
            1
        )
    }

    func testClearRemovesBothKeys() {
        PosDraftCartStore.save([sampleLine()], diningTableId: tableId, sessionId: sessionId)
        PosDraftCartStore.clear(diningTableId: tableId, sessionId: sessionId)
        XCTAssertTrue(PosDraftCartStore.load(diningTableId: tableId, sessionId: sessionId).isEmpty)
        XCTAssertTrue(PosDraftCartStore.load(diningTableId: tableId, sessionId: nil).isEmpty)
    }

    func testPruneMissingSessionsKeepsTableDrafts() {
        let otherTable = "table-keep-\(UUID().uuidString)"
        defer { PosDraftCartStore.clear(diningTableId: otherTable, sessionId: nil) }

        PosDraftCartStore.save([sampleLine(name: "Tisch")], diningTableId: otherTable, sessionId: nil)
        PosDraftCartStore.save([sampleLine(name: "Session")], diningTableId: tableId, sessionId: sessionId)
        PosDraftCartStore.pruneMissingSessions(openSessionIds: [])
        XCTAssertEqual(PosDraftCartStore.load(diningTableId: otherTable, sessionId: nil).count, 1)
        XCTAssertTrue(PosDraftCartStore.load(diningTableId: tableId, sessionId: sessionId).isEmpty)
    }

    func testEmptySaveClears() {
        PosDraftCartStore.save([sampleLine()], diningTableId: tableId, sessionId: nil)
        PosDraftCartStore.save([], diningTableId: tableId, sessionId: nil)
        XCTAssertTrue(PosDraftCartStore.load(diningTableId: tableId, sessionId: nil).isEmpty)
    }

    func testSurvivesCacheResetViaDisk() {
        PosDraftCartStore.save([sampleLine(name: "Disk")], diningTableId: tableId, sessionId: nil)
        PosLocalStore.flushForTests()
        PosDraftCartStore.resetCacheForTests()
        let loaded = PosDraftCartStore.load(diningTableId: tableId, sessionId: nil)
        XCTAssertEqual(loaded.first?.name, "Disk")
    }
}
