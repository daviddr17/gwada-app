import SwiftUI

/// Phase 6: Hard-Reject der Handheld-Outbox (Tisch zu / Session weg).
struct OutboxConflictPresentation: Identifiable, Equatable {
    var id: String
    var title: String
    var reason: String
    var detailLines: [String]
    var tableHint: String?

    static func fromHardReject(
        message: String,
        payload: PosHandheldOutbox.CreateOrderPayload,
        tableLabel: String?
    ) -> OutboxConflictPresentation {
        let reason: String
        let lower = message.lowercased()
        if lower.contains("session_gone") || lower.contains("session not") {
            reason = "Der Tisch ist auf der Kasse nicht mehr offen (geschlossen oder umgezogen)."
        } else if lower.contains("unpaired") || lower.contains("unauthorized") {
            reason = "Kopplung ungültig — bitte erneut mit der Kasse verbinden."
        } else if message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            reason = "Die Kasse hat die Bestellung abgelehnt."
        } else {
            reason = message
        }
        let lines = payload.items.map { item in
            let name = item.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let label = name.isEmpty ? "Position" : name
            return "\(item.quantity)× \(label)"
        }
        let hint: String?
        if let tableLabel, !tableLabel.isEmpty {
            hint = tableLabel.hasPrefix("Tisch") ? tableLabel : "Tisch \(tableLabel)"
        } else {
            hint = nil
        }
        return OutboxConflictPresentation(
            id: payload.eventId,
            title: "Bestellung nicht übernommen",
            reason: reason,
            detailLines: lines,
            tableHint: hint
        )
    }
}

struct OutboxConflictSheet: View {
    let conflict: OutboxConflictPresentation
    var onDismiss: () -> Void
    var onReload: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: PosLayout.stack) {
                Text(conflict.reason)
                    .font(.body)
                    .foregroundStyle(PosDesign.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if let hint = conflict.tableHint {
                    Text(hint)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(PosDesign.muted)
                }

                if !conflict.detailLines.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Verworfen")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PosDesign.muted)
                        ForEach(conflict.detailLines, id: \.self) { line in
                            Text(line)
                                .font(.subheadline)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                }

                Text("Die Positionen wurden lokal zurückgenommen. Bitte Tisch prüfen und bei Bedarf neu bestellen.")
                    .font(.footnote)
                    .foregroundStyle(PosDesign.muted)

                Spacer(minLength: 0)

                VStack(spacing: 10) {
                    PosButton(title: "Verstanden", kind: .primary, action: onDismiss)
                    PosButton(title: "Tisch neu laden", kind: .secondary, action: onReload)
                }
            }
            .padding(PosLayout.page)
            .navigationTitle(conflict.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Schließen", action: onDismiss)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
