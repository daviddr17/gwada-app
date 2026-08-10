import SwiftUI

/// Führt eine belegte Quell-Session vollständig mit einer anderen belegten Session zusammen.
struct MergeSessionSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    let sourceSessionId: String
    let sourceTableId: String
    let onMerged: () -> Void

    @State private var targetSessionId: String?
    @State private var busy = false
    @State private var errorText = ""

    private var candidates: [(table: PosLanFloorTable, session: PosLanOpenSession)] {
        guard let floor = runtime.snapshot?.floor else { return [] }
        return floor.openSessions.compactMap { session in
            guard session.id != sourceSessionId,
                  let table = floor.tables.first(where: {
                      $0.id == session.dining_table_id
                          && $0.id != sourceTableId
                          && $0.is_active
                  })
            else { return nil }
            return (table, session)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Bestellungen, Gäste und Timer werden mit dem Ziel-Tisch zusammengeführt.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Ziel-Tisch") {
                    if candidates.isEmpty {
                        Text("Kein anderer belegter Tisch.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(candidates.indices, id: \.self) { index in
                            let candidate = candidates[index]
                            Button {
                                targetSessionId = candidate.session.id
                            } label: {
                                HStack {
                                    Text(candidate.table.label).foregroundStyle(.primary)
                                    Spacer()
                                    if targetSessionId == candidate.session.id {
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
            .navigationTitle("Tische mergen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Mergen") {
                        Task { await merge() }
                    }
                    .disabled(busy || targetSessionId == nil || !runtime.canMutateLiveFloor)
                    .accessibilityIdentifier("pos.session.mergeConfirm")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("pos.session.mergeSheet")
    }

    private func merge() async {
        guard let targetSessionId else { return }
        busy = true
        errorText = ""
        defer { busy = false }

        switch await runtime.mergeSessions(
            sourceSessionId: sourceSessionId,
            targetSessionId: targetSessionId
        ) {
        case .success:
            dismiss()
            onMerged()
        case .failure:
            errorText = runtime.statusMessage.isEmpty
                ? "Mergen fehlgeschlagen."
                : runtime.statusMessage
        }
    }
}
