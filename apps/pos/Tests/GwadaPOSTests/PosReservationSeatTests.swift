import XCTest
@testable import GwadaPOS

final class PosReservationSeatTests: XCTestCase {
    func testSeatReservationPath_matchesLANContract() {
        XCTAssertEqual(PosLanProtocol.seatReservationPath, "/v1/reservations/seat")
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.seatReservationPath))
    }

    func testPolicy_onlyConfirmed() {
        XCTAssertTrue(PosReservationSeatPolicy.canSeat(statusCode: "confirmed"))
        XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: "pending"))
        XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: "seated"))
        XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: nil))
    }

    func testSeat_occupiedTable_fails() {
        let suffix = UUID().uuidString
        let tableId = "seat-occ-t-\(suffix)"
        let resaId = "seat-occ-r-\(suffix)"
        let day = "2099-01-01"
        defer { cleanup(tableSessionOn: tableId, dayYmd: day) }

        seedBootstrap(tableId: tableId)
        seedConfirmedReservation(id: resaId, dayYmd: day, assignedTableId: tableId, floorTableId: tableId)
        _ = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: 2)

        let result = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 4,
            dayYmd: day,
            idempotencyKey: "seat-occ-\(suffix)"
        )
        XCTAssertEqual(result, .failure(.tableOccupied))

        let cached = PosReservationsStore.shared.cachedDay(day)?
            .reservations.first(where: { $0.id == resaId })
        XCTAssertEqual(cached?.status?.code, "confirmed")
    }

    func testSeat_freeTable_opensSessionAndMarksSeated() {
        let suffix = UUID().uuidString
        let tableId = "seat-free-t-\(suffix)"
        let resaId = "seat-free-r-\(suffix)"
        let day = "2099-01-02"
        defer { cleanup(tableSessionOn: tableId, dayYmd: day) }

        seedBootstrap(tableId: tableId)
        seedConfirmedReservation(id: resaId, dayYmd: day, assignedTableId: nil, floorTableId: tableId)

        let result = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 4,
            dayYmd: day,
            idempotencyKey: "seat-free-\(suffix)"
        )
        guard case .success(.ok(let sessionId, let seatedTableId, let idempotentReplay)) = result else {
            return XCTFail("\(result)")
        }
        XCTAssertFalse(idempotentReplay)
        XCTAssertEqual(seatedTableId, tableId)
        XCTAssertEqual(PosHubState.shared.openSessionId(forDiningTableId: tableId), sessionId)

        let cached = PosReservationsStore.shared.cachedDay(day)?
            .reservations.first(where: { $0.id == resaId })
        XCTAssertEqual(cached?.status?.code, "seated")
        XCTAssertEqual(cached?.diningTableId, tableId)
    }

    func testSeat_idempotent() {
        let suffix = UUID().uuidString
        let tableId = "seat-idem-t-\(suffix)"
        let resaId = "seat-idem-r-\(suffix)"
        let day = "2099-01-03"
        let key = "seat-idem-\(suffix)"
        defer { cleanup(tableSessionOn: tableId, dayYmd: day) }

        seedBootstrap(tableId: tableId)
        seedConfirmedReservation(id: resaId, dayYmd: day, assignedTableId: tableId, floorTableId: tableId)

        let first = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 3,
            dayYmd: day,
            idempotencyKey: key
        )
        guard case .success(.ok(let sessionId, let table1, let replay1)) = first else {
            return XCTFail("\(first)")
        }
        XCTAssertFalse(replay1)
        XCTAssertEqual(table1, tableId)

        let second = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 3,
            dayYmd: day,
            idempotencyKey: key
        )
        guard case .success(.ok(let sessionId2, let table2, let replay2)) = second else {
            return XCTFail("\(second)")
        }
        XCTAssertTrue(replay2)
        XCTAssertEqual(sessionId2, sessionId)
        XCTAssertEqual(table2, tableId)

        let sessions = PosHubState.shared.makeSnapshot().floor.openSessions
            .filter { $0.dining_table_id == tableId }
        XCTAssertEqual(sessions.count, 1)
    }

    /// Sequential stand-in for concurrent peer race: reservation already seated + same key → replay
    /// (not `.invalidStatus` from `canSeat` failing on `seated`).
    func testSeat_alreadySeated_sameKey_idempotentReplay() {
        let suffix = UUID().uuidString
        let tableId = "seat-race-t-\(suffix)"
        let resaId = "seat-race-r-\(suffix)"
        let day = "2099-01-04"
        let key = "seat-race-\(suffix)"
        defer { cleanup(tableSessionOn: tableId, dayYmd: day) }

        seedBootstrap(tableId: tableId)
        seedConfirmedReservation(id: resaId, dayYmd: day, assignedTableId: tableId, floorTableId: tableId)

        let first = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 2,
            dayYmd: day,
            idempotencyKey: key
        )
        guard case .success(.ok(let sessionId, _, let replay1)) = first else {
            return XCTFail("\(first)")
        }
        XCTAssertFalse(replay1)

        let seated = PosReservationsStore.shared.cachedDay(day)?
            .reservations.first(where: { $0.id == resaId })
        XCTAssertEqual(seated?.status?.code, "seated")

        // Same key after peer already seated — must replay, not fail canSeat/.invalidStatus.
        let second = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: tableId,
            coverCount: 2,
            dayYmd: day,
            idempotencyKey: key
        )
        guard case .success(.ok(let sessionId2, let table2, let replay2)) = second else {
            return XCTFail("expected idempotentReplay, got \(second)")
        }
        XCTAssertTrue(replay2)
        XCTAssertEqual(sessionId2, sessionId)
        XCTAssertEqual(table2, tableId)
    }

    func testSeat_emptyTableId_tableNotFound() {
        let suffix = UUID().uuidString
        let tableId = "seat-empty-t-\(suffix)"
        let resaId = "seat-empty-r-\(suffix)"
        let day = "2099-01-05"
        defer { cleanup(tableSessionOn: tableId, dayYmd: day) }

        seedBootstrap(tableId: tableId)
        seedConfirmedReservation(id: resaId, dayYmd: day, assignedTableId: nil, floorTableId: tableId)

        let result = PosHubState.shared.seatLocalReservation(
            reservationId: resaId,
            diningTableId: "   ",
            coverCount: 2,
            dayYmd: day,
            idempotencyKey: "seat-empty-\(suffix)"
        )
        XCTAssertEqual(result, .failure(.tableNotFound))
    }

    // MARK: - Helpers

    private func cleanup(tableSessionOn tableId: String, dayYmd: String) {
        if let sid = PosHubState.shared.openSessionId(forDiningTableId: tableId) {
            _ = PosHubState.shared.releaseLocalSession(sessionId: sid)
        }
        PosReservationsStore.shared.applyDay(
            PosReservationsDayDto(
                day: dayYmd,
                timezone: TimeZone.current.identifier,
                defaultDwellMinutes: 120,
                bookingTimeStepMinutes: 15,
                reservations: [],
                statuses: [],
                tables: []
            )
        )
    }

    private func seedBootstrap(tableId: String) {
        PosHubState.shared.applyBootstrap(
            PosCloudBootstrap(
                restaurantId: DemoSnapshotFactory.restaurantId,
                restaurantName: DemoSnapshotFactory.restaurantName,
                brandAccentHex: nil,
                generatedAt: ISO8601DateFormatter().string(from: Date()),
                register: PosCloudRegisterStatus(isOpen: true, sessionId: "register-seat-test", openedAt: nil),
                floor: PosLanFloorSnapshot(
                    areas: [],
                    tables: [
                        PosLanFloorTable(
                            id: tableId,
                            area_id: "area-seat-test",
                            table_number: 42,
                            table_name: "Seat Test",
                            capacity: 4,
                            is_active: true
                        ),
                    ],
                    openSessions: [],
                    orderCountBySessionId: [:],
                    sessionMetaBySessionId: [:]
                ),
                menu: PosCloudMenuCatalog(categories: [], items: [], optionGroups: []),
                kitchen: nil
            )
        )
    }

    private func seedConfirmedReservation(
        id: String,
        dayYmd: String,
        assignedTableId: String?,
        floorTableId: String
    ) {
        let confirmed = PosReservationStatusDto(
            id: "status-confirmed",
            code: "confirmed",
            name: "Bestätigt",
            colorHex: "#0F766E"
        )
        let seated = PosReservationStatusDto(
            id: "status-seated",
            code: "seated",
            name: "Platziert",
            colorHex: "#15803D"
        )
        let dayTables = [
            PosReservationTableDto(
                id: floorTableId,
                tableNumber: 42,
                tableName: "Seat Test",
                capacity: 4,
                areaId: "area-seat-test"
            ),
        ]

        let reservation = PosReservationDto(
            id: id,
            reservationNumber: 501,
            guestFirstName: "Test",
            guestLastName: "Gast",
            guestPhone: nil,
            guestEmail: nil,
            partySize: 4,
            startsAt: "\(dayYmd)T19:00:00Z",
            endsAt: "\(dayYmd)T21:00:00Z",
            notes: nil,
            diningTableId: assignedTableId,
            status: confirmed,
            table: assignedTableId.map {
                PosReservationTableRefDto(id: $0, tableNumber: 42, tableName: "Seat Test")
            }
        )

        PosReservationsStore.shared.applyDay(
            PosReservationsDayDto(
                day: dayYmd,
                timezone: TimeZone.current.identifier,
                defaultDwellMinutes: 120,
                bookingTimeStepMinutes: 15,
                reservations: [reservation],
                statuses: [confirmed, seated],
                tables: dayTables
            )
        )
    }
}
