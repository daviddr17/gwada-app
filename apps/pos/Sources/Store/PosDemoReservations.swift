import Foundation

#if DEBUG
/// Demo-Reservierungen für Solo-Labor (ohne Cloud/Hub).
enum PosDemoReservations {
    static let confirmed = PosReservationStatusDto(
        id: "status-confirmed",
        code: "confirmed",
        name: "Bestätigt",
        colorHex: "#0F766E"
    )
    static let pending = PosReservationStatusDto(
        id: "status-pending",
        code: "pending",
        name: "Offen",
        colorHex: "#CA8A04"
    )

    static func seedIfNeeded(tables: [PosLanFloorTable]) {
        let tableDtos: [PosReservationTableDto] = tables.map {
            PosReservationTableDto(
                id: $0.id,
                tableNumber: $0.table_number,
                tableName: $0.table_name,
                capacity: $0.capacity,
                areaId: $0.area_id
            )
        }
        let fallbackTables = tableDtos.isEmpty
            ? [
                PosReservationTableDto(id: "table-1", tableNumber: 1, tableName: nil, capacity: 4, areaId: "area-1"),
                PosReservationTableDto(id: "table-2", tableNumber: 2, tableName: "Fenster", capacity: 2, areaId: "area-1"),
            ]
            : tableDtos

        let tz = TimeZone.current
        let today = PosReservationsStore.todayYmd(timeZone: tz)
        let offsets = [0, 1, 2, 7]
        for offset in offsets {
            guard let ymd = ymd(offsetting: today, by: offset, timeZone: tz) else { continue }
            if let existing = PosReservationsStore.shared.cachedDay(ymd), !existing.reservations.isEmpty {
                continue
            }
            PosReservationsStore.shared.applyDay(
                makeDay(ymd: ymd, dayOffset: offset, tables: fallbackTables, timeZone: tz)
            )
        }
    }

    private static func ymd(offsetting base: String, by days: Int, timeZone: TimeZone) -> String? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let parts = base.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let start = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
              let shifted = cal.date(byAdding: .day, value: days, to: start)
        else { return nil }
        let p = cal.dateComponents([.year, .month, .day], from: shifted)
        return String(format: "%04d-%02d-%02d", p.year ?? 0, p.month ?? 0, p.day ?? 0)
    }

    private static func makeDay(
        ymd: String,
        dayOffset: Int,
        tables: [PosReservationTableDto],
        timeZone: TimeZone
    ) -> PosReservationsDayDto {
        let t1 = tables.first
        let t2 = tables.count > 1 ? tables[1] : tables.first
        var reservations: [PosReservationDto] = []

        switch dayOffset {
        case 0:
            reservations = [
                reservation(
                    id: "demo-resa-anna-\(ymd)",
                    number: 101,
                    first: "Anna",
                    last: "Müller",
                    party: 4,
                    ymd: ymd,
                    hm: "19:00",
                    table: t1,
                    status: confirmed,
                    notes: "Fensterplatz wenn möglich",
                    timeZone: timeZone
                ),
                reservation(
                    id: "demo-resa-jonas-\(ymd)",
                    number: 102,
                    first: "Jonas",
                    last: "Weber",
                    party: 2,
                    ymd: ymd,
                    hm: "20:30",
                    table: t2,
                    status: pending,
                    notes: nil,
                    timeZone: timeZone
                ),
            ]
        case 1:
            reservations = [
                reservation(
                    id: "demo-resa-sara-\(ymd)",
                    number: 110,
                    first: "Sara",
                    last: "Klein",
                    party: 6,
                    ymd: ymd,
                    hm: "18:30",
                    table: t1,
                    status: confirmed,
                    notes: "Geburtstag",
                    timeZone: timeZone
                ),
            ]
        case 2:
            reservations = [
                reservation(
                    id: "demo-resa-tom-\(ymd)",
                    number: 120,
                    first: "Tom",
                    last: "Neumann",
                    party: 3,
                    ymd: ymd,
                    hm: "19:15",
                    table: t2,
                    status: confirmed,
                    notes: nil,
                    timeZone: timeZone
                ),
            ]
        case 7:
            reservations = [
                reservation(
                    id: "demo-resa-future-\(ymd)",
                    number: 130,
                    first: "Lisa",
                    last: "Hoffmann",
                    party: 2,
                    ymd: ymd,
                    hm: "20:00",
                    table: t1,
                    status: pending,
                    notes: "In einer Woche",
                    timeZone: timeZone
                ),
            ]
        default:
            break
        }

        return PosReservationsDayDto(
            day: ymd,
            timezone: timeZone.identifier,
            defaultDwellMinutes: 120,
            bookingTimeStepMinutes: 15,
            reservations: reservations,
            statuses: [confirmed, pending],
            tables: tables
        )
    }

    private static func reservation(
        id: String,
        number: Int,
        first: String,
        last: String,
        party: Int,
        ymd: String,
        hm: String,
        table: PosReservationTableDto?,
        status: PosReservationStatusDto,
        notes: String?,
        timeZone: TimeZone
    ) -> PosReservationDto {
        let starts = iso(ymd: ymd, hm: hm, timeZone: timeZone)
        let ends = iso(ymd: ymd, hm: addHours(hm, 2), timeZone: timeZone)
        let tableRef = table.map {
            PosReservationTableRefDto(id: $0.id, tableNumber: $0.tableNumber, tableName: $0.tableName)
        }
        return PosReservationDto(
            id: id,
            reservationNumber: number,
            guestFirstName: first,
            guestLastName: last,
            guestPhone: nil,
            guestEmail: nil,
            partySize: party,
            startsAt: starts,
            endsAt: ends,
            notes: notes,
            diningTableId: table?.id,
            status: status,
            table: tableRef
        )
    }

    private static func addHours(_ hm: String, _ hours: Int) -> String {
        let parts = hm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return hm }
        let total = parts[0] * 60 + parts[1] + hours * 60
        return String(format: "%02d:%02d", (total / 60) % 24, total % 60)
    }

    private static func iso(ymd: String, hm: String, timeZone: TimeZone) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let ymdParts = ymd.split(separator: "-").compactMap { Int($0) }
        let hmParts = hm.split(separator: ":").compactMap { Int($0) }
        guard ymdParts.count == 3, hmParts.count == 2,
              let date = cal.date(from: DateComponents(
                  year: ymdParts[0],
                  month: ymdParts[1],
                  day: ymdParts[2],
                  hour: hmParts[0],
                  minute: hmParts[1]
              ))
        else {
            return "\(ymd)T\(hm):00"
        }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = timeZone
        return f.string(from: date)
    }
}
#endif
