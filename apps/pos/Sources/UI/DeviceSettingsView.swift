import SwiftUI

/// Gerät / Login / Hub-Status (Sidebar „Gerät“ / Mehr → Gerät).
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
                if runtime.isSoloMode {
                    LabeledContent("Modus", value: "Solo (ohne Kasse)")
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
                hubSections
            } else {
                handheldSections
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
            Text(
                runtime.role == .hub
                    ? "Die lokale Kasse stoppt; Handgeräte verlieren die Verbindung."
                    : "Cloud-Login wird entfernt; Solo nutzt dann Demo-Daten."
            )
        }
    }

    @ViewBuilder
    private var hubSections: some View {
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
            cloudLoginSection(buttonTitle: "Anmelden & Daten laden")
        } else {
            nestSyncSection
            Section {
                Button("Abmelden", role: .destructive) {
                    confirmSignOut = true
                }
            }
        }
    }

    @ViewBuilder
    private var handheldSections: some View {
        Section("Solo / ohne iPad") {
            Text("Für UI-Tests ohne Kasse: Solo startet mit Demo- oder Cloud-Daten.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button {
                Task { await runtime.startHandheldSolo(preferCloud: runtime.isSignedIn) }
            } label: {
                Text(runtime.isSoloMode ? "Solo-Daten neu laden" : "Ohne Kasse starten (Solo)")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            .listRowBackground(Color.clear)

            Toggle(
                "Nest-Fallback (ohne Hub)",
                isOn: Binding(
                    get: { PosCloudConfig.nestClientFallbackEnabled },
                    set: { PosCloudConfig.setNestClientFallbackEnabled($0) }
                )
            )
        }

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
            Button("Erneut nach Kasse suchen") {
                Task { await runtime.refresh() }
            }
            Text("Ohne erreichbare Kasse wechselt die App automatisch in den Solo-Modus.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }

        if !runtime.isSignedIn {
            cloudLoginSection(buttonTitle: "Anmelden (Solo / Cloud)")
        } else {
            nestSyncSection
            Section {
                Button("Abmelden", role: .destructive) {
                    confirmSignOut = true
                }
            }
        }
    }

    private func cloudLoginSection(buttonTitle: String) -> some View {
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
                Text("Lokal: Nest `http://127.0.0.1:3099`, Supabase `http://127.0.0.1:54321`.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Button {
                Task { await runtime.signInAndStartHub() }
            } label: {
                Text(buttonTitle)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            .listRowBackground(Color.clear)
        }
    }

    @ViewBuilder
    private var nestSyncSection: some View {
        Section("Nest Sync") {
            LabeledContent(
                "Outbox",
                value: PosCloudConfig.nestSyncEnabled ? "Nest aktiv" : "Next `/api/pos`"
            )
            LabeledContent("Gerät-ID", value: String(PosDeviceIdentity.id.prefix(8)) + "…")
            LabeledContent("Daten", value: runtime.dataSourceLabel)
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
        case .connected:
            return runtime.isSoloMode ? "Solo aktiv" : "Mit Kasse verbunden"
        case .error(let message): return message
        }
    }
}
