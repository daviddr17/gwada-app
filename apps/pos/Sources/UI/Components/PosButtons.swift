import SwiftUI

// MARK: - Button styles (nur Chrome — Label bringt Font/Inhalt)

/// Primär-CTA: Accent-Tint, mind. `PosLayout.buttonMin`, seitliches Padding.
struct PosPrimaryButtonStyle: ButtonStyle {
    var minHeight: CGFloat = PosLayout.buttonMin

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .padding(.horizontal, PosLayout.buttonPadX)
            .foregroundStyle(PosDesign.accentForeground)
            .background(
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .fill(Color.accentColor.opacity(configuration.isPressed ? 0.22 : 0.15))
            )
            .overlay(
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .strokeBorder(Color.accentColor.opacity(0.35), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.92 : 1)
            .contentShape(RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous))
    }
}

/// Sekundär / Outline-Fill.
struct PosSecondaryButtonStyle: ButtonStyle {
    var minHeight: CGFloat = PosLayout.buttonMin

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .padding(.horizontal, PosLayout.buttonPadX)
            .foregroundStyle(.primary)
            .background(
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .fill(Color(.tertiarySystemFill).opacity(configuration.isPressed ? 0.85 : 1))
            )
            .opacity(configuration.isPressed ? 0.92 : 1)
            .contentShape(RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous))
    }
}

/// Outline mit Accent-Rand.
struct PosOutlineAccentButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, minHeight: PosLayout.amountButtonMin)
            .padding(.horizontal, PosLayout.buttonPadX)
            .foregroundStyle(.primary)
            .background(
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .fill(PosDesign.surface.opacity(configuration.isPressed ? 0.7 : 1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .strokeBorder(Color.accentColor, lineWidth: 2)
            )
            .opacity(configuration.isPressed ? 0.92 : 1)
            .contentShape(RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous))
    }
}

// MARK: - Ready-made buttons

enum PosButtonKind {
    case primary, secondary, outline
}

/// Einzeiliger Primär-/Sekundär-Button — Text mittig, nie am Rand.
struct PosButton: View {
    let title: String
    var kind: PosButtonKind = .primary
    var enabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.85)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .modifier(PosButtonKindModifier(kind: kind, amountSized: false))
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.45)
    }
}

/// Daumen-Dock-CTA mit Titel + Betrag (Prototyp „Rest / Alles kassieren“).
struct PosAmountButton: View {
    let title: String
    let amountCents: Int
    var kind: PosButtonKind = .primary
    var enabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.center)
                Text(PosMoney.format(amountCents))
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity)
        }
        .modifier(PosButtonKindModifier(kind: kind, amountSized: true))
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.45)
        .accessibilityLabel("\(title), \(PosMoney.format(amountCents))")
    }
}

private struct PosButtonKindModifier: ViewModifier {
    let kind: PosButtonKind
    let amountSized: Bool

    func body(content: Content) -> some View {
        switch kind {
        case .primary:
            content.buttonStyle(PosPrimaryButtonStyle(
                minHeight: amountSized ? PosLayout.amountButtonMin : PosLayout.buttonMin
            ))
        case .secondary:
            content.buttonStyle(PosSecondaryButtonStyle(
                minHeight: amountSized ? PosLayout.amountButtonMin : PosLayout.buttonMin
            ))
        case .outline:
            content.buttonStyle(PosOutlineAccentButtonStyle())
        }
    }
}
