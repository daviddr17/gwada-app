import SwiftUI

/// Root: iPad-Hub = Sidebar; iPhone-Kellner = Tabs Tische · Reservierungen · Mehr + PIN-Lock.
struct RootView: View {
    enum SidebarItem: String, Hashable, CaseIterable, Identifiable {
        case tables
        case reservations
        case receipts
        case giftVouchers
        case kds
        case device

        var id: String { rawValue }

        var title: String {
            switch self {
            case .tables: return "Tische"
            case .reservations: return "Reservierungen"
            case .receipts: return "Quittungen"
            case .giftVouchers: return "Gutscheine"
            case .kds: return "KDS"
            case .device: return "Gerät"
            }
        }

        var systemImage: String {
            switch self {
            case .tables: return "fork.knife"
            case .reservations: return "calendar"
            case .receipts: return "doc.text"
            case .giftVouchers: return "gift"
            case .kds: return "flame"
            case .device: return "gearshape"
            }
        }

        /// Gutscheine an der Kasse vorerst aus — Feature bleibt im Code, nur ohne Menü-Einstieg.
        static var menuItems: [SidebarItem] {
            allCases.filter { $0 != .giftVouchers }
        }
    }

    enum KellnerTab: Hashable {
        case tables
        case reservations
        case more
    }

    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var pinLock = PosPinLockStore.shared
    @StateObject private var enrollment = PosEnrollmentStore.shared
    @ObservedObject private var network = PosNetworkMonitor.shared
    @State private var selection: SidebarItem? = .tables
    @State private var kellnerTab: KellnerTab = .tables
    @State private var columnVisibility = NavigationSplitViewVisibility.all
    @State private var lastInteraction = Date()
    @State private var showingPairingApprovals = false
    @State private var bannerTick = Date()

    var body: some View {
        Group {
            if !pinLock.isUnlocked {
                PosPinLockView()
            } else if runtime.role == .hub {
                if !enrollment.isHubEnrolled {
                    HubOnboardingWizardView()
                } else {
                    hubSplitView
                }
            } else if showHandheldOnboarding {
                HandheldOnboardingWizardView()
            } else {
                kellnerTabView
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                pinLock.lock(reason: "scene_background")
            }
            if phase == .active {
                lastInteraction = Date()
            }
        }
        .onReceive(Timer.publish(every: 15, on: .main, in: .common).autoconnect()) { now in
            bannerTick = now
            guard pinLock.isUnlocked, pinLock.hasPinConfigured else { return }
            let idle = now.timeIntervalSince(lastInteraction)
            if idle >= pinLock.autoLockSeconds {
                pinLock.lock(reason: "auto_idle")
            }
        }
        .onChange(of: runtime.statusMessage) { _, _ in
            lastInteraction = Date()
        }
        .onChange(of: kellnerTab) { _, _ in
            lastInteraction = Date()
        }
        .overlay(alignment: .top) {
            hubStatusCapsules
                .padding(.top, 4)
        }
        .sheet(item: $runtime.outboxConflict) { conflict in
            OutboxConflictSheet(
                conflict: conflict,
                onDismiss: { runtime.dismissOutboxConflict() },
                onReload: {
                    runtime.dismissOutboxConflict()
                    Task { await runtime.reconnectToHub() }
                }
            )
        }
    }

    @ViewBuilder
    private var hubStatusCapsules: some View {
        // bannerTick hält 45‑Min-Stale aktuell ohne Navigation.
        let _ = bannerTick
        VStack(spacing: 4) {
            if runtime.hubConnectionBannerSearching {
                Text("Suche Kasse …")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(PosDesign.brandAccent.opacity(0.95), in: Capsule())
                    .foregroundStyle(PosDesign.ink)
            } else if runtime.isHubDisconnectedWhilePaired {
                Button {
                    Task { await runtime.reconnectToHub() }
                } label: {
                    Text(hubDisconnectedBannerText)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            (runtime.isHubDisconnectedStale ? Color.orange : PosDesign.brandAccent)
                                .opacity(0.95),
                            in: Capsule()
                        )
                        .foregroundStyle(PosDesign.ink)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Erneut nach Kasse suchen")
            } else if runtime.outboxPending > 0 {
                Button {
                    Task { _ = await runtime.flushHandheldOutbox() }
                } label: {
                    Text("Nicht synchronisiert (\(runtime.outboxPending))")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(PosDesign.brandAccent.opacity(0.95), in: Capsule())
                        .foregroundStyle(PosDesign.ink)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ausstehende Bestellungen senden")
            }
            if !network.isOnline {
                Text("Offline — Bestellen OK · Zahlung gesperrt")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.red.opacity(0.9), in: Capsule())
                    .foregroundStyle(.white)
                    .allowsHitTesting(false)
            }
        }
    }

