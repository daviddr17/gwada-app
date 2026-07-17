import SwiftUI

/// Native Apple-Sidebar (NavigationSplitView) für iPad-Kasse / iPhone-Collapse.
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

    @EnvironmentObject private var runtime: PosRuntime
    @State private var selection: SidebarItem? = .tables
    @State private var columnVisibility = NavigationSplitViewVisibility.all

    var body: some View {
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
        } detail: {
            NavigationStack {
                detailContent
            }
        }
        .navigationSplitViewStyle(.balanced)
    }

    @ViewBuilder
    private var detailContent: some View {
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

    private var sidebarHeader: String {
        if let name = runtime.snapshot?.restaurantName, !name.isEmpty, name != "Demo Restaurant" {
            return name
        }
        return runtime.role == .hub ? "Kasse" : "Handgerät"
    }
}
