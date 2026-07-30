import Foundation

/// Swift-Spiegel der Split-Bill-Regeln aus `packages/pos-domain` (Phase 4 UI).
struct PosSplitBillState: Equatable, Sendable {
    enum Mode: String, Sendable { case item, amount }

    var mode: Mode
    var openCents: Int
    var settledCents: Int
    var evenN: Int

    static func create(openCents: Int, evenN: Int = 2) -> PosSplitBillState {
        PosSplitBillState(
            mode: .item,
            openCents: max(0, openCents),
            settledCents: 0,
            evenN: clampEvenN(evenN)
        )
    }

    static func clampEvenN(_ n: Int) -> Int {
        min(12, max(1, n))
    }

    var canPayPerson: Bool {
        mode == .item && settledCents == 0 && openCents > 0
    }

    static func shareCents(openCents: Int, evenN: Int) -> Int {
        let open = max(0, openCents)
        let n = clampEvenN(evenN)
        if open <= 0 { return 0 }
        if n <= 1 { return open }
        let raw = Int(ceil(Double(open) / Double(n) / 10.0) * 10)
        return min(open, raw)
    }

    mutating func applyPersonPayment(personOpenCents: Int) -> Result<Int, PosSplitBillError> {
        guard canPayPerson else { return .failure(.personLockedAfterShare) }
        let amount = personOpenCents
        guard amount > 0, amount <= openCents else { return .failure(.invalidAmount) }
        openCents -= amount
        return .success(amount)
    }

    mutating func applySharePayment() -> Result<Int, PosSplitBillError> {
        guard openCents > 0 else { return .failure(.nothingOpen) }
        let n = Self.clampEvenN(evenN)
        guard n >= 1 else { return .failure(.invalidEvenN) }
        let share = Self.shareCents(openCents: openCents, evenN: n)
        openCents -= share
        settledCents += share
        mode = .amount
        evenN = max(1, n - 1)
        return .success(share)
    }
}

enum PosSplitBillError: String, Error, Sendable {
    case nothingOpen = "nothing_open"
    case personLockedAfterShare = "person_locked_after_share"
    case invalidEvenN = "invalid_even_n"
    case invalidAmount = "invalid_amount"
}
