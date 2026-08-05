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

/// Hub LAN void authorization — caps from authenticated staff only (never spoofable body waiter id alone).
enum PosLanVoidAuth {
    static func authenticatedStaffId(headerStaffId: String?, bodyStaffId: String?) -> String {
        let header = headerStaffId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !header.isEmpty { return header }
        return bodyStaffId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static func hasStaffProof(
        staffId: String,
        staffSessionId: String?,
        staffSessionHeader: String?
    ) -> Bool {
        guard !staffId.isEmpty else { return false }
        let session = staffSessionId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let header = staffSessionHeader?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !session.isEmpty || !header.isEmpty
    }

    /// Cap only for the authenticated profile. Lab may pass `allowWithoutStaffInLab` when staff proof is skipped.
    static func hasVoidCap(
        authenticatedStaffId: String,
        waiterCaps: [String: [String]],
        allowWithoutStaffInLab: Bool
    ) -> Bool {
        if !authenticatedStaffId.isEmpty {
            return waiterCaps[authenticatedStaffId]?.contains("void") == true
        }
        return allowWithoutStaffInLab
    }
}

/// After a successful Hub LAN void, mirror the mutation onto the handheld local open-line cache (like collect).
enum PosLineVoidMirror {
    @discardableResult
    static func applyLocalMirror(
        sessionId: String,
        lineId: String,
        quantity: Int,
        voidReasonId: String,
        note: String?,
        idempotencyKey: String
    ) -> Result<PosLineVoidResult, PosLineVoidError> {
        PosHubState.shared.voidLocalOpenLine(
            sessionId: sessionId,
            lineId: lineId,
            quantity: quantity,
            voidReasonId: voidReasonId,
            note: note,
            hasVoidCap: true,
            idempotencyKey: idempotencyKey
        )
    }
}
