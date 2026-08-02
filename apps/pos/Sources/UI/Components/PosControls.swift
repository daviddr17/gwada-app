import SwiftUI

/// Auswahl-Chip (Gang, Kategorie, Tip) — mind. 44 pt, Text nicht am Rand.
struct PosChip: View {
    let title: String
    var selected: Bool = false
    var tint: Color = PosDesign.brandAccent

    var body: some View {
        Text(title)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .padding(.horizontal, PosLayout.chipPadX)
            .padding(.vertical, PosLayout.chipPadY)
            .frame(minHeight: PosLayout.touchMin)
            .background(selected ? tint.opacity(0.22) : PosDesign.surface2)
            .foregroundStyle(selected ? PosDesign.accentForeground : PosDesign.ink)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(selected ? tint.opacity(0.55) : PosDesign.line, lineWidth: 1)
            )
    }
}

/// Kartenfläche für Listen/Bon (kein Thermopapier — das bleibt `PaperReceiptView`).
struct PosPanelCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(PosLayout.page)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                    .strokeBorder(PosDesign.line, lineWidth: 1)
            }
    }
}

/// Kompakte Status-Pille (Frei / Besetzt).
struct PosStatusBadge: View {
    let title: String
    var emphasized: Bool = false
    var tint: Color = PosDesign.brandAccent

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(minHeight: 28)
            .background(emphasized ? tint.opacity(0.22) : PosDesign.surface2)
            .foregroundStyle(emphasized ? PosDesign.accentForeground : PosDesign.muted)
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
                                    ? PosDesign.brandActionFill
                                    : Color.clear)
                        )
                        .foregroundStyle(
                            selection.id == option.id
                                ? PosDesign.accentForeground
                                : PosDesign.muted
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
                        emphasized ? PosDesign.brandAccent.opacity(0.55) : PosDesign.line,
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

/// Kompakte Mengen-Gruppe für Bon-Zeilen: − · Menge · +
struct PosQtyStepper: View {
    let quantity: Int
    var onDecrement: () -> Void
    var onIncrement: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onDecrement) {
                Image(systemName: "minus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(PosDesign.ink)
                    .frame(width: PosLayout.touchMin, height: PosLayout.touchMin)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Weniger")

            Text("\(quantity)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(PosDesign.ink)
                .frame(minWidth: 28)
                .accessibilityLabel("Menge \(quantity)")

            Button(action: onIncrement) {
                Image(systemName: "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(PosDesign.ink)
                    .frame(width: PosLayout.touchMin, height: PosLayout.touchMin)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mehr")
        }
        .padding(.horizontal, 4)
        .background(PosDesign.surface2, in: Capsule())
        .overlay {
            Capsule().strokeBorder(PosDesign.line, lineWidth: 1)
        }
    }
}
