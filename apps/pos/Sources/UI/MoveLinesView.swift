import SwiftUI

/// Positionen per Mehrfachauswahl auf einen anderen Tisch umziehen.
struct MoveLinesView: View {
    let lines: [SessionOpenLine]
    let tables: [PosLanFloorTable]
    let openSessions: [PosLanOpenSession]
    var currentTableId: String
    var onMove: (_ lineIds: [String], _ quantities: [Int], _ targetTableId: String) -> Void
    var onCancel: () -> Void

    @State private var selected: Set<String> = []
    @State private var targetTableId: String?
    @State private var movePulse = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Gäste setzen um? Positionen wählen und Ziel-Tisch tippen.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Positionen") {
                    ForEach(lines) { line in
                        Button {
                            toggle(line.id)
                        } label: {
                            HStack {
                                Image(systemName: selected.contains(line.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected.contains(line.id) ? Color.accentColor : .secondary)
                                Text("\(line.openQuantity)× \(line.name)")
                                    .foregroundStyle(.primary)
                                Spacer()
                            }
                        }
                    }
                }

                Section("Ziel-Tisch") {
                    ForEach(tables.filter { $0.id != currentTableId && $0.is_active }) { table in
                        let occupied = openSessions.contains { $0.dining_table_id == table.id }
                        Button {
                            targetTableId = table.id
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(table.label).font(.body.weight(.semibold))
                                    Text(occupied ? "Besetzt" : "Frei — Session wird geöffnet")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if targetTableId == table.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(Color.accentColor)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Umziehen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    guard let targetTableId else { return }
                    let picked = lines.filter { selected.contains($0.id) }
                    movePulse.toggle()
                    onMove(
                        picked.map(\.orderLineId),
                        picked.map(\.openQuantity),
                        targetTableId
                    )
                } label: {
                    Text("Auf Tisch umziehen")
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(selected.isEmpty || targetTableId == nil)
                .padding()
                .background(.ultraThinMaterial)
            }
            .sensoryFeedback(.success, trigger: movePulse)
        }
    }

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) }
        else { selected.insert(id) }
    }
}
