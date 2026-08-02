import SwiftUI

/// Tischübersicht — Grid mit großer Nummer, Status-Punkt, Timer, Gäste, Summe.
struct TablesHomeView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var tableSearch = ""
    @State private var showWalkIn = false
    @State private var tick = Date()

    private let columns = [
        GridItem(.adaptive(minimum: 148, maximum: 220), spacing: PosDesign.gridSpacing),
    ]

    var body: some View {
        Group {
            if let floor = runtime.snapshot?.floor {
                let tables = filteredTables(floor.tables)
                if tables.isEmpty {
                    ContentUnavailableView.search(text: tableSearch)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: PosDesign.sectionSpacing) {
                            floorHeader(floor: floor, tableCount: tables.count)
                            LazyVGrid(columns: columns, spacing: PosDesign.gridSpacing) {
                                ForEach(tables) { table in
                                    let open = floor.openSessions.first { $0.dining_table_id == table.id }
                                    let meta = open.flatMap { floor.sessionMetaBySessionId[$0.id] }
                                    NavigationLink {
                                        TableSessionView(table: table, sessionId: open?.id)
                                    } label: {
                                        tableCard(table: table, open: open, meta: meta)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityIdentifier("pos.table.\(table.label)")
                                }
                            }
                            statusLegend
                        }
                        .padding(PosDesign.sectionSpacing)
                    }
                    .background(PosDesign.bg)
                }
            } else {
                ContentUnavailableView {
                    Label(
                        runtime.role == .handheld
                            ? (runtime.isSoloMode ? "Keine Tische" : "Keine Kasse")
                            : "Kein Snapshot",
                        systemImage: runtime.role == .handheld
                            ? (runtime.isSoloMode ? "tray" : "wifi.exclamationmark")
                            : "tray"
                    )
                } description: {
                    Text(
                        runtime.role == .handheld
                            ? (runtime.isSoloMode
                                ? "Keine Tischdaten — Mehr → Speisekarte aktualisieren oder Gerät."
                                : "iPad suchen oder unter Mehr ohne iPad (Cloud) weiterarbeiten.")
                            : "Nach dem Login werden Tische und Speisekarte geladen."
                    )
                }
            }
        }
        .navigationTitle(floorNavigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $tableSearch, prompt: "Tische suchen")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showWalkIn = true
                } label: {
                    Image(systemName: "person.badge.plus")
                }
                .accessibilityLabel("Walk-in")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await runtime.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("Aktualisieren")
            }
        }
        .sheet(isPresented: $showWalkIn) {
            WalkInSheet()
                .environmentObject(runtime)
        }
        .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { date in
            tick = date
        }
    }

    private var floorNavigationTitle: String {
        if let name = runtime.snapshot?.restaurantName,
           !name.isEmpty,
           name != "Demo Restaurant" {
            return name
        }
        return "Tische"
    }

    @ViewBuilder
    private func floorHeader(floor: PosLanFloorSnapshot, tableCount: Int) -> some View {
        let occupied = floor.openSessions.count
        VStack(alignment: .leading, spacing: 4) {
            Text(floorNavigationTitle)
                .font(.system(.title, design: .rounded).weight(.bold))
                .foregroundStyle(PosDesign.ink)
            Text("\(occupied) von \(tableCount) Tischen belegt")
                .font(.subheadline)
                .foregroundStyle(PosDesign.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var statusLegend: some View {
        FlowLayout(spacing: 12) {
            ForEach(PosTableVisualStatus.allCases, id: \.self) { status in
                HStack(spacing: 5) {
                    Circle()
                        .fill(PosDesign.statusDotColor(for: status))
                        .frame(width: 7, height: 7)
                    Text(PosDesign.visualStatusLabel(for: status))
                        .font(.caption)
                        .foregroundStyle(PosDesign.muted)
                }
            }
        }
        .padding(.top, 6)
        .accessibilityLabel("Status-Legende")
    }

    @ViewBuilder
    private func tableCard(
        table: PosLanFloorTable,
        open: PosLanOpenSession?,
        meta: PosLanSessionFloorMeta?
    ) -> some View {
        let isOpen = open != nil
        let openCents = meta?.openCents ?? 0
        let age = open.flatMap { PosDesign.sessionAgeMinutes(openedAt: $0.opened_at, now: tick) }
        let visualStatus = PosDesign.visualStatus(isOpen: isOpen, openCents: openCents)
        let dotColor = PosDesign.statusDotColor(for: visualStatus)
        let borderTint = PosDesign.tableStatusColor(isOpen: isOpen, openCents: openCents, ageMinutes: age)
        let timerAmber = PosDesign.sessionTimerIsAmber(ageMinutes: age)

        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(dotColor)
                        .frame(width: 8, height: 8)
                        .shadow(color: isOpen ? dotColor.opacity(0.4) : .clear, radius: 4)
                    Text(PosDesign.visualStatusLabel(for: visualStatus))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(isOpen ? PosDesign.ink : PosDesign.muted)
                }
                Spacer(minLength: 4)
                if let open {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.caption2)
                        Text(PosDesign.sessionTimerLabel(openedAt: open.opened_at, now: tick))
                            .font(.caption.monospacedDigit())
                    }
                    .foregroundStyle(timerAmber ? PosDesign.statusAmber : PosDesign.muted)
                }
            }

            Text(table.label)
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .foregroundStyle(isOpen ? PosDesign.ink : PosDesign.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.65)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(floorCardSubtitle(isOpen: isOpen, visualStatus: visualStatus, coverCount: open?.cover_count))
                        .font(.subheadline)
                        .foregroundStyle(subtitleColor(for: visualStatus, isOpen: isOpen))
                    Spacer(minLength: 4)
                    if isOpen, openCents > 0 {
                        Text(PosMoney.format(openCents))
                            .font(PosDesign.fontMonoTabular.weight(.semibold))
                            .foregroundStyle(PosDesign.ink)
                    }
                }
                if let hint = nextReservationHint(for: table.id) {
                    Text(hint)
                        .font(.caption2)
                        .foregroundStyle(PosDesign.statusConflict)
                        .lineLimit(2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .background {
            if isOpen {
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .fill(PosDesign.surface)
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                .strokeBorder(
                    isOpen ? borderTint.opacity(timerAmber ? 0.55 : 0.35) : PosDesign.line,
                    style: isOpen
                        ? StrokeStyle(lineWidth: 1)
                        : StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                )
        }
    }

    private func floorCardSubtitle(isOpen: Bool, visualStatus: PosTableVisualStatus, coverCount: Int?) -> String {
        guard isOpen else { return "Tippen zum Eröffnen" }
        if visualStatus == .bezahlt { return "Gäste sitzen noch" }
        let guests = coverCount ?? 0
        return guests == 1 ? "1 Gast" : "\(guests) Gäste"
    }

    private func subtitleColor(for visualStatus: PosTableVisualStatus, isOpen: Bool) -> Color {
        if !isOpen { return PosDesign.muted }
        if visualStatus == .bezahlt { return PosDesign.statusDotColor(for: .bezahlt) }
        return PosDesign.muted
    }

    private func nextReservationHint(for tableId: String) -> String? {
        guard let day = PosReservationsStore.shared.currentDay else { return nil }
        let now = Date()
        let upcoming = day.reservations
            .compactMap { r -> (PosReservationDto, Date)? in
                guard let start = Self.parseStarts(r.startsAt) else { return nil }
                guard start > now, start.timeIntervalSince(now) < 3600 else { return nil }
                if let tid = r.diningTableId, !tid.isEmpty, tid != tableId { return nil }
                return (r, start)
            }
            .sorted { $0.1 < $1.1 }
            .first
        guard let (r, start) = upcoming else { return nil }
        let mins = Int(start.timeIntervalSince(now) / 60)
        return "Res. in \(mins) min · \(r.guestLabel)"
    }

    private func filteredTables(_ tables: [PosLanFloorTable]) -> [PosLanFloorTable] {
        let q = tableSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return tables.filter(\.is_active) }
        return tables.filter {
            $0.is_active && (
                $0.label.localizedCaseInsensitiveContains(q)
                    || "\($0.table_number)".contains(q)
            )
        }
    }

    private static func parseStarts(_ raw: String) -> Date? {
        ISO8601DateFormatter().date(from: raw)
            ?? {
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return f.date(from: raw)
            }()
    }
}

/// Einfaches Wrapping für die Status-Legende.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, frame) in result.frames.enumerated() where index < subviews.count {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var frames: [CGRect] = []

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), frames)
    }
}
