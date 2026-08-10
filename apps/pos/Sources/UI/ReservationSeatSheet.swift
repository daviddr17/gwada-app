import SwiftUI

/// Platzieren: zugewiesenen freien Tisch bestätigen oder freien Tisch wählen.
struct ReservationSeatSheet: View {
    let reservation: PosReservationDto
    let freeTables: [PosLanFloorTable]
    var isSubmitting: Bool = false
    var errorMessage: String = ""
    var onConfirm: (_ diningTableId: String) -> Void
    var onCancel: () -> Void

    @State private var selectedTableId: String?

    private var assignedFreeTable: PosLanFloorTable? {
        guard let tid = reservation.diningTableId?.trimmingCharacters(in: .whitespacesAndNewlines),
              !tid.isEmpty
        else { return nil }
        return freeTables.first(where: { $0.id == tid })
    }

    private var sortedFreeTables: [PosLanFloorTable] {
        freeTables.sorted { a, b in
            let aFit = a.capacity >= reservation.partySize
            let bFit = b.capacity >= reservation.partySize
            if aFit != bFit { return aFit && !bFit }
            if a.capacity != b.capacity { return a.capacity < b.capacity }
            return a.table_number < b.table_number
        }
    }

    private var canConfirm: Bool {
        !isSubmitting && selectedTableId != nil && !freeTables.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Reservierung") {
                    LabeledContent("Gast", value: reservation.guestLabel)
                    LabeledContent("Personen", value: "\(reservation.partySize)")
                    if let assigned = assignedFreeTable {
                        LabeledContent("Tisch", value: assigned.label)
                    } else if let label = reservation.table?.tableName
                        ?? reservation.table.map({ "Tisch \($0.tableNumber)" })
                    {
                        LabeledContent("Zugewiesen", value: "\(label) (belegt)")
                    }
                }

                if let assigned = assignedFreeTable {
                    Section {
                        Text("Tisch \(assigned.label) ist frei — Gäste platzieren?")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section("Freier Tisch") {
                        if sortedFreeTables.isEmpty {
                            Text("Kein freier Tisch.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(sortedFreeTables) { table in
                                Button {
                                    selectedTableId = table.id
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(table.label).foregroundStyle(.primary)
                                            Text(capacityCaption(table))
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

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Platzieren")
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("pos.seat.sheet")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmTitle) {
                        guard let id = selectedTableId else { return }
                        onConfirm(id)
                    }
                    .disabled(!canConfirm)
                    .accessibilityIdentifier("pos.seat.confirm")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear {
            if selectedTableId == nil {
                selectedTableId = assignedFreeTable?.id
                    ?? sortedFreeTables.first(where: { $0.capacity >= reservation.partySize })?.id
                    ?? sortedFreeTables.first?.id
            }
        }
    }

    private var confirmTitle: String {
        if let assigned = assignedFreeTable {
            return "Tisch \(assigned.label) platzieren"
        }
        return "Platzieren"
    }

    private func capacityCaption(_ table: PosLanFloorTable) -> String {
        let base = "\(table.capacity) Plätze"
        if table.capacity >= reservation.partySize {
            return base
        }
        return "\(base) · eng"
    }
}
