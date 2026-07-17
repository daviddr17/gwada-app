import Foundation

struct PosReservationStatusDto: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var code: String
    var name: String
    var colorHex: String
}

struct PosReservationTableDto: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var tableNumber: Int
    var tableName: String?
    var capacity: Int
    var areaId: String?
}

struct PosReservationDto: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var reservationNumber: Int
    var guestFirstName: String
    var guestLastName: String
    var guestPhone: String?
    var guestEmail: String?
    var partySize: Int
    var startsAt: String
    var endsAt: String
    var notes: String?
    var diningTableId: String?
    var status: PosReservationStatusDto?
    var table: PosReservationTableRefDto?

    var guestLabel: String {
        let first = guestFirstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let last = guestLastName.trimmingCharacters(in: .whitespacesAndNewlines)
        if first.isEmpty { return last.isEmpty ? "Gast" : last }
        if last.isEmpty { return first }
        return "\(first) \(last)"
    }

    var tableLabel: String {
        guard let table else { return "Kein Tisch" }
        if let name = table.tableName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return name
        }
        return "Tisch \(table.tableNumber)"
    }
}

struct PosReservationTableRefDto: Codable, Hashable, Sendable {
    var id: String
    var tableNumber: Int
    var tableName: String?
}

struct PosReservationsDayDto: Codable, Sendable {
    var day: String
    var timezone: String
    var defaultDwellMinutes: Int
    var bookingTimeStepMinutes: Int
    var reservations: [PosReservationDto]
    var statuses: [PosReservationStatusDto]
    var tables: [PosReservationTableDto]
}

struct PosCreateReservationPayload: Codable, Sendable {
    var restaurantId: String
    var guestFirstName: String?
    var guestLastName: String
    var guestPhone: String?
    var guestEmail: String?
    var partySize: Int
    var startsAt: String
    var endsAt: String
    var statusId: String?
    var diningTableId: String?
    var dwellMinutes: Int?
    var notes: String?
    var notifyEmail: Bool?
    var notifyWhatsapp: Bool?
    var localId: String
}

struct PosCreateReservationResponse: Codable, Sendable {
    var ok: Bool?
    var id: String
    var reservationNumber: Int
    var guestPin: String?
    var reservation: PosReservationDto?
}

enum PosReservationFactory {
    static func optimistic(
        from payload: PosCreateReservationPayload,
        day: PosReservationsDayDto?
    ) -> PosReservationDto {
        let table: PosReservationTableRefDto? = {
            guard let id = payload.diningTableId,
                  let t = day?.tables.first(where: { $0.id == id })
            else { return nil }
            return PosReservationTableRefDto(
                id: t.id,
                tableNumber: t.tableNumber,
                tableName: t.tableName
            )
        }()
        let status: PosReservationStatusDto? = {
            if let id = payload.statusId,
               let s = day?.statuses.first(where: { $0.id == id })
            {
                return s
            }
            return day?.statuses.first(where: { $0.code == "confirmed" })
        }()
        return PosReservationDto(
            id: payload.localId.isEmpty ? UUID().uuidString : payload.localId,
            reservationNumber: 0,
            guestFirstName: payload.guestFirstName ?? "",
            guestLastName: payload.guestLastName,
            guestPhone: payload.guestPhone,
            guestEmail: payload.guestEmail,
            partySize: payload.partySize,
            startsAt: payload.startsAt,
            endsAt: payload.endsAt,
            notes: payload.notes,
            diningTableId: payload.diningTableId,
            status: status,
            table: table
        )
    }
}
