import SwiftUI

struct RootView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var hubIP = ""
    @State private var showKds = false
    @State private var confirmSignOut = false
    @State private var tableSearch = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Erkennung", value: runtime.detectionLabel)
                    LabeledContent("Rolle", value: runtime.role.title)
                    HStack {
                        Text("Status")
                        Spacer()
                        PosStatusBadge(
                            title: phaseLabel,
                            emphasized: runtime.phase == .hubReady || runtime.phase == .connected
                        )
                    }
                    if runtime.role == .hub {
                        LabeledContent("Sync-Queue", value: "\(runtime.syncPending) offen")
                    }
                    if !runtime.statusMessage.isEmpty {
                        Text(runtime.statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Gerät")
                }

                if runtime.role == .hub {
                    Section("Kasse (Server)") {
                        LabeledContent("Port", value: "\(PosLanProtocol.hubPort)")
                        LabeledContent(
                            "Bonjour",
                            value: runtime.bonjourPublishing ? "Aktiv (_gwada-pos._tcp)" : "—"
                        )
                        LabeledContent("Daten", value: runtime.dataSourceLabel)
                        Text("Handgeräte & KDS über lokales WLAN — auch ohne Internet.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button {
                            showKds = true
                        } label: {
                            Label("KDS öffnen", systemImage: "flame")
                        }
                    }

                    if !runtime.isSignedIn {
                        Section("Cloud-Login") {
                            TextField("E-Mail", text: $runtime.email)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.emailAddress)
                                .textContentType(.username)
                            SecureField("Passwort", text: $runtime.password)
                                .textContentType(.password)
                            TextField("Restaurant-ID (UUID)", text: $runtime.restaurantIdInput)
                                .textInputAutocapitalization(.never)
                            DisclosureGroup("Erweitert") {
                                TextField("API-Basis", text: $runtime.apiBaseInput)
                                    .textInputAutocapitalization(.never)
                                TextField("Supabase-URL", text: $runtime.supabaseUrlInput)
                                    .textInputAutocapitalization(.never)
                                SecureField("Supabase Anon Key", text: $runtime.supabaseAnonInput)
                            }
                            Button {
                                Task { await runtime.signInAndStartHub() }
                            } label: {
                                Text("Anmelden & Daten laden")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PosPrimaryButtonStyle())
                            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                            .listRowBackground(Color.clear)
                        }
                    } else {
                        Section {
                            Button("Abmelden", role: .destructive) {
                                confirmSignOut = true
                            }
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
                        let tables = filteredTables(floor.tables)
                        if tables.isEmpty {
                            ContentUnavailableView.search(text: tableSearch)
                        } else {
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
                                                (open == nil ? Color(.tertiarySystemFill) : Color.accentColor.opacity(0.14))
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
            }
            .navigationTitle(navigationTitle)
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
            .confirmationDialog(
                "Wirklich abmelden?",
                isPresented: $confirmSignOut,
                titleVisibility: .visible
            ) {
                Button("Abmelden", role: .destructive) { runtime.signOut() }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text("Die lokale Kasse stoppt; Handgeräte verlieren die Verbindung.")
            }
            .sheet(isPresented: $showKds) {
                NavigationStack {
                    KdsView()
                        .environmentObject(runtime)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Schließen") { showKds = false }
                            }
                        }
                }
            }
        }
    }

    private var navigationTitle: String {
        if let name = runtime.snapshot?.restaurantName, !name.isEmpty, name != "Demo Restaurant" {
            return name
        }
        return "Gwada POS"
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

    private func filteredTables(_ tables: [PosLanFloorTable]) -> [PosLanFloorTable] {
        let q = tableSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return tables }
        return tables.filter {
            $0.label.localizedCaseInsensitiveContains(q)
                || "\($0.table_number)".contains(q)
        }
    }
}
