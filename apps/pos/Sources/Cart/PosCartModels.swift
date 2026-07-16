import Foundation

enum PosCourse: String, Codable, CaseIterable, Identifiable, Sendable {
    case starter, main, dessert, side, drink, other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .starter: return "Vorspeise"
        case .main: return "Hauptgang"
        case .dessert: return "Dessert"
        case .side: return "Beilage"
        case .drink: return "Getränk"
        case .other: return "Sonstiges"
        }
    }

    var shortLabel: String {
        switch self {
        case .starter: return "V"
        case .main: return "H"
        case .dessert: return "D"
        case .side: return "B"
        case .drink: return "G"
        case .other: return "·"
        }
    }
}

enum PosPaymentMethodKind: String, CaseIterable, Identifiable, Sendable {
    case cash, card, voucher, other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cash: return "Bar"
        case .card: return "Karte"
        case .voucher: return "Gutschein"
        case .other: return "Sonstiges"
        }
    }

    /// Karte/Sonstiges folgen (Mollie/Adyen); Gutschein + Bar aktiv.
    var available: Bool { self == .cash || self == .voucher }
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
    var course: PosCourse
    var notes: String
    var modifiers: [PosCartModifier]

    var lineTotalCents: Int {
        let delta = modifiers.reduce(0) { $0 + $1.priceDeltaCents }
        return (unitPriceCents + delta) * quantity
    }

    var subtitle: String {
        var parts: [String] = [course.label]
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
}

enum PosMoney {
    static func format(_ cents: Int) -> String {
        String(format: "%.2f €", Double(cents) / 100.0)
    }
}
