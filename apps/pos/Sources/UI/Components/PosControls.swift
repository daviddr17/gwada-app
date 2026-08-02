import SwiftUI

/// Auswahl-Chip (Gang, Kategorie, Tip) — mind. 44 pt, Text nicht am Rand.
struct PosChip: View {
    let title: String
    var selected: Bool = false
    var tint: Color = .accentColor

    var body: some View {
        Text(title)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .padding(.horizontal, PosLayout.chipPadX)
            .padding(.vertical, PosLayout.chipPadY)
            .frame(minHeight: PosLayout.touchMin)
            .background(selected ? tint.opacity(0.18) : Color(.tertiarySystemFill))
            .foregroundStyle(selected ? tint : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(selected ? tint.opacity(0.45) : Color.clear, lineWidth: 1)
            )
    }
}

/// Kompakte Status-Pille (Frei / Besetzt).
struct PosStatusBadge: View {
    let title: String
    var emphasized: Bool = false
    var tint: Color = .accentColor

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(minHeight: 28)
            .background(emphasized ? tint.opacity(0.16) : Color(.tertiarySystemFill))
            .foregroundStyle(emphasized ? tint : .secondary)
            .clipShape(Capsule())
    }
}

/// Segmentierte Umschaltung (Nach Positionen / Gleich teilen).
struct PosSegmentedControl<Option: Hashable & Identifiable>: View where Option.ID == String {
    let options: [Option]
    @Binding var selection: Option
    var title: (Option) -> String

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options) { option in
                Button {
                    selection = option
                } label: {
                    Text(title(option))
                        .font(.subheadline.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: PosLayout.touchMin)
                        .padding(.horizontal, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(selection.id == option.id
                                    ? Color.accentColor.opacity(0.2)
                                    : Color.clear)
                        )
                        .foregroundStyle(
                            selection.id == option.id
                                ? PosDesign.accentForeground
                                : Color.secondary
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(PosDesign.line, lineWidth: 1)
        }
    }
}

/// Listen-/Kartenzeile mit einheitlichem Innenabstand.
struct PosCardRow<Content: View>: View {
    var emphasized: Bool = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(PosLayout.pageTight)
            .frame(maxWidth: .infinity, minHeight: PosLayout.rowMin, alignment: .leading)
            .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(
                        emphasized ? Color.accentColor.opacity(0.55) : PosDesign.line,
                        lineWidth: 1
                    )
            }
    }
}

/// Daumen-Dock: Gradient + Safe-Area, einheitlicher Außenabstand.
struct PosThumbDock<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: PosLayout.dockGap) {
            content()
        }
        .padding(.horizontal, PosLayout.pageTight)
        .padding(.top, PosLayout.stack)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [PosDesign.bg.opacity(0), PosDesign.bg],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}

/// Horizontale Chip-Leiste mit einheitlichem Seitenpadding.
struct PosChipScroller<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: PosLayout.stack) {
                content()
            }
            .padding(.horizontal, PosLayout.page)
            .padding(.vertical, 4)
        }
    }
}

/// ± Stepper mit großen Hit-Targets.
struct PosStepperControl: View {
    let value: Int
    var range: ClosedRange<Int> = 1 ... 20
    var onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button {
                onChange(max(range.lowerBound, value - 1))
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.title)
                    .frame(width: PosLayout.touchMin, height: PosLayout.touchMin)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(value <= range.lowerBound)
            .accessibilityLabel("Weniger")

            Text("\(value)")
                .font(.title2.weight(.semibold).monospacedDigit())
                .frame(minWidth: 28)
                .accessibilityLabel("\(value)")

            Button {
                onChange(min(range.upperBound, value + 1))
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title)
                    .frame(width: PosLayout.touchMin, height: PosLayout.touchMin)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(value >= range.upperBound)
            .accessibilityLabel("Mehr")
        }
    }
}
