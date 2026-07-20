import SwiftUI

/// Gerät / Pairing / PIN / Hub-Status (Sidebar „Gerät“).
struct DeviceSettingsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var hubIP = ""
    @State private var confirmSignOut = false
    @State private var confirmUnpair = false

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
                if runtime.isPaired {
                    LabeledContent(
                        "Restaurant",
                        value: runtime.restaurantDisplayName.isEmpty
                            ? (runtime.restaurantIdInput.isEmpty ? "—" : runtime.restaurantIdInput)
                            : runtime.restaurantDisplayName
                    )
                }
                if runtime.isSignedIn, !runtime.staffDisplayName.isEmpty {
                    LabeledContent("Mitarbeiter", value: runtime.staffDisplayName)
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

            if !runtime.isPaired {
                Section("Restaurant koppeln") {
                    Text("Kopplungscode aus Dashboard → POS → Einstellungen → Geräte.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    TextField("Kopplungscode", text: $runtime.pairingCodeInput)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                    DisclosureGroup("Erweitert") {
                        TextField("API-Basis", text: $runtime.apiBaseInput)
                            .textInputAutocapitalization(.never)
                    }
                    Button {
                        Task { await runtime.pairDevice() }
                    } label: {
                        Text("Gerät koppeln")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PosPrimaryButtonStyle())
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            } else if !runtime.isSignedIn {
                Section("Display-PIN") {
                    Text("Mit der 4-stelligen Mitarbeiter-PIN anmelden (Recht „Kasse bedienen“).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    SecureField("PIN", text: $runtime.pinInput)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                    Button {
                        Task { await runtime.signInWithPin() }
                    } label: {
                        Text("Anmelden")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PosPrimaryButtonStyle())
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                    .listRowBackground(Color.clear)
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

            if runtime.isPaired {
                Section {
                    if runtime.isSignedIn {
                        Button("Abmelden", role: .destructive) {
                            confirmSignOut = true
                        }
                    }
                    Button("Gerät entkoppeln", role: .destructive) {
                        confirmUnpair = true
                    }
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
            Text("Die PIN-Session endet. Das Gerät bleibt mit dem Restaurant gekoppelt.")
        }
        .confirmationDialog(
            "Gerät entkoppeln?",
            isPresented: $confirmUnpair,
            titleVisibility: .visible
        ) {
            Button("Entkoppeln", role: .destructive) {
                Task { await runtime.unpairDevice() }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Restaurant-Zuordnung wird entfernt. Neuer Kopplungscode aus dem Dashboard nötig.")
        }
    }

    private var phaseLabel: String {
        switch runtime.phase {
        case .idle: return "Bereit"
        case .needsLogin:
            return runtime.isPaired ? "PIN nötig" : "Kopplung nötig"
        case .starting: return "Startet …"
        case .hubReady: return "Server läuft"
        case .searching: return "Suche Kasse …"
        case .connected: return "Mit Kasse verbunden"
        case .error(let message): return message
        }
    }
}
