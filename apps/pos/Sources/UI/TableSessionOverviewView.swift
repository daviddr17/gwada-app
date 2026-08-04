import SwiftUI

struct TableSessionOverviewView: View {
    let openLines: [SessionOpenLine]
    let sessionId: String
    let tableLabel: String
    let paidCents: Int
    var historyLineCount: Int = 0
    var onOrder: () -> Void
    var onCollect: () -> Void
    var onRelease: () -> Void
    var onOpenBon: () -> Void
    var onOpenHistory: (() -> Void)? = nil
    var canCollect: Bool
    var canRelease: Bool

    private var openCents: Int { PosSessionOverviewMath.openCents(openLines: openLines) }
    private var sections: [(course: Int, lines: [SessionOpenLine])] {
        PosSessionOverviewMath.openLinesByCourse(openLines)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: PosLayout.stack) {
                    statsRow
                    if historyLineCount > 0, let onOpenHistory {
                        Button(action: onOpenHistory) {
                            HStack(spacing: 8) {
                                Text("Historie")
                                    .font(.subheadline.weight(.semibold))
                                Text("\(historyLineCount)")
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(PosDesign.brandAccent.opacity(0.25)))
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(PosDesign.muted)
                            }
                            .foregroundStyle(PosDesign.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(PosDesign.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .strokeBorder(PosDesign.line, lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("pos.session.overview.history")
                        .accessibilityLabel("Historie, \(historyLineCount) Positionen")
                    }
                    if openCents == 0 {
                        paidStatusChip
                    }
                    ForEach(sections, id: \.course) { section in
                        courseSection(course: section.course, lines: section.lines)
                    }
                }
                .padding(.horizontal, PosLayout.page)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            dock
        }
        .accessibilityIdentifier("pos.session.overview")
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            statChip(title: "Offen", value: PosMoney.format(openCents))
            if paidCents > 0 {
                statChip(title: "Bereits kassiert", value: PosMoney.format(paidCents))
            }
            Spacer(minLength: 0)
        }
    }

    private var paidStatusChip: some View {
        Label("Alles bezahlt", systemImage: "checkmark.circle.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(PosDesign.green)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(PosDesign.green.opacity(0.1), in: Capsule())
            .accessibilityIdentifier("pos.session.overview.allPaid")
    }

    private func statChip(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(PosDesign.ink)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(PosDesign.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(PosDesign.line, lineWidth: 1)
        }
    }

    private func courseSection(course: Int, lines: [SessionOpenLine]) -> some View {
        let header = PosSessionOverviewMath.courseStatusLabel(
            course: course,
            openLines: openLines,
            sessionId: sessionId
        )
        return VStack(alignment: .leading, spacing: 8) {
            Text(header)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
                .accessibilityIdentifier("pos.session.overview.course.\(course)")

            ForEach(lines) { line in
                Button(action: onOpenBon) {
                    lineRow(line)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func lineRow(_ line: SessionOpenLine) -> some View {
        let detail = PosSessionOverviewMath.overviewLineDetail(line)
        return PosCardRow {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(line.openQuantity)×")
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(PosDesign.muted)
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.name)
                        .font(.body.weight(.medium))
                    if !detail.isEmpty {
                        Text(detail)
                            .font(.caption)
                            .foregroundStyle(PosDesign.muted)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 4)
                Text(PosMoney.format(line.openCents))
                    .font(.body.monospacedDigit())
            }
        }
    }

    private var dock: some View {
        PosThumbDock {
            if openCents > 0 {
                HStack(spacing: PosLayout.dockGap) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.overview.order")
                    PosButton(
                        title: "Kassieren · \(PosMoney.format(openCents))",
                        kind: .primary,
                        enabled: canCollect,
                        action: onCollect
                    )
                    .accessibilityIdentifier("pos.session.overview.collect")
                }
            } else {
                HStack(spacing: PosLayout.dockGap) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.overview.order")
                    PosButton(
                        title: "\(tableLabel) freigeben",
                        kind: .primary,
                        enabled: canRelease,
                        action: onRelease
                    )
                    .accessibilityIdentifier("pos.session.overview.release")
                }
            }
        }
    }
}
