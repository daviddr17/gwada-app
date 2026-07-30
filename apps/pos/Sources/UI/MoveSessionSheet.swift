import SwiftUI

/// Gesamte Session auf einen anderen Tisch umziehen (nicht nur Linien).
struct MoveSessionSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    let sessionId: String
    let fromTableId: String

    @State private var targetTableId: String?
    @State private var busy = false
    @State private var errorText = ""

    private var candidates: [PosLanFloorTable] {
        guard let floor = runtime.snapshot?.floor else { return [] }
        let occupied = Set(floor.openSessions.map(\.dining_table_id))
        return floor.tables.filter {
            $0.is_active && $0.id != fromTableId && !occupied.contains($0.id)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Order, Gäste und Timer wandern mit der Session.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Ziel-Tisch") {
                    if candidates.isEmpty {
                        Text("Kein freier Tisch.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(candidates) { table in
                            Button {
                                targetTableId = table.id
                            } label: {
                                HStack {
                                    Text(table.label).foregroundStyle(.primary)
                                    Spacer()
                                    if targetTableId == table.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                            }
                        }
                    }
                }
                if !errorText.isEmpty {
                    Section {
                        Text(errorText).foregroundStyle(.red).font(.footnote)
                    }
                }
            }
            .navigationTitle("Tisch umziehen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Umziehen") {
                        Task { await move() }
                    }
                    .disabled(busy || targetTableId == nil)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func move() async {
        guard let toId = targetTableId else { return }
        busy = true
        defer { busy = false }
        let ok = await runtime.moveSession(sessionId: sessionId, toTableId: toId)
        if ok {
            dismiss()
        } else {
            errorText = runtime.statusMessage.isEmpty
                ? "Umziehen fehlgeschlagen."
                : runtime.statusMessage
        }
    }
}
