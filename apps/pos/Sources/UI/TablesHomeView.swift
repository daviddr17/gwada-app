import SwiftUI

/// Tischübersicht (Detail der nativen Sidebar).
struct TablesHomeView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var tableSearch = ""

    var body: some View {
        Group {
            if let floor = runtime.snapshot?.floor {
                let tables = filteredTables(floor.tables)
                if tables.isEmpty {
                    ContentUnavailableView.search(text: tableSearch)
                } else {
                    List {
                        ForEach(tables) { table in
                            let open = floor.openSessions.first { $0.dining_table_id == table.id }
                            let meta = open.flatMap { floor.sessionMetaBySessionId[$0.id] }
                            NavigationLink {
                                TableSessionView(table: table, sessionId: open?.id)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: open == nil ? "fork.knife" : "person.2.fill")
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(open == nil ? .secondary : Color.accentColor)
                                        .frame(width: 36, height: 36)
                                        .background(
                                            open == nil
                                                ? Color(.tertiarySystemFill)
                                                : Color.accentColor.opacity(0.14)
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(table.label).font(.headline)
                                        Text("Nr. \(table.table_number) · \(table.capacity) Plätze")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 4) {
                                        PosStatusBadge(
                                            title: open == nil ? "Frei" : "Besetzt",
                                            emphasized: open != nil
                                        )
                                        if let meta, meta.openCents > 0 {
                                            Text(PosMoney.format(meta.openCents))
                                                .font(.caption.weight(.semibold).monospacedDigit())
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
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
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await runtime.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("Aktualisieren")
            }
        }
    }

    private func filteredTables(_ tables: [PosLanFloorTable]) -> [PosLanFloorTable] {
        let q = tableSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return tables }
        return tables.filter {
            $0.label.localizedCaseInsensitiveContains(q)
                || "\($0.table_number)".contains(q)
        }
    }
}
