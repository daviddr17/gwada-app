import SwiftUI

/// Tab „Mehr“ — Caps-gefilterte Aktionen (Phase 4 Prototyp).
struct MoreMenuView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var lock = PosPinLockStore.shared
    @StateObject private var pinCache = PosWaiterPinCache.shared

    @State private var showHandover = false

    private var caps: Set<String> {
        let profileId = PosCloudConfig.waiterProfileId
            ?? PosAuthStore.shared.session?.userId
            ?? ""
        let list = pinCache.caps(for: profileId)
        if list.isEmpty {
            // Default-Prototyp-Caps bis Cloud-Rollen sync’en
            return ["transfer", "receipts", "device"]
        }
        return Set(list)
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Standort", value: runtime.snapshot?.restaurantName ?? "—")
                LabeledContent("Rolle", value: runtime.role.title)
                LabeledContent(
                    "Sync",
                    value: PosCloudConfig.nestSyncEnabled ? "Nest" : "Next/LAN"
                )
                if PosCloudConfig.nestClientFallbackEnabled {
                    LabeledContent("Hub-Fallback", value: "Nest aktiv")
                }
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
                NavigationLink {
                    AuditLogView()
                } label: {
                    Label("Audit-Log", systemImage: "list.bullet.rectangle")
                }
            }

            Section("Belege & Küche") {
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
                if runtime.role == .hub {
                    NavigationLink {
                        KdsView()
                    } label: {
                        Label("KDS", systemImage: "flame")
                    }
                }
            }

            Section("Stubs") {
                Label("Z-Bericht", systemImage: "chart.bar")
                    .foregroundStyle(.secondary)
                Label("Storno", systemImage: "arrow.uturn.backward")
                    .foregroundStyle(.secondary)
                Text("Vollständige Z-/Storno-UI folgt nach Pilot-Briefing.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section {
                NavigationLink {
                    DeviceSettingsView()
                } label: {
                    Label("Gerät & Sync", systemImage: "gearshape")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Mehr")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showHandover) {
            HandoverSheet()
                .environmentObject(runtime)
        }
    }
}
