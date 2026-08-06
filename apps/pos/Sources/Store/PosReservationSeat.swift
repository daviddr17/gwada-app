import Foundation

enum PosReservationSeatError: Error, Equatable {
    case reservationNotFound
    case invalidStatus
    case tableNotFound
    case tableOccupied
    case missingIdempotencyKey
}

enum PosReservationSeatResult: Equatable {
    case ok(tableSessionId: String, diningTableId: String, idempotentReplay: Bool)
}

enum PosReservationSeatPolicy {
    static func canSeat(statusCode: String?) -> Bool {
        statusCode == "confirmed"
    }
}