    private var hubDisconnectedBannerText: String {
        let n = runtime.outboxPending
        if runtime.isHubDisconnectedStale {
            if n > 0 {
                return "Kasse seit >45 Min getrennt · \(n) ausstehend — bitte verbinden"
            }
            return "Kasse seit >45 Min getrennt — bitte verbinden"
        }
        if n > 0 {
            return "Kasse getrennt · Nicht synchronisiert (\(n)) · Kassieren gesperrt"
        }
        return "Kasse getrennt — Bestellen aus Cache · Kassieren gesperrt"
    }

    /// Tabs nur mit Hub-Pairing; DEBUG-Solo als Labor-Ausnahme.
    private var showHandheldOnboarding: Bool {
        if PosSecurityPolicy.allowsSoloMode, runtime.isSoloMode { return false }
        if enrollment.isHandheldServiceReady { return false }
        if runtime.hubBaseURL != nil { return false }
        return true
    }

    // MARK: - iPad Hub

    private var hubSplitView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: $selection) {
                Section {
                    ForEach(SidebarItem.menuItems) { item in
                        if item == .receipts && !runtime.isSignedIn && runtime.role == .hub {
                            Label(item.title, systemImage: item.systemImage)
                                .foregroundStyle(.secondary)
                                .tag(item)
                        } else {
                            Label(item.title, systemImage: item.systemImage)
                                .tag(item)
                        }
                    }
                } header: {
                    Text(sidebarHeader)
                }

                if !runtime.statusMessage.isEmpty {
                    Section {
                        Text(runtime.statusMessage)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("Gwada POS")
            .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 320)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingPairingApprovals = true
                    } label: {
                        Image(systemName: "ipad.and.iphone")
                    }
                    .accessibilityLabel("Handgeräte verbinden")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        pinLock.lock(reason: "toolbar")
                    } label: {
                        Image(systemName: "lock.fill")
                    }
                    .disabled(!pinLock.hasPinConfigured)
                    .accessibilityLabel("Sperren")
                }
            }
        } detail: {
            // `.id(selection)` setzt den Detail-Stack zurück (sonst bleibt „Tisch 1“ nach Sidebar-Wechsel).
            NavigationStack {
                hubDetailContent
            }
            .id(selection)
        }
        .navigationSplitViewStyle(.balanced)
        .onChange(of: selection) { _, _ in
            lastInteraction = Date()
        }
        .sheet(isPresented: $showingPairingApprovals) {
            HubPairingApprovalsView()
        }
    }

    @ViewBuilder
    private var hubDetailContent: some View {
        switch selection ?? .tables {
        case .tables:
            TablesHomeView()
        case .reservations:
            ReservationsView()
        case .receipts:
            ReceiptsView()
        case .giftVouchers:
            GiftVouchersView()
        case .kds:
            KdsView()
        case .device:
            DeviceSettingsView()
        }
    }

    // MARK: - iPhone Kellner Tabs

    private var kellnerTabView: some View {
        TabView(selection: $kellnerTab) {
            NavigationStack {
                TablesHomeView()
            }
            .tabItem { Label("Tische", systemImage: "square.grid.2x2") }
            .tag(KellnerTab.tables)

            NavigationStack {
                ReservationsView()
            }
            .tabItem { Label("Reservierungen", systemImage: "calendar") }
            .tag(KellnerTab.reservations)

            NavigationStack {
                MoreMenuView()
            }
            .tabItem { Label("Mehr", systemImage: "ellipsis.circle") }
            .badge(runtime.outboxPending)
            .tag(KellnerTab.more)
        }
        .posKellnerTabLiquidGlass()
    }

    private var sidebarHeader: String {
        if let name = runtime.snapshot?.restaurantName, !name.isEmpty, name != "Demo Restaurant" {
            return name
        }
        return runtime.role == .hub ? "Kasse" : "Handgerät"
    }
}
