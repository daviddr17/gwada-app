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

/// Design Tokens + Branding für die native POS-App (Prototyp-Palette + dynamischer Accent).
/// Adaptive Light/Dark semantic tokens; Light = warm cream baseline, Dark = briefing greens.
enum PosDesign {
    static let defaultAccentHex = "#EAB308"
    static let cardRadius: CGFloat = 16
    static let chipRadius: CGFloat = 999
    static let gridSpacing: CGFloat = 12
    static let sectionSpacing: CGFloat = 16
    static let touchMin: CGFloat = 44

    /// Dunkler Text auf warmem Gold (wie Web `--accent-foreground`).
    static let accentForeground = Color(red: 23 / 255, green: 23 / 255, blue: 23 / 255)

    // MARK: - Status (Tischplan)

    static let statusFree = Color(.systemGray)
    static let statusOccupied = Color.accentColor
    static let statusBill = Color.orange
    static let statusPaid = green
    static let statusConflict = Color.red
    static let statusAmber = Color(red: 0.85, green: 0.55, blue: 0.15)

    // MARK: - Foundation tokens (adaptive Light/Dark)

    static let bg = adaptiveColor(
        light: rgba(0.96, 0.95, 0.93),
        dark: uiColor(hex: "#101B16")
    )
    static let surface = adaptiveColor(
        light: rgba(1.0, 0.99, 0.97),
        dark: uiColor(hex: "#18261F")
    )
    static let surface2 = adaptiveColor(
        light: rgba(0.94, 0.93, 0.90),
        dark: uiColor(hex: "#1E3028")
    )
    static let line = adaptiveColor(
        light: rgba(0.85, 0.83, 0.79),
        dark: uiColor(hex: "#2A3D34")
    )
    static let ink = adaptiveColor(
        light: rgba(0.12, 0.11, 0.10),
        dark: uiColor(hex: "#F5F0E8")
    )
    static let muted = adaptiveColor(
        light: rgba(0.45, 0.43, 0.40),
        dark: uiColor(hex: "#A8B5AD")
    )
    static let brass = adaptiveColor(
        light: rgba(0.72, 0.58, 0.32),
        dark: rgba(0.78, 0.64, 0.38)
    )
    static let paper = adaptiveColor(
        light: rgba(0.98, 0.96, 0.90),
        dark: rgba(0.14, 0.20, 0.17)
    )
    static let green = adaptiveColor(
        light: rgba(0.22, 0.55, 0.35),
        dark: rgba(0.35, 0.68, 0.48)
    )

    static var fontDisplay: Font { .system(.largeTitle, design: .rounded).weight(.bold) }
    static var fontBody: Font { .body }
    static var fontMonoTabular: Font { .body.monospaced().monospacedDigit() }

    static var cardBackground: some ShapeStyle {
        surface
    }

    static var elevatedBackground: some ShapeStyle {
        surface2
    }

    // MARK: - Status dots (floor)

    static func statusDotColor(for status: PosTableVisualStatus) -> Color {
        switch status {
        case .frei:
            return adaptiveColor(light: rgba(0.54, 0.53, 0.50), dark: rgba(0.42, 0.46, 0.44))
        case .besetzt:
            return adaptiveColor(light: rgba(0.36, 0.54, 0.45), dark: brassUIColor)
        case .bestellt:
            return adaptiveColor(light: rgba(0.72, 0.42, 0.13), dark: rgba(0.91, 0.55, 0.23))
        case .serviert:
            return adaptiveColor(light: rgba(0.24, 0.55, 0.43), dark: rgba(0.30, 0.65, 0.48))
        case .zahlt:
            return adaptiveColor(light: rgba(0.83, 0.57, 0.04), dark: rgba(0.92, 0.70, 0.03))
        case .bezahlt:
            return adaptiveColor(light: rgba(0.48, 0.36, 0.66), dark: rgba(0.65, 0.55, 0.98))
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

    static func resolveAccentHex(_ raw: String?) -> String {
        guard let normalized = normalizeHex(raw) else { return defaultAccentHex }
        return normalized
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

    private static func rgba(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, alpha: CGFloat = 1) -> UIColor {
        UIColor(red: r, green: g, blue: b, alpha: alpha)
    }

    private static var brassUIColor: UIColor {
        rgba(0.78, 0.64, 0.38)
    }

    private static func adaptiveColor(light: UIColor, dark: UIColor) -> Color {
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

/// Primär-CTA wie Web `brand-action-button`: weicher Accent-Tint, dunkler Text, `rounded-xl`.
struct PosPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(PosDesign.accentForeground)
            .background(
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .fill(Color.accentColor.opacity(configuration.isPressed ? 0.22 : 0.15))
            )
            .overlay(
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .strokeBorder(Color.accentColor.opacity(0.35), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.92 : 1)
    }
}

/// Sekundär / Outline-Aktion.
struct PosSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.primary)
            .background(
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .fill(Color(.tertiarySystemFill).opacity(configuration.isPressed ? 0.85 : 1))
            )
            .opacity(configuration.isPressed ? 0.92 : 1)
    }
}

/// Kompakte Status-Pille (Frei / Besetzt / Hub online).
struct PosStatusBadge: View {
    let title: String
    var emphasized: Bool = false
    var tint: Color = .accentColor

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(emphasized ? tint.opacity(0.16) : Color(.tertiarySystemFill))
            .foregroundStyle(emphasized ? tint : .secondary)
            .clipShape(Capsule())
    }
}

struct PosChip: View {
    let title: String
    var selected: Bool = false
    var tint: Color = .accentColor

    var body: some View {
        Text(title)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(selected ? tint.opacity(0.18) : Color(.tertiarySystemFill))
            .foregroundStyle(selected ? tint : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(selected ? tint.opacity(0.45) : Color.clear, lineWidth: 1)
            )
    }
}
