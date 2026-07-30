import SwiftUI

/// Walk-in: Gäste ohne Reservierung an einen freien Tisch setzen.
struct WalkInSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    @State private var covers = 2
    @State private var selectedTableId: String?
    @State private var busy = false

    private var freeTables: [PosLanFloorTable] {
        guard let floor = runtime.snapshot?.floor else { return [] }
        let occupied = Set(floor.openSessions.map(\.dining_table_id))
        return floor.tables.filter { $0.is_active && !occupied.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Gäste") {
                    Stepper("Personen: \(covers)", value: $covers, in: 1 ... 20)
                }
                Section("Freier Tisch") {
                    if freeTables.isEmpty {
                        Text("Kein freier Tisch.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(freeTables) { table in
                            Button {
                                selectedTableId = table.id
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(table.label).foregroundStyle(.primary)
                                        Text("\(table.capacity) Plätze")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if selectedTableId == table.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Walk-in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Platzieren") {
                        Task { await place() }
                    }
                    .disabled(busy || selectedTableId == nil)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear {
            if selectedTableId == nil {
                selectedTableId = freeTables.first(where: { $0.capacity >= covers })?.id
                    ?? freeTables.first?.id
            }
        }
    }

    private func place() async {
        guard let tableId = selectedTableId else { return }
        busy = true
        defer { busy = false }
        await runtime.openTable(tableId: tableId, covers: covers)
        dismiss()
    }
}
