import SwiftUI

struct TableSessionHistoryView: View {
    let lines: [PaidHistoryLine]
    let openLines: [SessionOpenLine]
    let tableLabel: String
    var onOrder: () -> Void
    var onCollect: () -> Void
    var onRelease: () -> Void
    var canCollect: Bool
    var canRelease: Bool

    private var openCents: Int { PosSessionOverviewMath.openCents(openLines: openLines) }
    private var sections: [(course: Int, lines: [PaidHistoryLine])] {
        PosSessionPaidHistory.byCourse(lines)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: PosLayout.stack) {
                    Text("Bezahlt")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(PosDesign.muted)
                        .accessibilityIdentifier("pos.session.history.title")

                    if lines.isEmpty {
                        Text("Noch keine bezahlten Positionen.")
                            .font(.subheadline)
                            .foregroundStyle(PosDesign.muted)
                            .padding(.vertical, 12)
                    } else {
                        ForEach(sections, id: \.course) { section in
                            courseSection(course: section.course, lines: section.lines)
                        }
                    }
                }
                .padding(.horizontal, PosLayout.page)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            dock
        }
        .accessibilityIdentifier("pos.session.history")
    }

    private func courseSection(course: Int, lines: [PaidHistoryLine]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(PosCourse.chipLabel(course)) · bezahlt")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
                .accessibilityIdentifier("pos.session.history.course.\(course)")

            ForEach(lines) { line in
                lineRow(line)
            }
        }
    }

    private func lineRow(_ line: PaidHistoryLine) -> some View {
        let time = PosSessionPaidHistory.displayTime(line.lastPaidAt)
        return PosCardRow {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(line.quantity)×")
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(PosDesign.muted)
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.name)
                        .font(.body.weight(.medium))
                    if !line.detail.isEmpty {
                        Text(line.detail)
                            .font(.caption)
                            .foregroundStyle(PosDesign.muted)
                            .lineLimit(2)
                    }
                    if !time.isEmpty {
                        Text(time)
                            .font(.caption2)
                            .foregroundStyle(PosDesign.muted)
                    }
                }
                Spacer(minLength: 4)
                Text(PosMoney.format(line.amountCents))
                    .font(.body.monospacedDigit())
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var dock: some View {
        PosThumbDock {
            if openCents > 0 {
                HStack(spacing: PosLayout.dockGap) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.history.order")
                    PosButton(
                        title: "Kassieren · \(PosMoney.format(openCents))",
                        kind: .primary,
                        enabled: canCollect,
                        action: onCollect
                    )
                    .accessibilityIdentifier("pos.session.history.collect")
                }
            } else {
                HStack(spacing: PosLayout.dockGap) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.history.order")
                    PosButton(
                        title: "\(tableLabel) freigeben",
                        kind: .primary,
                        enabled: canRelease,
                        action: onRelease
                    )
                    .accessibilityIdentifier("pos.session.history.release")
                }
            }
        }
    }
}
