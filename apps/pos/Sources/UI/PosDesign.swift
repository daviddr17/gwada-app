import SwiftUI
import UIKit

/// Floor-Status für Status-Punkte (Briefing: frei … bezahlt).
enum PosTableVisualStatus: String, CaseIterable {
    case frei
    case besetzt
    case bestellt
    case serviert
    case zahlt
    case bezahlt
}

/// Design Tokens — Gwada-Marke wie Web/Superadmin (`globals.css` `--brand-accent` #EAB308).
/// Restaurant-`brandAccentHex` wird in der POS-UI **nicht** übernommen.
/// Light ≈ Web `:root` (nahezu weiß / Card weiß); Dark bleibt lesbar.
enum PosDesign {
    /// Web `--brand-accent` / AccentColor asset.
    static let defaultAccentHex = "#EAB308"
    /// Web `--accent-foreground`.
    static let accentForeground = Color(red: 23 / 255, green: 23 / 255, blue: 23 / 255)

    static let cardRadius: CGFloat = PosLayout.cardRadius
    static let chipRadius: CGFloat = PosLayout.chipRadius
    static let gridSpacing: CGFloat = 12
    static let sectionSpacing: CGFloat = PosLayout.section
    static let touchMin: CGFloat = PosLayout.touchMin

    /// Feste Markenfarbe (nicht Tenant-Override).
    static let brandAccent = Color(uiColor: uiColor(hex: defaultAccentHex))

    /// Web `--brand-action-bg` (≈ accent 13% auf Card).
    static let brandActionFill = adaptiveColor(
        light: uiColor(hex: "#F7F1D6"),
        dark: uiColor(hex: "#3A3420")
    )
    static let brandActionFillPressed = adaptiveColor(
        light: uiColor(hex: "#F0E6B8"),
        dark: uiColor(hex: "#4A4228")
    )
    /// Web `--brand-action-border`.
    static let brandActionBorder = adaptiveColor(
        light: uiColor(hex: "#E5D48A"),
        dark: uiColor(hex: "#6B5E2E")
    )

    // MARK: - Status (Tischplan)

    static let statusFree = Color(.systemGray)
    static let statusOccupied = brandAccent
    static let statusConflict = Color.red
    static let statusAmber = Color(red: 0.85, green: 0.55, blue: 0.15)

    // MARK: - Foundation (Web light / readable dark)

    /// Web `--background` ≈ oklch(0.99 …)
    static let bg = adaptiveColor(
        light: uiColor(hex: "#FCFCFB"),
        dark: uiColor(hex: "#1C1C1E")
    )
    /// Web `--card`
    static let surface = adaptiveColor(
        light: uiColor(hex: "#FFFFFF"),
        dark: uiColor(hex: "#2C2C2E")
    )
    /// Web `--secondary` / `--muted`
    static let surface2 = adaptiveColor(
        light: uiColor(hex: "#F5F5F3"),
        dark: uiColor(hex: "#3A3A3C")
    )
    /// Web `--border`
    static let line = adaptiveColor(
        light: uiColor(hex: "#E8E6E1"),
        dark: uiColor(hex: "#48484A")
    )
    /// Web `--foreground` / primary text
    static let ink = adaptiveColor(
        light: uiColor(hex: "#2C2C33"),
        dark: uiColor(hex: "#F5F5F7")
    )
    /// Web `--muted-foreground`
    static let muted = adaptiveColor(
        light: uiColor(hex: "#6B6B76"),
        dark: uiColor(hex: "#A1A1A6")
    )
    static let brass = adaptiveColor(
        light: uiColor(hex: "#B8924A"),
        dark: uiColor(hex: "#C9A45C")
    )
    /// Nur für echte Belege (`PaperReceiptView`), nicht Bestell-UI.
    static let paper = Color(red: 246 / 255, green: 241 / 255, blue: 226 / 255)
    static let green = adaptiveColor(
        light: uiColor(hex: "#2F7A4D"),
        dark: uiColor(hex: "#3D9B63")
    )

    static var fontDisplay: Font { .system(.largeTitle, design: .rounded).weight(.bold) }
    static var fontBody: Font { .body }
    static var fontMonoTabular: Font { .body.monospaced().monospacedDigit() }

    static var cardBackground: some ShapeStyle { surface }

    // MARK: - Status dots (floor)

