import SwiftUI

struct RootView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var hubIP = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Gerät") {
                    LabeledContent("Erkennung", value: runtime.detectionLabel)
                    LabeledContent("Rolle", value: runtime.role.title)
                    LabeledContent("Status", value: phaseLabel)
                    if !runtime.statusMessage.isEmpty {
                        Text(runtime.statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if runtime.role == .hub {
                    Section("Kasse (Server)") {
                        LabeledContent("Port", value: "\(PosLanProtocol.hubPort)")
                        LabeledContent(
                            "Bonjour",
                            value: runtime.bonjourPublishing ? "Aktiv (_gwada-pos._tcp)" : "—"
                        )
                        Text("Handgeräte holen beim Start den Snapshot über das lokale WLAN.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section("Verbindung zur Kasse") {
                        if let url = runtime.hubBaseURL {
                            LabeledContent("Hub", value: url.absoluteString)
                        }
                        TextField("Hub-IP (Fallback)", text: $hubIP)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.numbersAndPunctuation)
                        Button("Hub-IP speichern & abrufen") {
                            Task { await runtime.saveManualHost(hubIP) }
                        }
                        .disabled(hubIP.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }

                Section("Tische") {
                    if let floor = runtime.snapshot?.floor {
                        ForEach(floor.tables) { table in
                            let open = floor.openSessions.first { $0.dining_table_id == table.id }
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(table.label).font(.headline)
                                    Text("Nr. \(table.table_number) · \(table.capacity) Plätze")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(open == nil ? "Frei" : "Besetzt · \(open!.cover_count)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(open == nil ? .secondary : Color.accentColor)
                            }
                        }
                    } else {
                        Text(runtime.role == .handheld ? "Warte auf Snapshot von der Kasse …" : "Kein Snapshot")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Text("Phase 1: Demo-Daten auf dem Hub. Cloud-Login & echte Floor-API folgen.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Gwada POS")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Aktualisieren") {
                        Task { await runtime.refresh() }
                    }
                }
            }
        }
    }

    private var phaseLabel: String {
        switch runtime.phase {
        case .idle: return "Bereit"
        case .starting: return "Startet …"
        case .hubReady: return "Server läuft"
        case .searching: return "Suche Kasse …"
        case .connected: return "Mit Kasse verbunden"
        case .error(let message): return message
        }
    }
}
