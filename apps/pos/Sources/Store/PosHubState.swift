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

    /// Nach Offline-Open: lokale Session-ID durch Cloud-ID ersetzen (Floor + Metas).
    func remapSessionId(from localSessionId: String, to cloudSessionId: String) {
        let local = localSessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        let cloud = cloudSessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !local.isEmpty, !cloud.isEmpty, local != cloud else { return }

        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return }

        if let idx = bootstrap.floor.openSessions.firstIndex(where: { $0.id == local }) {
            let old = bootstrap.floor.openSessions[idx]
            bootstrap.floor.openSessions[idx] = PosLanOpenSession(
                id: cloud,
                dining_table_id: old.dining_table_id,
                cover_count: old.cover_count,
                opened_at: old.opened_at
            )
        }

        if let count = bootstrap.floor.orderCountBySessionId.removeValue(forKey: local) {
            bootstrap.floor.orderCountBySessionId[cloud] =
                (bootstrap.floor.orderCountBySessionId[cloud] ?? 0) + count
        }
        if let meta = bootstrap.floor.sessionMetaBySessionId.removeValue(forKey: local) {
            var merged = bootstrap.floor.sessionMetaBySessionId[cloud]
                ?? PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
            merged.orderCount += meta.orderCount
            merged.openCents += meta.openCents
            bootstrap.floor.sessionMetaBySessionId[cloud] = merged
        }

        self.bootstrap = bootstrap
        PosLocalStore.saveBootstrap(bootstrap)
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
    private var localPrintJobs: [[String: Any]] = []

    var kitchen: PosCloudKitchenConfig? {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.kitchen
    }

    /// Routet Positionen nach Kategorie → KDS / Drucker / beide / keines.
    /// Bondruck bei Status-Konfiguration: nur wenn erster Status `printOnEnter` hat
    /// (sonst sofort über Kategorie-Routing wie bisher).
    func routeKitchenOutput(orderNumber: Int, cartLines: [PosCartLine]) {
        lock.lock()
        defer { lock.unlock() }
        let menuItems = bootstrap?.menu.items ?? []
        let itemById = Dictionary(uniqueKeysWithValues: menuItems.map { ($0.id, $0) })
        let routes = bootstrap?.kitchen?.categoryRoutes ?? []
        let routeByCat = Dictionary(uniqueKeysWithValues: routes.map { ($0.menuCategoryId, $0) })
        let printers = (bootstrap?.kitchen?.printers ?? []).filter(\.isActive)
        let kdsDevices = (bootstrap?.kitchen?.kdsDevices ?? []).filter(\.isActive)
        let statuses = bootstrap?.kitchen?.activeKdsStatuses ?? []
        let firstStatus = statuses.first
        let statusPrintConfigured = statuses.contains(where: \.printOnEnter)

        var kdsLines: [[String: Any]] = []
        var printLinesByPrinter: [String: [[String: Any]]] = [:]

        for line in cartLines {
            let categoryId = itemById[line.menuItemId]?.categoryId
            let destination = routeByCat[categoryId ?? ""]?.destination ?? "kds"
            let route = routeByCat[categoryId ?? ""]
            let payload: [String: Any] = [
                "id": line.id,
                "name": line.name,
                "quantity": line.quantity,
                "detail": line.subtitle,
                "course": line.course.rawValue,
                "categoryId": categoryId ?? "",
            ]

            let toKds = destination == "kds" || destination == "both"
            let toPrinter = destination == "printer" || destination == "both"

            if toKds {
                if let ids = route?.kdsDeviceIds, !ids.isEmpty {
                    let allowed = Set(ids)
                    let matching = kdsDevices.filter { allowed.contains($0.id) }
                    if matching.isEmpty {
                        kdsLines.append(payload)
                    } else {
                        kdsLines.append(payload)
                    }
                } else {
                    kdsLines.append(payload)
                }
            }

            // Sofort-Druck nur ohne Status-printOnEnter-Konfiguration
            // (sonst übernimmt der Status-Tap / erster Status).
            let printNow =
                toPrinter
                && (!statusPrintConfigured || (firstStatus?.printOnEnter == true))
            if printNow {
                let targetIds: [String]
                if let statusPrinters = firstStatus?.printerIds, !statusPrinters.isEmpty,
                   firstStatus?.printOnEnter == true
                {
                    targetIds = statusPrinters
                } else if let ids = route?.printerIds, !ids.isEmpty {
                    targetIds = ids
                } else {
                    targetIds = printers.map(\.id)
                }
                for pid in targetIds {
                    printLinesByPrinter[pid, default: []].append(payload)
                }
            }
        }

        if !kdsLines.isEmpty {
            let ticket: [String: Any] = [
                "orderId": UUID().uuidString,
                "orderNumber": orderNumber,
                "status": firstStatus?.name ?? "Neu",
                "statusId": firstStatus?.id ?? "",
                "statusName": firstStatus?.name ?? "Neu",
                "statusColor": firstStatus?.color ?? "#3b82f6",
                "lines": kdsLines,
            ]
            localTickets.insert(ticket, at: 0)
            if localTickets.count > 40 {
                localTickets = Array(localTickets.prefix(40))
            }
        }

        enqueuePrintJobsLocked(
            orderNumber: orderNumber,
            printLinesByPrinter: printLinesByPrinter,
            printers: printers
        )
    }

    /// Tippen auf KDS-Ticket: nächster Status; nach dem letzten Ticket entfernen.
    /// Optional Bondruck beim Erreichen des neuen Status.
    @discardableResult
    func advanceLocalTicket(orderId: String) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        guard let idx = localTickets.firstIndex(where: { ($0["orderId"] as? String) == orderId })
        else {
            return ["ok": false, "error": "not_found"]
        }
        let statuses = bootstrap?.kitchen?.activeKdsStatuses ?? []
        let printers = (bootstrap?.kitchen?.printers ?? []).filter(\.isActive)
        var ticket = localTickets[idx]
        let currentId = ticket["statusId"] as? String ?? ""
        let currentIndex = statuses.firstIndex(where: { $0.id == currentId }) ?? -1
        let nextIndex = currentIndex + 1

        if nextIndex >= statuses.count || statuses.isEmpty {
            localTickets.remove(at: idx)
            return [
                "ok": true,
                "done": true,
                "orderId": orderId,
                "printRequested": false,
            ]
        }

        let next = statuses[nextIndex]
        ticket["statusId"] = next.id
        ticket["status"] = next.name
        ticket["statusName"] = next.name
        ticket["statusColor"] = next.color
        localTickets[idx] = ticket

        var printRequested = false
        if next.printOnEnter, let lines = ticket["lines"] as? [[String: Any]], !lines.isEmpty {
            printRequested = true
            let orderNumber = ticket["orderNumber"] as? Int ?? 0
            let targetIds: [String]
            if !next.printerIds.isEmpty {
                targetIds = next.printerIds
            } else {
                targetIds = printers.map(\.id)
            }
            var byPrinter: [String: [[String: Any]]] = [:]
            for pid in targetIds {
                byPrinter[pid] = lines
            }
            enqueuePrintJobsLocked(
                orderNumber: orderNumber,
                printLinesByPrinter: byPrinter,
                printers: printers
            )
        }

        return [
            "ok": true,
            "done": false,
            "ticket": ticket,
            "printRequested": printRequested,
        ]
    }

    /// Cloud-Advance hat Druck angefordert → Jobs lokal einreihen.
    func enqueueKitchenPrintFromCloud(
        orderNumber: Int,
        printerIds: [String],
        lines: [[String: Any]]
    ) {
        lock.lock()
        defer { lock.unlock() }
        let printers = (bootstrap?.kitchen?.printers ?? []).filter(\.isActive)
        let targets: [String]
        if !printerIds.isEmpty {
            targets = printerIds
        } else {
            targets = printers.map(\.id)
        }
        var byPrinter: [String: [[String: Any]]] = [:]
        for pid in targets {
            byPrinter[pid] = lines
        }
        enqueuePrintJobsLocked(
            orderNumber: orderNumber,
            printLinesByPrinter: byPrinter,
            printers: printers
        )
    }

    private func enqueuePrintJobsLocked(
        orderNumber: Int,
        printLinesByPrinter: [String: [[String: Any]]],
        printers: [PosCloudPrinter]
    ) {
        for (printerId, lines) in printLinesByPrinter {
            guard !lines.isEmpty else { continue }
            let printer = printers.first(where: { $0.id == printerId })
            let printerName = printer?.name ?? printerId
            localPrintJobs.insert([
                "id": UUID().uuidString,
                "printerId": printerId,
                "printerName": printerName,
                "orderNumber": orderNumber,
                "status": "pending",
                "connectionType": printer?.connectionType ?? "virtual",
                "host": printer?.resolvedHost ?? "",
                "port": Int(printer?.resolvedPort ?? 9100),
                "lines": lines,
                "createdAt": ISO8601DateFormatter().string(from: Date()),
            ], at: 0)
        }
        if localPrintJobs.count > 80 {
            localPrintJobs = Array(localPrintJobs.prefix(80))
        }
    }

    /// Pending Jobs atomar entnehmen (status → printing), für parallelen Versand.
    func dequeuePendingPrintJobs(limit: Int = 12) -> [PosPrintJobSnapshot] {
        lock.lock()
        defer { lock.unlock() }
        var out: [PosPrintJobSnapshot] = []
        for i in 0 ..< localPrintJobs.count {
            guard out.count < limit else { break }
            guard (localPrintJobs[i]["status"] as? String) == "pending" else { continue }
            let job = localPrintJobs[i]
            let id = job["id"] as? String ?? UUID().uuidString
            let rawLines = job["lines"] as? [[String: Any]] ?? []
            let lines: [PosPrintJobLine] = rawLines.map { line in
                PosPrintJobLine(
                    quantity: line["quantity"] as? Int ?? 1,
                    name: line["name"] as? String ?? "—",
                    detail: line["detail"] as? String ?? ""
                )
            }
            let portNum = job["port"] as? Int ?? 9100
            out.append(
                PosPrintJobSnapshot(
                    id: id,
                    printerId: job["printerId"] as? String ?? "",
                    printerName: job["printerName"] as? String ?? "",
                    orderNumber: job["orderNumber"] as? Int ?? 0,
                    connectionType: job["connectionType"] as? String ?? "virtual",
                    host: job["host"] as? String ?? "",
                    port: UInt16(clamping: max(1, portNum)),
                    lines: lines
                )
            )
            localPrintJobs[i]["status"] = "printing"
        }
        return out
    }

    func markPrintJob(id: String, status: String, error: String?) {
        lock.lock()
        defer { lock.unlock() }
        guard let idx = localPrintJobs.firstIndex(where: { ($0["id"] as? String) == id }) else { return }
        localPrintJobs[idx]["status"] = status
        if let error, !error.isEmpty {
            localPrintJobs[idx]["error"] = error
        } else {
            localPrintJobs[idx].removeValue(forKey: "error")
        }
        if status == "printed" {
            localPrintJobs[idx]["printedAt"] = ISO8601DateFormatter().string(from: Date())
        }
    }

    /// Legacy: alle Zeilen → KDS (ohne Routing).
    func appendLocalTicket(orderNumber: Int, lines: [[String: Any]]) {
        lock.lock()
        defer { lock.unlock() }
        let first = bootstrap?.kitchen?.activeKdsStatuses.first
        localTickets.insert([
            "orderId": UUID().uuidString,
            "orderNumber": orderNumber,
            "status": first?.name ?? "Neu",
            "statusId": first?.id ?? "",
            "statusName": first?.name ?? "Neu",
            "statusColor": first?.color ?? "#3b82f6",
            "lines": lines,
        ], at: 0)
        if localTickets.count > 40 {
            localTickets = Array(localTickets.prefix(40))
        }
    }

    func kdsTicketsJSON(deviceId: String? = nil) -> Data {
        lock.lock()
        defer { lock.unlock() }
        var tickets = localTickets
        if let deviceId, let kitchen = bootstrap?.kitchen {
            let device = kitchen.kdsDevices.first { $0.id == deviceId && $0.isActive }
            let catFilter = Set(device?.menuCategoryIds ?? [])
            let courseFilter = Set(device?.courses ?? [])
            let routes = kitchen.categoryRoutes
            tickets = tickets.compactMap { ticket in
                guard var lines = ticket["lines"] as? [[String: Any]] else { return ticket }
                lines = lines.filter { line in
                    let cat = line["categoryId"] as? String ?? ""
                    let course = line["course"] as? String ?? ""
                    if let route = routes.first(where: { $0.menuCategoryId == cat }) {
                        if !(route.destination == "kds" || route.destination == "both") {
                            return false
                        }
                        if !route.kdsDeviceIds.isEmpty && !route.kdsDeviceIds.contains(deviceId) {
                            return false
                        }
                    }
                    if !catFilter.isEmpty && !catFilter.contains(cat) { return false }
                    if !courseFilter.isEmpty && !courseFilter.contains(course) { return false }
                    return true
                }
                guard !lines.isEmpty else { return nil }
                var copy = ticket
                copy["lines"] = lines
                return copy
            }
        }
        let statusPayload: [[String: Any]] = (bootstrap?.kitchen?.activeKdsStatuses ?? []).map { s in
            [
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "sortOrder": s.sortOrder,
                "printOnEnter": s.printOnEnter,
                "printerIds": s.printerIds,
                "isActive": s.isActive,
            ]
        }
        let payload: [String: Any] = [
            "tickets": tickets,
            "statuses": statusPayload,
        ]
        return (try? JSONSerialization.data(withJSONObject: payload)) ?? Data(#"{"tickets":[],"statuses":[]}"#.utf8)
    }

    func printJobsJSON() -> Data {
        lock.lock()
        defer { lock.unlock() }
        let payload: [String: Any] = ["jobs": localPrintJobs]
        return (try? JSONSerialization.data(withJSONObject: payload)) ?? Data(#"{"jobs":[]}"#.utf8)
    }

    var pendingPrintJobCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return localPrintJobs.filter { ($0["status"] as? String) == "pending" }.count
    }
}
