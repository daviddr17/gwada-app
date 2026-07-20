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
    }

    enum KellnerTab: Hashable {
        case tables
        case reservations
        case more
    }

    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var pinLock = PosPinLockStore.shared
    @State private var selection: SidebarItem? = .tables
    @State private var kellnerTab: KellnerTab = .tables
    @State private var columnVisibility = NavigationSplitViewVisibility.all

    var body: some View {
        Group {
            if !pinLock.isUnlocked {
                PosPinLockView()
            } else if runtime.role == .hub {
                hubSplitView
            } else {
                kellnerTabView
            }
        }
    }

    // MARK: - iPad Hub

    private var hubSplitView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: $selection) {
                Section {
                    ForEach(SidebarItem.allCases) { item in
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
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        pinLock.lock()
                    } label: {
                        Image(systemName: "lock.fill")
                    }
                    .disabled(!pinLock.hasPinConfigured)
                    .accessibilityLabel("Sperren")
                }
            }
        } detail: {
            NavigationStack {
                hubDetailContent
            }
        }
        .navigationSplitViewStyle(.balanced)
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
            .tag(KellnerTab.more)
        }
    }

    private var sidebarHeader: String {
        if let name = runtime.snapshot?.restaurantName, !name.isEmpty, name != "Demo Restaurant" {
            return name
        }
        return runtime.role == .hub ? "Kasse" : "Handgerät"
    }
}
