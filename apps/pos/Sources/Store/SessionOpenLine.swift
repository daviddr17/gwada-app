import Foundation

struct SessionOpenLine: Identifiable, Equatable, Codable, Sendable {
    var id: String
    var orderLineId: String
    var name: String
    var openQuantity: Int
    var openCents: Int
    var course: Int
    var firedAt: Date?
    var detail: String
    /// Present for locally buffered lines (menu badges); cloud summary may omit it.
    var menuItemId: String? = nil
    /// Original line quantity at send time (settlement base). Legacy cache: falls back to `openQuantity`.
    var lineQuantity: Int? = nil
    /// Original line total cents at send time. Legacy cache: falls back to `openCents`.
    var lineTotalCents: Int? = nil

    var isFired: Bool { firedAt != nil }

    var settlementLineQuantity: Int { lineQuantity ?? openQuantity }
    var settlementLineTotalCents: Int { lineTotalCents ?? openCents }
    var paidQuantity: Int { max(0, settlementLineQuantity - openQuantity) }

    /// Hält `openCents` konsistent zum Original-Total (nach Teilzahlung).
    mutating func syncOpenCentsFromOriginal() {
        openCents = PosSettlementMath.openAmountCents(
            lineTotalCents: settlementLineTotalCents,
            lineQuantity: settlementLineQuantity,
            openQuantity: openQuantity
        )
    }
}
