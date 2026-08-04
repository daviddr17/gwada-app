import Foundation

/// Proportionale Cent-Aufteilung wie `@gwada/pos-domain` `allocationAmountCents` / `sliceAmountCents`.
enum PosSettlementMath {
    static func allocationAmountCents(
        lineTotalCents: Int,
        lineQuantity: Int,
        allocQuantity: Int
    ) -> Int {
        guard lineTotalCents > 0, lineQuantity > 0, allocQuantity > 0 else { return 0 }
        if allocQuantity >= lineQuantity { return lineTotalCents }
        return Int((Double(lineTotalCents) * Double(allocQuantity) / Double(lineQuantity)).rounded())
    }

    /// Nächste `allocQuantity` Einheiten nach bereits `paidQuantityBefore` — Summen bleiben korrekt.
    static func sliceAmountCents(
        lineTotalCents: Int,
        lineQuantity: Int,
        paidQuantityBefore: Int,
        allocQuantity: Int
    ) -> Int {
        let paid = max(0, paidQuantityBefore)
        let alloc = max(0, allocQuantity)
        guard alloc > 0 else { return 0 }
        return allocationAmountCents(
            lineTotalCents: lineTotalCents,
            lineQuantity: lineQuantity,
            allocQuantity: paid + alloc
        ) - allocationAmountCents(
            lineTotalCents: lineTotalCents,
            lineQuantity: lineQuantity,
            allocQuantity: paid
        )
    }

    /// Offener Rest = Original − bereits bezahlt (kein Doppelrunden).
    static func openAmountCents(
        lineTotalCents: Int,
        lineQuantity: Int,
        openQuantity: Int
    ) -> Int {
        guard openQuantity > 0, lineQuantity > 0, lineTotalCents > 0 else { return 0 }
        let paidQty = max(0, lineQuantity - openQuantity)
        let paidPart = allocationAmountCents(
            lineTotalCents: lineTotalCents,
            lineQuantity: lineQuantity,
            allocQuantity: paidQty
        )
        return max(0, lineTotalCents - paidPart)
    }

    /// Inkrementelle Cent-Kosten der q-ten Einheit (1-basiert, Original-Linie).
    static func unitCents(
        lineTotalCents: Int,
        lineQuantity: Int,
        unitIndex: Int
    ) -> Int {
        guard unitIndex >= 1, unitIndex <= lineQuantity else { return 0 }
        return sliceAmountCents(
            lineTotalCents: lineTotalCents,
            lineQuantity: lineQuantity,
            paidQuantityBefore: unitIndex - 1,
            allocQuantity: 1
        )
    }
}

/// Eine Teilmenge einer offenen Bon-Zeile für Kassieren / Hub-Collect.
struct PosPayAllocation: Equatable, Sendable, Identifiable {
    var lineId: String
    var orderLineId: String
    var quantity: Int
    var amountCents: Int
    var name: String
    var detail: String
    var course: Int
    var menuItemId: String?

    var id: String { "\(lineId):\(quantity):\(amountCents)" }

    func asOpenLineSlice() -> SessionOpenLine {
        SessionOpenLine(
            id: lineId,
            orderLineId: orderLineId,
            name: name,
            openQuantity: quantity,
            openCents: amountCents,
            course: course,
            firedAt: nil,
            detail: detail,
            menuItemId: menuItemId,
            lineQuantity: quantity,
            lineTotalCents: amountCents
        )
    }

    static func make(from line: SessionOpenLine, quantity: Int) -> PosPayAllocation? {
        let qty = min(max(0, quantity), line.openQuantity)
        guard qty > 0 else { return nil }
        let cents = PosSettlementMath.sliceAmountCents(
            lineTotalCents: line.settlementLineTotalCents,
            lineQuantity: line.settlementLineQuantity,
            paidQuantityBefore: line.paidQuantity,
            allocQuantity: qty
        )
        guard cents > 0 else { return nil }
        return PosPayAllocation(
            lineId: line.id,
            orderLineId: line.orderLineId,
            quantity: qty,
            amountCents: cents,
            name: line.name,
            detail: line.detail,
            course: line.course,
            menuItemId: line.menuItemId
        )
    }
}
