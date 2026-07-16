import Foundation

/// Autoritative lokale Hub-Daten (Floor + Speisekarte), die Handgeräte per LAN abrufen.
final class PosHubState: @unchecked Sendable {
    static let shared = PosHubState()

    private let lock = NSLock()
    private var bootstrap: PosCloudBootstrap?
    private var hubDeviceId: String = UUID().uuidString
    private var usingDemo = true

    private init() {}

    func configure(hubDeviceId: String) {
        lock.lock()
        defer { lock.unlock() }
        self.hubDeviceId = hubDeviceId
    }

    func applyBootstrap(_ bootstrap: PosCloudBootstrap) {
        lock.lock()
        defer { lock.unlock() }
        self.bootstrap = bootstrap
        self.usingDemo = false
        PosLocalStore.saveBootstrap(bootstrap)
    }

    func loadCachedOrDemo() {
        lock.lock()
        defer { lock.unlock() }
        if let cached = PosLocalStore.loadBootstrap() {
            bootstrap = cached
            usingDemo = false
        } else {
            bootstrap = nil
            usingDemo = true
        }
    }

    var restaurantId: String {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.restaurantId ?? DemoSnapshotFactory.restaurantId
    }

    var restaurantName: String {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.restaurantName ?? DemoSnapshotFactory.restaurantName
    }

    var brandAccentHex: String {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.resolvedAccentHex ?? PosDesign.defaultAccentHex
    }

    var menu: PosCloudMenuCatalog? {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.menu
    }

    var isDemo: Bool {
        lock.lock()
        defer { lock.unlock() }
        return usingDemo || bootstrap == nil
    }

    func makeSnapshot() -> PosLanHubSnapshot {
        lock.lock()
        defer { lock.unlock() }
        if let bootstrap {
            return PosLanHubSnapshot(
                protocolVersion: PosLanProtocol.version,
                restaurantId: bootstrap.restaurantId,
                restaurantName: bootstrap.restaurantName,
                brandAccentHex: bootstrap.resolvedAccentHex,
                generatedAt: ISO8601DateFormatter().string(from: Date()),
                register: PosLanRegisterState(
                    isOpen: bootstrap.register.isOpen,
                    sessionId: bootstrap.register.sessionId,
                    openedAt: bootstrap.register.openedAt
                ),
                floor: bootstrap.floor,
                menu: bootstrap.menu,
                hub: PosLanHubInfo(
                    deviceId: hubDeviceId,
                    displayName: PosLanProtocol.bonjourName(restaurantName: bootstrap.restaurantName),
                    role: "hub"
                )
            )
        }
        return DemoSnapshotFactory.makeSnapshot(hubDeviceId: hubDeviceId)
    }

    func makeHealth() -> PosLanHealthResponse {
        lock.lock()
        defer { lock.unlock() }
        let rid = bootstrap?.restaurantId ?? DemoSnapshotFactory.restaurantId
        let name = bootstrap?.restaurantName ?? DemoSnapshotFactory.restaurantName
        return PosLanHealthResponse(
            ok: true,
            protocolVersion: PosLanProtocol.version,
            restaurantId: rid,
            restaurantName: name,
            role: "hub",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    /// Lokale Tisch-Session öffnen — `preferredSessionId` = Cloud-ID wenn online.
    func openLocalSession(
        diningTableId: String,
        coverCount: Int,
        preferredSessionId: String? = nil
    ) -> String {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return preferredSessionId ?? UUID().uuidString }
        if let existing = bootstrap.floor.openSessions.first(where: { $0.dining_table_id == diningTableId }) {
            return existing.id
        }
        let sessionId = preferredSessionId ?? UUID().uuidString
        let session = PosLanOpenSession(
            id: sessionId,
            dining_table_id: diningTableId,
            cover_count: max(1, coverCount),
            opened_at: ISO8601DateFormatter().string(from: Date())
        )
        bootstrap.floor.openSessions.append(session)
        bootstrap.floor.orderCountBySessionId[sessionId] = 0
        bootstrap.floor.sessionMetaBySessionId[sessionId] = PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
        self.bootstrap = bootstrap
        PosLocalStore.saveBootstrap(bootstrap)
        return sessionId
    }

    func bumpLocalOrder(sessionId: String, addCents: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return }
        let count = (bootstrap.floor.orderCountBySessionId[sessionId] ?? 0) + 1
        bootstrap.floor.orderCountBySessionId[sessionId] = count
        var meta = bootstrap.floor.sessionMetaBySessionId[sessionId] ?? PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
        meta.orderCount = count
        meta.openCents += addCents
        bootstrap.floor.sessionMetaBySessionId[sessionId] = meta
        self.bootstrap = bootstrap
        PosLocalStore.saveBootstrap(bootstrap)
    }

    private var localTickets: [[String: Any]] = []

    func appendLocalTicket(orderNumber: Int, lines: [[String: Any]]) {
        lock.lock()
        defer { lock.unlock() }
        localTickets.insert([
            "orderId": UUID().uuidString,
            "orderNumber": orderNumber,
            "status": "received",
            "lines": lines,
        ], at: 0)
        if localTickets.count > 40 {
            localTickets = Array(localTickets.prefix(40))
        }
    }

    func kdsTicketsJSON() -> Data {
        lock.lock()
        defer { lock.unlock() }
        let payload: [String: Any] = ["tickets": localTickets]
        return (try? JSONSerialization.data(withJSONObject: payload)) ?? Data(#"{"tickets":[]}"#.utf8)
    }
}
