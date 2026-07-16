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
                    if runtime.role == .hub {
                        LabeledContent("Sync-Queue", value: "\(runtime.syncPending) offen")
                    }
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
                        LabeledContent("Daten", value: runtime.dataSourceLabel)
                        Text("Handgeräte laden nur über lokales WLAN. Ohne Internet läuft der Service weiter.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    if !runtime.isSignedIn {
                        Section("Cloud-Login") {
                            TextField("E-Mail", text: $runtime.email)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.emailAddress)
                            SecureField("Passwort", text: $runtime.password)
                            TextField("Restaurant-ID (UUID)", text: $runtime.restaurantIdInput)
                                .textInputAutocapitalization(.never)
                            DisclosureGroup("Erweitert") {
                                TextField("API-Basis", text: $runtime.apiBaseInput)
                                    .textInputAutocapitalization(.never)
                                TextField("Supabase-URL", text: $runtime.supabaseUrlInput)
                                    .textInputAutocapitalization(.never)
                                SecureField("Supabase Anon Key", text: $runtime.supabaseAnonInput)
                            }
                            Button("Anmelden & Daten laden") {
                                Task { await runtime.signInAndStartHub() }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    } else {
                        Section {
                            Button("Abmelden") { runtime.signOut() }
                                .foregroundStyle(.red)
                        }
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
                        Text("Start nur möglich, wenn die iPad-Kasse erreichbar ist.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Tische") {
                    if let floor = runtime.snapshot?.floor {
                        ForEach(floor.tables) { table in
                            let open = floor.openSessions.first { $0.dining_table_id == table.id }
                            VStack(alignment: .leading, spacing: 8) {
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
                                HStack {
                                    Button("Öffnen") {
                                        Task { await runtime.openTable(tableId: table.id) }
                                    }
                                    .buttonStyle(.bordered)
                                    if runtime.role == .hub {
                                        Button("+ Gericht") {
                                            Task { await runtime.addDemoOrder(tableId: table.id) }
                                        }
                                        .buttonStyle(.borderedProminent)
                                        .disabled((runtime.snapshot?.menu?.items.isEmpty ?? true))
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    } else {
                        Text(
                            runtime.role == .handheld
                                ? "Keine Kasse — Handgerät wartet."
                                : "Kein Snapshot"
                        )
                        .foregroundStyle(.secondary)
                    }
                }

                if let menu = runtime.snapshot?.menu, !menu.items.isEmpty {
                    Section("Speisekarte (\(menu.items.count))") {
                        ForEach(menu.items.prefix(12)) { item in
                            HStack {
                                Text(item.name)
                                Spacer()
                                Text(formatCents(item.priceCents))
                                    .foregroundStyle(.secondary)
                                    .tabularDigits()
                            }
                        }
                    }
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
        case .needsLogin: return "Login nötig"
        case .starting: return "Startet …"
        case .hubReady: return "Server läuft"
        case .searching: return "Suche Kasse …"
        case .connected: return "Mit Kasse verbunden"
        case .error(let message): return message
        }
    }

    private func formatCents(_ cents: Int) -> String {
        String(format: "%.2f €", Double(cents) / 100.0)
    }
}

private extension View {
    func tabularDigits() -> some View {
        self.monospacedDigit()
    }
}
