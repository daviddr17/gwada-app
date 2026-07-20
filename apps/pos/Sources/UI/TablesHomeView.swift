import SwiftUI

/// Tischübersicht — Grid mit Timer / Summe / Status (Phase 4 Prototyp).
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
                            }
                        }
                        .padding(PosDesign.sectionSpacing)
                    }
                    .background(Color(.systemGroupedBackground))
                }
            } else {
                ContentUnavailableView {
                    Label(
                        runtime.role == .handheld ? "Keine Kasse" : "Kein Snapshot",
                        systemImage: runtime.role == .handheld ? "wifi.exclamationmark" : "tray"
                    )
                } description: {
                    Text(
                        runtime.role == .handheld
                            ? "Handgerät wartet auf die iPad-Kasse im WLAN."
                            : "Nach dem Login werden Tische und Speisekarte geladen."
                    )
                }
            }
        }
        .navigationTitle("Tische")
        .navigationBarTitleDisplayMode(.large)
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

    @ViewBuilder
    private func tableCard(
        table: PosLanFloorTable,
        open: PosLanOpenSession?,
        meta: PosLanSessionFloorMeta?
    ) -> some View {
        let isOpen = open != nil
        let openCents = meta?.openCents ?? 0
        let tint = PosDesign.tableStatusColor(isOpen: isOpen, openCents: openCents)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(table.label)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                PosStatusBadge(
                    title: isOpen ? "Besetzt" : "Frei",
                    emphasized: isOpen,
                    tint: tint
                )
            }
            Text("\(table.capacity) Plätze")
                .font(.caption)
                .foregroundStyle(.secondary)
            if let open {
                HStack(spacing: 6) {
                    Image(systemName: "timer")
                        .font(.caption2)
                    Text(PosDesign.sessionTimerLabel(openedAt: open.opened_at, now: tick))
                        .font(.caption.monospacedDigit())
                    Text("· \(open.cover_count) Pers.")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
                if openCents > 0 {
                    Text(PosMoney.format(openCents))
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.primary)
                }
                // Nächste Res. Hinweis (gleicher Tag, gleicher Tisch wenn tableId gesetzt)
                if let hint = nextReservationHint(for: table.id) {
                    Text(hint)
                        .font(.caption2)
                        .foregroundStyle(PosDesign.statusConflict)
                        .lineLimit(2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
        .background(PosDesign.cardBackground, in: RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                .strokeBorder(tint.opacity(isOpen ? 0.45 : 0.12), lineWidth: 1)
        )
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