    static func statusDotColor(for status: PosTableVisualStatus) -> Color {
        switch status {
        case .frei:
            return adaptiveColor(light: uiColor(hex: "#8E8E93"), dark: uiColor(hex: "#636366"))
        case .besetzt:
            return adaptiveColor(light: uiColor(hex: "#5B8A6E"), dark: brassUIColor)
        case .bestellt:
            return adaptiveColor(light: uiColor(hex: "#C46A18"), dark: uiColor(hex: "#E88A2E"))
        case .serviert:
            return adaptiveColor(light: uiColor(hex: "#2F8A68"), dark: uiColor(hex: "#3DA87A"))
        case .zahlt:
            return brandAccent
        case .bezahlt:
            return adaptiveColor(light: uiColor(hex: "#6B5B99"), dark: uiColor(hex: "#9B8AD4"))
        }
    }

    /// Heuristik bis feinere Session-States (serviert/zahlt) verfügbar sind.
    static func visualStatus(isOpen: Bool, openCents: Int, paidSettled: Bool = false) -> PosTableVisualStatus {
        guard isOpen else { return .frei }
        if paidSettled { return .bezahlt }
        if openCents > 0 { return .bestellt }
        return .besetzt
    }

    static func visualStatusLabel(for status: PosTableVisualStatus) -> String {
        switch status {
        case .frei: return "Frei"
        case .besetzt: return "Besetzt"
        case .bestellt: return "Bestellt"
        case .serviert: return "Serviert"
        case .zahlt: return "Zahlt"
        case .bezahlt: return "Bezahlt"
        }
    }

    /// Immer Gwada-Marke — Restaurant-Hex wird ignoriert.
    static func resolveAccentHex(_ raw: String?) -> String {
        _ = raw
        return defaultAccentHex
    }

    static func color(hex: String) -> Color {
        Color(uiColor: uiColor(hex: resolveAccentHex(hex)))
    }

    static func courseColor(_ course: Int) -> Color {
        switch course {
        case 1: return .orange
        case 2: return brass
        case 3: return .pink
        default: return muted
        }
    }

    static let sessionAmberAfterMinutes = 45

    enum PosTableChromeTone: Equatable {
        case free
        case occupied
        case occupiedSoft
        case amber
    }

    static func sessionAgeMinutes(openedAt: String, now: Date = Date()) -> Int? {
        guard let opened = parseOpenedAt(openedAt) else { return nil }
        return max(0, Int(now.timeIntervalSince(opened) / 60))
    }

    static func sessionTimerIsAmber(ageMinutes: Int?) -> Bool {
        guard let ageMinutes else { return false }
        return ageMinutes >= sessionAmberAfterMinutes
    }

    static func tableStatusChromeTone(isOpen: Bool, openCents: Int, ageMinutes: Int? = nil) -> PosTableChromeTone {
        guard isOpen else { return .free }
        if sessionTimerIsAmber(ageMinutes: ageMinutes) { return .amber }
        if openCents <= 0 { return .occupiedSoft }
        return .occupied
    }

    static func tableStatusColor(isOpen: Bool, openCents: Int, ageMinutes: Int? = nil) -> Color {
        switch tableStatusChromeTone(isOpen: isOpen, openCents: openCents, ageMinutes: ageMinutes) {
        case .free: return statusFree
        case .occupied: return statusOccupied
        case .occupiedSoft: return statusOccupied.opacity(0.85)
        case .amber: return statusAmber
        }
    }

    static func normalizeHex(_ raw: String?) -> String? {
        guard var s = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else {
            return nil
        }
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, s.allSatisfy(\.isHexDigit) else { return nil }
        return "#\(s.uppercased())"
    }

    static func uiColor(hex: String) -> UIColor {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = CGFloat((value >> 16) & 0xFF) / 255
        let g = CGFloat((value >> 8) & 0xFF) / 255
        let b = CGFloat(value & 0xFF) / 255
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }

    private static var brassUIColor: UIColor {
        uiColor(hex: "#C9A45C")
    }

    static func adaptiveColor(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }

    /// Relative Session-Dauer ab `openedAt` ISO-8601.
    static func sessionTimerLabel(openedAt: String, now: Date = Date()) -> String {
        guard let mins = sessionAgeMinutes(openedAt: openedAt, now: now) else {
            return "—"
        }
        if mins < 60 { return "\(mins) min" }
        let h = mins / 60
        let m = mins % 60
        return m == 0 ? "\(h) h" : "\(h) h \(m) m"
    }

    private static func parseOpenedAt(_ openedAt: String) -> Date? {
        ISO8601DateFormatter().date(from: openedAt) ?? isoFractional.date(from: openedAt)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
