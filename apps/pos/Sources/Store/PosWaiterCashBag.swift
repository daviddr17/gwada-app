import Foundation

enum PosCashBagStatus: String, Codable, Equatable, Sendable {
    case open
    case handedOver = "handed_over"
    case closed
}

struct PosWaiterCashBag: Identifiable, Codable, Equatable, Sendable {
    var id: String
    var staffProfileId: String
    var registerSessionId: String
    var status: PosCashBagStatus
    var openingFloatCents: Int
    var closingCountCents: Int?
    var differenceCents: Int?
    /// Set when status becomes `handed_over`.
    var handedOverToBagId: String?
}

struct PosCashBagMovement: Codable, Equatable, Sendable {
    var id: String
    var cashBagId: String
    var kind: String // float_out | cash_sale | drop_in | handover | close_count
    var amountCents: Int
    var idempotencyKey: String?
}

enum PosCashBagError: Error, Equatable {
    case noOpenRegister
    case alreadyOpen
    case noOpenBag
    case targetHasOpenBag
    case managerPinRequired
    case invalidAmount
}

enum PosCashBagMath {
    /// Soll = opening + sum(cash_sale) − sum(drop_in); float_out / handover / close_count are informational.
    static func expectedCents(openingFloatCents: Int, movements: [PosCashBagMovement]) -> Int {
        var sales = 0
        var drops = 0
        for m in movements {
            switch m.kind {
            case "cash_sale":
                sales += m.amountCents
            case "drop_in":
                drops += m.amountCents
            default:
                break
            }
        }
        return openingFloatCents + sales - drops
    }
}
