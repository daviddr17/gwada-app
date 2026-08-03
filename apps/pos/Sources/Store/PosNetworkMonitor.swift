import Foundation
import Network

/// Online/Offline für Zahlungs-Gate + Sync-Flush bei Reconnect.
@MainActor
final class PosNetworkMonitor: ObservableObject {
    static let shared = PosNetworkMonitor()

    @Published private(set) var isOnline = true
    @Published private(set) var isExpensive = false

    /// Wird aufgerufen wenn Pfad von offline → online wechselt (Hub Sync-Flush).
    var onBecameOnline: (() -> Void)?

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "app.gwada.pos.network")
    private var wasOnline = true

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let online = path.status == .satisfied
                let becameOnline = online && !self.wasOnline
                self.wasOnline = online
                self.isOnline = online
                self.isExpensive = path.isExpensive
                if becameOnline {
                    self.onBecameOnline?()
                }
            }
        }
        monitor.start(queue: queue)
    }

    /// Bestellen/LAN darf offline; Zahlungen (TSE/Mollie) brauchen Netz.
    var canCollectPayment: Bool { isOnline }
}
