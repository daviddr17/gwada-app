import SwiftUI

/// Tab „Mehr“ — klare Aufgaben für den Service.
struct MoreMenuView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var lock = PosPinLockStore.shared
    @StateObject private var pinCache = PosWaiterPinCache.shared
    @StateObject private var enrollment = PosEnrollmentStore.shared

    @State private var showHandover = false
    @State private var showLanPairing = false

    private var caps: Set<String> {
        let profileId = PosCloudConfig.waiterProfileId
            ?? PosAuthStore.shared.pinSession?.staffId
            ?? ""
        let list = pinCache.caps(for: profileId)
        if list.isEmpty {
            return ["transfer", "receipts", "device"]
        }
        return Set(list)
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Standort", value: runtime.snapshot?.restaurantName ?? enrollment.restaurantDisplayName.nilIfEmpty ?? "—")
                LabeledContent(
                    "Modus",
                    value: runtime.isSoloMode
                        ? "Cloud / offline"
                        : (runtime.hubBaseURL != nil ? "Mit iPad-Kasse" : "—")
                )
                LabeledContent("Daten", value: runtime.dataSourceLabel)
                if let rev = PosHubState.shared.menuRevision, !rev.isEmpty {
                    LabeledContent("Karten-Stand", value: String(rev.prefix(19)))
                }
            } header: {
                Text("Status")
            }

            Section {
                Button {
                    Task { await runtime.reloadCloudData() }
                } label: {
                    Label("Speisekarte aktualisieren", systemImage: "arrow.clockwise")
                }
                if caps.contains("receipts") || caps.contains("transfer") {
                    NavigationLink {
                        ReceiptsView()
                    } label: {
                        Label("Tagesbelege", systemImage: "doc.text")
                    }
                }
                NavigationLink {
                    GiftVouchersView()
                } label: {
                    Label("Gutscheine", systemImage: "gift")
                }
            } header: {
                Text("Aufgaben")
            } footer: {
                Text("Die Speisekarte kommt von der Cloud und bleibt offline gespeichert. Aktualisieren nur bei Änderungen nötig.")
            }

            Section("Schicht") {
                if caps.contains("transfer") || caps.contains("handover") {
                    Button {
                        showHandover = true
                    } label: {
                        Label("Übergabe", systemImage: "person.2.badge.gearshape")
                    }
                }
                Button {
                    lock.lock(reason: "more_menu")
                } label: {
                    Label("Gerät sperren", systemImage: "lock.fill")
                }
                .disabled(!lock.hasPinConfigured)
            }

            Section {
                if !enrollment.isHandheldPaired || runtime.isSoloMode {
                    Button {
                        showLanPairing = true
                    } label: {
                        Label(
                            enrollment.isHandheldPaired ? "Erneut mit iPad verbinden" : "iPad-Kasse koppeln",
                            systemImage: "ipad.and.iphone"
                        )
                    }
                }
                NavigationLink {
                    DeviceSettingsView()
                } label: {
                    Label("Gerät & Sync", systemImage: "gearshape")
                }
                NavigationLink {
                    AuditLogView()
                } label: {
                    Label("Audit-Log", systemImage: "list.bullet.rectangle")
                }
            } header: {
                Text("Gerät")
            } footer: {
                Text("iPad-Kopplung ist optional — für Live-Tische im WLAN. Freigabe bleibt bis zum Widerruf am iPad.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Mehr")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showHandover) {
            HandoverSheet()
                .environmentObject(runtime)
        }
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
