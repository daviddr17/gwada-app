import Foundation

enum PosCourse {
    static let starter = 1
    static let main = 2
    static let dessert = 3
    static let `default` = 2
    static let uiCourses: [Int] = [1, 2, 3]

    static func label(_ course: Int) -> String {
        switch course {
        case 1: return "Vorspeise"
        case 2: return "Hauptgang"
        case 3: return "Dessert"
        default: return "Gang \(course)"
        }
    }

    static func shortLabel(_ course: Int) -> String {
        switch course {
        case 1: return "V"
        case 2: return "H"
        case 3: return "D"
        default: return "\(course)"
        }
    }

    /// Legacy string or number from older snapshots.
    static func parse(_ raw: String?) -> Int {
        guard let raw else { return `default` }
        switch raw {
        case "1", "starter": return 1
        case "2", "main": return 2
        case "3", "dessert": return 3
        case "side", "drink", "other": return 2
        default:
            if let n = Int(raw), n >= 1 { return n }
            return `default`
        }
    }
}

enum PosPaymentMethodKind: String, CaseIterable, Identifiable, Sendable {
    case cash, card, paypal, voucher, other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cash: return "Bar"
        case .card: return "Karte"
        case .paypal: return "PayPal"
        case .voucher: return "Gutschein"
        case .other: return "Sonstiges"
        }
    }

    /// Bar + Gutschein lokal; Karte/PayPal über Nest/Mollie (Simulate).
    var available: Bool {
        self == .cash || self == .voucher || self == .card || self == .paypal
    }
}

struct PosCartModifier: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var type: String // ohne | option | text
    var label: String
    var ingredientId: String?
    var optionChoiceId: String?
    var priceDeltaCents: Int

    static func ohne(ingredientId: String, name: String) -> PosCartModifier {
        PosCartModifier(
            id: "ohne-\(ingredientId)",
            type: "ohne",
            label: "ohne \(name)",
            ingredientId: ingredientId,
            optionChoiceId: nil,
            priceDeltaCents: 0
        )
    }

    static func option(choiceId: String, name: String, priceDeltaCents: Int) -> PosCartModifier {
        PosCartModifier(
            id: "opt-\(choiceId)",
            type: "option",
            label: name,
            ingredientId: nil,
            optionChoiceId: choiceId,
            priceDeltaCents: priceDeltaCents
        )
    }
}

struct PosCartLine: Identifiable, Equatable, Sendable {
    var id: String = UUID().uuidString
    var menuItemId: String
    var name: String
    var unitPriceCents: Int
    var quantity: Int
    var course: Int
    var notes: String
    var modifiers: [PosCartModifier]

    var lineTotalCents: Int {
        let delta = modifiers.reduce(0) { $0 + $1.priceDeltaCents }
        return (unitPriceCents + delta) * quantity
    }

    var subtitle: String {
        var parts: [String] = [PosCourse.label(course)]
        let mods = modifiers.map(\.label)
        if !mods.isEmpty { parts.append(mods.joined(separator: " · ")) }
        if !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            parts.append(notes)
        }
        return parts.joined(separator: " · ")
    }

    var ohneIngredientIds: [String] {
        modifiers.compactMap { $0.type == "ohne" ? $0.ingredientId : nil }
    }

    var configurationSignature: String {
        let modIds = modifiers.map(\.id).sorted().joined(separator: ",")
        let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        return [menuItemId, "\(course)", modIds, note].joined(separator: "|")
    }
}

enum PosCart {
    /// Returns new array with `line` merged by signature (qty added) or appended.
    static func merging(_ lines: [PosCartLine], adding line: PosCartLine) -> [PosCartLine] {
        var out = lines
        if let idx = out.firstIndex(where: { $0.configurationSignature == line.configurationSignature }) {
            out[idx].quantity += line.quantity
            return out
        }
        out.append(line)
        return out
    }

    /// Moves/merges when course changes on an existing line id.
    static func changingCourse(_ lines: [PosCartLine], lineId: String, to course: Int) -> [PosCartLine] {
        guard let idx = lines.firstIndex(where: { $0.id == lineId }) else { return lines }
        var moved = lines[idx]
        moved.course = course
        var without = lines
        without.remove(at: idx)
        return merging(without, adding: moved)
    }
}

enum PosMoney {
    static func format(_ cents: Int) -> String {
        String(format: "%.2f €", Double(cents) / 100.0)
    }
}
