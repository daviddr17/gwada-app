import SwiftUI

enum PosDesign {
    static let cardRadius: CGFloat = 16
    static let chipRadius: CGFloat = 999

    static var cardBackground: some ShapeStyle {
        Color(.secondarySystemGroupedBackground)
    }

    static func courseColor(_ course: PosCourse) -> Color {
        switch course {
        case .starter: return .orange
        case .main: return .accentColor
        case .dessert: return .pink
        case .side: return .teal
        case .drink: return .blue
        case .other: return .secondary
        }
    }
}

struct PosPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.accentColor.opacity(configuration.isPressed ? 0.85 : 1))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous))
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
