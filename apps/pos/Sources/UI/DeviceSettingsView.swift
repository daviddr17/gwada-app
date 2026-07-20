import SwiftUI

/// Gerät / Login / Hub-Status (Sidebar „Gerät“).
struct DeviceSettingsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var hubIP = ""
    @State private var confirmSignOut = false

    var body: some View {
        List {
            Section("Gerät") {
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
                    LabeledContent("Druck-Queue", value: "\(runtime.pendingPrintJobs) offen")
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
                    Text("Handgeräte, KDS & Druck-Jobs über lokales WLAN — auch ohne Internet.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
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
                            TextField("API-Basis (Next)", text: $runtime.apiBaseInput)
                                .textInputAutocapitalization(.never)
                            TextField("Nest API-Basis", text: $runtime.nestApiBaseInput)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                            TextField("Waiter Profile-ID", text: $runtime.waiterProfileIdInput)
                                .textInputAutocapitalization(.never)
                            TextField("Supabase-URL", text: $runtime.supabaseUrlInput)
                                .textInputAutocapitalization(.never)
                            SecureField("Supabase Anon Key", text: $runtime.supabaseAnonInput)
                            Text("Nest-URL gesetzt → Outbox sync’t über `POST /v1/sync/events` (sonst Next `/api/pos`).")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
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
                    Section("Nest Sync") {
                        LabeledContent(
                            "Outbox",
                            value: PosCloudConfig.nestSyncEnabled ? "Nest aktiv" : "Next `/api/pos`"
                        )
                        LabeledContent("Gerät-ID", value: String(PosDeviceIdentity.id.prefix(8)) + "…")
                        DisclosureGroup("Nest / Waiter") {
                            TextField("Nest API-Basis", text: $runtime.nestApiBaseInput)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                            TextField("Waiter Profile-ID", text: $runtime.waiterProfileIdInput)
                                .textInputAutocapitalization(.never)
                            Button("Speichern") {
                                runtime.saveNestSettingsFromInputs()
                            }
                            if PosCloudConfig.nestSyncEnabled {
                                Toggle(
                                    "Nest-Fallback (Hub offline)",
                                    isOn: Binding(
                                        get: { PosCloudConfig.nestClientFallbackEnabled },
                                        set: { PosCloudConfig.setNestClientFallbackEnabled($0) }
                                    )
                                )
                                Text("Handgerät darf bei Hub-Ausfall Open/Move an Nest senden.")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
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
        }
        .navigationTitle("Gerät")
        .navigationBarTitleDisplayMode(.large)
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
}
