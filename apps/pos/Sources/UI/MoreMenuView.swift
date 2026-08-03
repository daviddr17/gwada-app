import SwiftUI

/// Tab „Mehr“ — schlank für Service (Review B 2026-08-03).
struct MoreMenuView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var lock = PosPinLockStore.shared
    @StateObject private var pinCache = PosWaiterPinCache.shared
    @StateObject private var enrollment = PosEnrollmentStore.shared

    @State private var showLanPairing = false

    private var caps: Set<String> {
        let profileId = PosCloudConfig.waiterProfileId
            ?? PosAuthStore.shared.pinSession?.staffId
            ?? ""
        let list = pinCache.caps(for: profileId)
        if list.isEmpty {
            return ["receipts", "device"]
        }
        return Set(list)
    }

    private var modusLabel: String {
        if runtime.isHubDisconnectedWhilePaired { return "Kasse getrennt" }
        if runtime.hubBaseURL != nil, !runtime.isSoloMode { return "Mit iPad-Kasse" }
        #if DEBUG
        if runtime.isSoloMode { return "Solo (Labor)" }
        #endif
        return "—"
    }

    var body: some View {
        List {
            Section {
                LabeledContent(
                    "Standort",
                    value: runtime.snapshot?.restaurantName
                        ?? enrollment.restaurantDisplayName.nilIfEmpty
                        ?? "—"
                )
                LabeledContent("Modus", value: modusLabel)
            } header: {
                Text("Status")
            }

            Section {
                Button {
                    Task { await runtime.reloadCloudData() }
                } label: {
                    Label("Speisekarte aktualisieren", systemImage: "arrow.clockwise")
                }
                if caps.contains("receipts") {
                    NavigationLink {
                        ReceiptsView()
                    } label: {
                        Label("Tagesbelege", systemImage: "doc.text")
                    }
                }
            } header: {
                Text("Aufgaben")
            } footer: {
                Text("Speisekarte kommt von der Kasse. Bei Verbindungsproblemen Banner oben antippen.")
            }

            Section("Schicht") {
                Button {
                    lock.lock(reason: "more_menu")
                } label: {
                    Label("Gerät sperren", systemImage: "lock.fill")
                }
                .disabled(!lock.hasPinConfigured)
            }

            Section {
                if !enrollment.isHandheldPaired {
                    Button {
                        showLanPairing = true
                    } label: {
                        Label("iPad-Kasse koppeln", systemImage: "ipad.and.iphone")
                    }
                }
                #if DEBUG
                if PosSecurityPolicy.allowsSoloMode, runtime.isSoloMode, enrollment.isHandheldPaired {
                    Button {
                        showLanPairing = true
                    } label: {
                        Label("Erneut mit iPad verbinden (DEBUG)", systemImage: "ipad.and.iphone")
                    }
                }
                #endif
                if caps.contains("device") {
                    NavigationLink {
                        DeviceSettingsView()
                    } label: {
                        Label("Gerät", systemImage: "gearshape")
                    }
                }
            } header: {
                Text("Gerät")
            } footer: {
                Text("Hub-Kopplung bleibt bis zum Widerruf am iPad.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Mehr")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showLanPairing) {
            HandheldPairingGateView()
                .environmentObject(runtime)
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
