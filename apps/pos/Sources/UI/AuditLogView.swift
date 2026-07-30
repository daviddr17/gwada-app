import SwiftUI

/// Lokales Audit-Log (Phase 5) — PIN, Zahlung, Fire, Release.
struct AuditLogView: View {
    @StateObject private var log = PosAuditLog.shared

    var body: some View {
        List {
            Section {
                Text("Append-only auf dem Gerät. Kein Upload — für Pilot-Nachweise exportieren.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if log.events.isEmpty {
                ContentUnavailableView("Noch keine Einträge", systemImage: "list.bullet.rectangle")
            } else {
                ForEach(log.events) { event in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(event.action)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(Self.formatTs(event.ts))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        if !event.detail.isEmpty {
                            Text(event.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Audit")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: log.exportText()) {
                    Image(systemName: "square.and.arrow.up")
                }
                .disabled(log.events.isEmpty)
            }
        }
    }

    private static func formatTs(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return String(iso.prefix(19)) }
        let out = DateFormatter()
        out.locale = Locale(identifier: "de_DE")
        out.dateFormat = "dd.MM. HH:mm:ss"
        return out.string(from: date)
    }
}
