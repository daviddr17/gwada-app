import SwiftUI
import UIKit

/// Design Tokens + Branding für die native POS-App (Prototyp-Palette + dynamischer Accent).
/// Surfaces bleiben System-Farben (iOS Light/Dark); Status-/Spacing-Tokens ergänzen den Prototyp.
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

    // MARK: - Foundation tokens (Phase 1)

    static let bg = Color(red: 0.96, green: 0.95, blue: 0.93)
    static let surface = Color(red: 1.0, green: 0.99, blue: 0.97)
    static let surface2 = Color(red: 0.94, green: 0.93, blue: 0.90)
    static let line = Color(red: 0.85, green: 0.83, blue: 0.79)
    static let ink = Color(red: 0.12, green: 0.11, blue: 0.10)
    static let muted = Color(red: 0.45, green: 0.43, blue: 0.40)
    static let brass = Color(red: 0.72, green: 0.58, blue: 0.32)
    static let paper = Color(red: 0.98, green: 0.96, blue: 0.90)
    static let green = Color(red: 0.22, green: 0.55, blue: 0.35)

    static var fontDisplay: Font { .system(.largeTitle, design: .rounded).weight(.bold) }
    static var fontBody: Font { .body }
    static var fontMonoTabular: Font { .body.monospaced().monospacedDigit() }

    static var cardBackground: some ShapeStyle {
        Color(.secondarySystemGroupedBackground)
    }

    static var elevatedBackground: some ShapeStyle {
        Color(.tertiarySystemBackground)
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
        guard let opened = ISO8601DateFormatter().date(from: openedAt)
            ?? isoFractional.date(from: openedAt)
        else { return nil }
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

    /// Relative Session-Dauer ab `openedAt` ISO-8601.
    static func sessionTimerLabel(openedAt: String, now: Date = Date()) -> String {
        guard let opened = ISO8601DateFormatter().date(from: openedAt)
            ?? PosDesign.isoFractional.date(from: openedAt)
        else {
            return "—"
        }
        let mins = max(0, Int(now.timeIntervalSince(opened) / 60))
        if mins < 60 { return "\(mins) min" }
        let h = mins / 60
        let m = mins % 60
        return m == 0 ? "\(h) h" : "\(h) h \(m) m"
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
