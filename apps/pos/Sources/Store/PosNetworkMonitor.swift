import Foundation
import Network

/// Online/Offline für Zahlungs-Gate (Phase 5: Zahlung nur online).
@MainActor
final class PosNetworkMonitor: ObservableObject {
    static let shared = PosNetworkMonitor()

    @Published private(set) var isOnline = true
    @Published private(set) var isExpensive = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "app.gwada.pos.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOnline = path.status == .satisfied
                self?.isExpensive = path.isExpensive
            }
        }
        monitor.start(queue: queue)
    }

    /// Bestellen/LAN darf offline; Zahlungen (TSE/Mollie) brauchen Netz.
    var canCollectPayment: Bool { isOnline }
}
