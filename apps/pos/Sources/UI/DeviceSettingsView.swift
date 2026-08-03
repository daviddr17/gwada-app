import SwiftUI

/// Gerät / Verbindung — Waiter-schlank; Nest/Admin nur DEBUG (Review B).
struct DeviceSettingsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var hubIP = ""
    @State private var confirmSignOut = false
    @State private var showSupport = false

    var body: some View {
        List {
            Section("Gerät") {
                LabeledContent("Rolle", value: runtime.role.title)
                HStack {
                    Text("Status")
                    Spacer()
                    PosStatusBadge(
                        title: phaseLabel,
                        emphasized: runtime.phase == .hubReady || runtime.phase == .connected
                    )
                }
                #if DEBUG
                if runtime.isSoloMode {
                    LabeledContent("Modus", value: "Solo (Labor)")
                }
                #endif
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
            "Gerät zurücksetzen?",
            isPresented: $confirmSignOut,
            titleVisibility: .visible
        ) {
            Button("Neu einrichten", role: .destructive) { runtime.signOut() }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text(
                runtime.role == .hub
                    ? "Die lokale Kasse stoppt; Handgeräte verlieren die Verbindung. Danach Einrichtungs-Code oder Login."
                    : "Cloud-Zugang und iPad-Pairing werden entfernt. Danach erneut Einrichtungs-Code."
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
            LabeledContent("Sync-Queue", value: "\(runtime.syncPending) offen")
            Text("Handgeräte über lokales WLAN — auch ohne Internet.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }

        #if DEBUG
        nestSyncSection
        #endif

        Section {
            Button("Kasse neu einrichten", role: .destructive) {
                confirmSignOut = true
            }
        } footer: {
            Text("Öffnet den Einrichtungs-Assistenten erneut (Einrichtungs-Code).")
        }
    }

    @ViewBuilder
    private var handheldSections: some View {
        #if DEBUG
        if PosSecurityPolicy.allowsSoloMode {
            Section("DEBUG · Solo ohne iPad") {
                Text("Nur Labor — produktiv ist die Hub-Kopplung Pflicht.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await runtime.startHandheldSolo(preferCloud: true) }
                } label: {
                    Text(runtime.isSoloMode ? "Cloud-Daten neu laden" : "Ohne iPad (Cloud) starten")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                .listRowBackground(Color.clear)
            }
        }
        #endif

        Section("Verbindung zur Kasse") {
            if PosEnrollmentStore.shared.isHandheldPaired {
                LabeledContent("Pairing", value: "Gespeichert (bis Widerruf)")
            }
            if runtime.isHubDisconnectedWhilePaired {
                Text("Kasse getrennt — Cache aktiv. Banner oben antippen zum Suchen.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
            Button("Erneut nach Kasse suchen") {
                Task { await runtime.reconnectToHub() }
            }
            .disabled(runtime.hubConnectionBannerSearching)

            DisclosureGroup("Support · Hub-IP", isExpanded: $showSupport) {
                if let url = runtime.hubBaseURL {
                    LabeledContent("Hub", value: url.host ?? url.absoluteString)
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

        #if DEBUG
        nestSyncSection
        #endif

        Section {
            Button("Abmelden", role: .destructive) {
                confirmSignOut = true
            }
        } footer: {
            Text("Setzt Einrichtung und Pairing zurück. Nur wenn das Gerät neu eingerichtet werden soll.")
        }
    }

    #if DEBUG
    @ViewBuilder
    private var nestSyncSection: some View {
        Section("DEBUG · Nest Sync") {
            LabeledContent(
                "Outbox",
                value: PosCloudConfig.nestSyncEnabled ? "Nest aktiv" : "Next `/api/pos`"
            )
            LabeledContent("Gerät-ID", value: String(PosDeviceIdentity.id.prefix(8)) + "…")
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
    #endif

    private var phaseLabel: String {
        switch runtime.phase {
        case .idle: return "Bereit"
        case .needsLogin: return "Login nötig"
        case .starting: return "Startet …"
        case .hubReady: return "Server läuft"
        case .searching: return "Suche Kasse …"
        case .awaitingApproval: return "Warte auf Freigabe …"
        case .connected:
            if runtime.isHubDisconnectedWhilePaired {
                return "Kasse getrennt"
            }
            return runtime.isSoloMode ? "Solo aktiv" : "Mit Kasse verbunden"
        case .error(let message): return message
        }
    }
}
