import Foundation

enum PosSessionPhase: String, Equatable, Sendable {
    case overview
    case history
    case ordering
}

enum PosSessionOverviewMath {
    static func startPhase(
        openLines: [SessionOpenLine],
        historyNonEmpty: Bool = false
    ) -> PosSessionPhase {
        if !openLines.isEmpty { return .overview }
        if historyNonEmpty { return .history }
        return .ordering
    }

    static func openCents(openLines: [SessionOpenLine]) -> Int {
        openLines.reduce(0) { $0 + $1.openCents }
    }

    static func paidCents(
        openLines: [SessionOpenLine],
        receipts: [PosLocalReceipt]
    ) -> Int {
        let partial = openLines.reduce(0) { sum, line in
            sum + max(0, line.settlementLineTotalCents - line.openCents)
        }
        let paidReceipts = receipts.filter {
            let status = $0.status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return status.isEmpty || status == "paid"
        }
        let fromReceipts = paidReceipts.reduce(0) { $0 + max(0, $1.amountCents) }
        // Rule: use receipts when non-empty for session/table; else partial only.
        // Never add both (avoids double-count on partial pays that already created receipts).
        if !paidReceipts.isEmpty {
            return fromReceipts
        }
        return partial
    }

    static func overviewReceipts(
        resolvedSessionId: String,
        tableReceipts: [PosLocalReceipt]
    ) -> [PosLocalReceipt] {
        guard !resolvedSessionId.isEmpty, !resolvedSessionId.hasPrefix("pending-") else {
            return tableReceipts
        }
        return tableReceipts.filter { $0.tableSessionId == resolvedSessionId }
    }

    static func courseStatuses(
        openLines: [SessionOpenLine],
        sessionId: String
    ) -> [(course: Int, label: String)] {
        let courses = Array(Set(openLines.map(\.course))).sorted()
        return courses.map { course in
            (course, courseStatusLabel(course: course, openLines: openLines, sessionId: sessionId))
        }
    }

    static func courseStatusLabel(
        course: Int,
        openLines: [SessionOpenLine],
        sessionId: String
    ) -> String {
        let needsFire = courseNeedsFire(
            openLines: openLines,
            course: course,
            sessionId: sessionId
        )
        let title = PosCourse.chipLabel(course)
        let suffix = needsFire ? "offen" : "geschickt"
        return "\(title) · \(suffix)"
    }

    /// Offene Zeilen nach Gang gruppiert (aufsteigend).
    static func openLinesByCourse(
        _ openLines: [SessionOpenLine]
    ) -> [(course: Int, lines: [SessionOpenLine])] {
        let courses = Array(Set(openLines.map(\.course))).sorted()
        return courses.map { course in
            (course, openLines.filter { $0.course == course })
        }
    }

    /// Detail ohne redundantes Gang-Label (z. B. „Hauptgang · ohne Knoblauch“ → „ohne Knoblauch“).
    static func overviewLineDetail(_ line: SessionOpenLine) -> String {
        let courseLabel = PosCourse.label(line.course)
        let detail = line.detail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !detail.isEmpty else { return "" }
        if detail == courseLabel { return "" }
        let prefix = courseLabel + " · "
        if detail.hasPrefix(prefix) {
            return String(detail.dropFirst(prefix.count))
        }
        return detail
    }
}
