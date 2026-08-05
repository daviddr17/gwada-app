import Foundation

enum PosLineVoidError: Error, Equatable {
    case lineNotFound
    case invalidQuantity
    case voidCapRequired
    case missingVoidReason
    case missingIdempotencyKey
}

enum PosLineVoidResult: Equatable {
    case ok(remainingOpenQuantity: Int, kitchenStorno: Bool, idempotentReplay: Bool)
}

enum PosLineVoidPolicy {
    /// `true` if caller may void this line (fired ⇒ needs `hasVoidCap`).
    static func allowsVoid(lineFired: Bool, hasVoidCap: Bool) -> Bool {
        if lineFired { return hasVoidCap }
        return true
    }

    /// Trim + max 80 chars for kitchen detail / storage; empty after trim → nil.
    static func normalizedVoidNote(_ note: String?) -> String? {
        guard let note else { return nil }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return String(trimmed.prefix(80))
    }
}
