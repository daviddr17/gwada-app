import Foundation

struct PaidHistoryLine: Identifiable, Equatable, Codable, Sendable {
    var id: String
    var name: String
    var quantity: Int
    var amountCents: Int
    var course: Int
    var detail: String
    var lastPaidAt: String?
    var menuItemId: String?

    var mergeKey: String {
        Self.mergeKey(name: name, detail: detail, course: course, menuItemId: menuItemId)
    }

    static func mergeKey(name: String, detail: String, course: Int, menuItemId: String?) -> String {
        let mid = (menuItemId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let d = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        return [mid, n, d, "\(course)"].joined(separator: "|")
    }
}

enum PosSessionPaidHistory {
    /// Baut Historie aus Session-Belegen (paid, nicht void).
    static func rebuild(from receipts: [PosLocalReceipt]) -> [PaidHistoryLine] {
        var byKey: [String: PaidHistoryLine] = [:]
        for receipt in receipts where isPaidHistoryReceipt(receipt) {
            let items = receipt.items ?? []
            for item in items where item.quantity > 0 {
                let course = item.course ?? PosCourse.default
                let key = PaidHistoryLine.mergeKey(
                    name: item.name,
                    detail: item.detail,
                    course: course,
                    menuItemId: nil
                )
                if var existing = byKey[key] {
                    existing.quantity += item.quantity
                    existing.amountCents += item.totalCents
                    if receipt.paidAt > (existing.lastPaidAt ?? "") {
                        existing.lastPaidAt = receipt.paidAt
                    }
                    byKey[key] = existing
                } else {
                    byKey[key] = PaidHistoryLine(
                        id: key,
                        name: item.name,
                        quantity: item.quantity,
                        amountCents: item.totalCents,
                        course: course,
                        detail: item.detail,
                        lastPaidAt: receipt.paidAt,
                        menuItemId: nil
                    )
                }
            }
        }
        return byKey.values.sorted { lhs, rhs in
            if lhs.course != rhs.course { return lhs.course < rhs.course }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    static func isPaidHistoryReceipt(_ receipt: PosLocalReceipt) -> Bool {
        let status = receipt.status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if status.contains("void") { return false }
        return status.isEmpty || status == "paid"
    }

    static func byCourse(_ lines: [PaidHistoryLine]) -> [(course: Int, lines: [PaidHistoryLine])] {
        let courses = Array(Set(lines.map(\.course))).sorted()
        return courses.map { course in
            (course, lines.filter { $0.course == course })
        }
    }

    static func displayTime(_ paidAt: String?) -> String {
        guard let paidAt, !paidAt.isEmpty else { return "" }
        // ISO8601 → HH:mm lokal wenn parsebar
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: paidAt) ?? {
            let plain = ISO8601DateFormatter()
            return plain.date(from: paidAt)
        }()
        guard let date else { return "" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "de_DE")
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: date)
    }
}
