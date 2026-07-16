import Foundation
import SwiftUI

@MainActor
final class PosRuntime: ObservableObject {
    enum Phase: Equatable {
        case idle
        case needsLogin
        case starting
        case hubReady
        case searching
        case connected
        case error(String)
    }

    @Published private(set) var role: PosDeviceRole
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var detectionLabel: String
    @Published private(set) var hubBaseURL: URL?
    @Published private(set) var snapshot: PosLanHubSnapshot?
    @Published private(set) var bonjourPublishing = false
    @Published private(set) var statusMessage: String = ""
    @Published private(set) var syncPending: Int = 0
    @Published private(set) var isSignedIn = false
    @Published private(set) var dataSourceLabel = "—"
    /// Aktiver Restaurant-Akzent (Gwada-Gold oder Tenant).
    @Published private(set) var brandAccentHex = PosDesign.defaultAccentHex
    @Published private(set) var pendingPrintJobs = 0

    var brandTint: Color {
        PosDesign.color(hex: brandAccentHex)
    }

    @Published var email = ""
    @Published var password = ""
    @Published var restaurantIdInput = ""
    @Published var apiBaseInput = ""
    @Published var supabaseUrlInput = ""
    @Published var supabaseAnonInput = ""

    private let hubDeviceId = UUID().uuidString
    private var httpServer: HubHTTPServer?
    private let advertiser = BonjourHubAdvertiser()
    private let browser = BonjourHubBrowser()
    private let manualHostKey = "gwada_pos_hub_host"
    private var flushTask: Task<Void, Never>?

    init() {
        let role = PosDeviceRoleDetector.detect()
        self.role = role
        self.detectionLabel = "Automatisch: \(PosDeviceRoleDetector.deviceKindLabel) → \(role.title)"
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        PosHubState.shared.loadCachedOrDemo()
        restaurantIdInput = PosCloudConfig.restaurantId ?? ""
        apiBaseInput = PosCloudConfig.apiBaseURL.absoluteString
        supabaseUrlInput = PosCloudConfig.supabaseURL.absoluteString
        supabaseAnonInput = PosCloudConfig.supabaseAnonKey
        email = PosAuthStore.shared.session?.email ?? ""
        isSignedIn = PosAuthStore.shared.isSignedIn
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"
        applyBrandAccent(fromHex: PosHubState.shared.brandAccentHex)
    }

    func start() async {
        phase = .starting
        switch role {
        case .hub:
            await startHub()
        case .handheld:
            await connectHandheld()
        }
    }

    func signInAndStartHub() async {
        saveConfigFromInputs()
        do {
            try await PosAuthStore.shared.signIn(email: email, password: password)
            isSignedIn = true
            await startHub()
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = error.localizedDescription
        }
    }


    private func applyBrandAccent(fromHex raw: String?) {
        brandAccentHex = PosDesign.resolveAccentHex(raw)
    }

    private func publishSnapshot(_ snap: PosLanHubSnapshot?) {
        snapshot = snap
        if let snap {
            applyBrandAccent(fromHex: snap.brandAccentHex)
        }
        pendingPrintJobs = PosHubState.shared.pendingPrintJobCount
    }

    func announce(_ message: String) {
        statusMessage = message
    }

    func signOut() {
        PosAuthStore.shared.clear()
        isSignedIn = false
        stopHub()
        flushTask?.cancel()
        phase = .needsLogin
        statusMessage = "Abgemeldet."
    }

    func refresh() async {
        switch role {
        case .hub:
            await pullCloudBootstrap(forceDemoFallback: false)
            publishSnapshot(PosHubState.shared.makeSnapshot())
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = PosSyncQueue.shared.lastFlushMessage.isEmpty
                ? "Aktualisiert."
                : PosSyncQueue.shared.lastFlushMessage
        case .handheld:
            await connectHandheld()
        }
    }

    func saveManualHost(_ raw: String) async {
        let host = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else { return }
        UserDefaults.standard.set(host, forKey: manualHostKey)
        await connectHandheld(preferredHost: host)
    }

    func openTable(tableId: String, covers: Int = 2) async {
        guard role == .hub || role == .handheld else { return }
        if role == .handheld {
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden."
                return
            }
            do {
                _ = try await HandheldHubClient.openSession(
                    baseURL: base,
                    diningTableId: tableId,
                    coverCount: covers
                )
                let snap = try await HandheldHubClient.fetchSnapshot(baseURL: base, restaurantId: nil)
                publishSnapshot(snap)
                statusMessage = "Tisch geöffnet."
            } catch {
                statusMessage = error.localizedDescription
            }
            return
        }

        let restaurantId = PosHubState.shared.restaurantId
        var cloudSessionId: String?
        if PosAuthStore.shared.isSignedIn {
            do {
                cloudSessionId = try await PosCloudClient.openTableSession(
                    restaurantId: restaurantId,
                    diningTableId: tableId,
                    coverCount: covers
                )
            } catch {
                // Offline / Fehler → lokal + Queue
            }
        }

        let sessionId = PosHubState.shared.openLocalSession(
            diningTableId: tableId,
            coverCount: covers,
            preferredSessionId: cloudSessionId
        )
        publishSnapshot(PosHubState.shared.makeSnapshot())

        if cloudSessionId == nil {
            PosSyncQueue.shared.enqueueOpenSession(PosSyncOpenSessionPayload(
                restaurantId: restaurantId,
                diningTableId: tableId,
                coverCount: covers,
                localSessionId: sessionId
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Tisch geöffnet (offline/Queue) — \(PosSyncQueue.shared.lastFlushMessage)"
        } else {
            statusMessage = "Tisch geöffnet und in der Cloud."
        }
    }

    func ensureLocalSession(tableId: String, covers: Int = 2) -> String {
        PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: covers)
    }

    func sendCart(tableId: String, lines: [PosCartLine]) async -> Bool {
        guard !lines.isEmpty else { return false }
        let restaurantId = PosHubState.shared.restaurantId
        var sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
        if sessionId == nil {
            await openTable(tableId: tableId, covers: 2)
            sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
                ?? PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: 2)
        }
        guard let sessionId else { return false }

        let items: [PosCloudOrderItem] = lines.map { line in
            PosCloudOrderItem(
                menuItemId: line.menuItemId,
                quantity: line.quantity,
                notes: line.notes.isEmpty ? nil : line.notes,
                course: line.course.rawValue,
                ohneIngredientIds: line.ohneIngredientIds,
                modifiers: line.modifiers.map {
                    PosCloudModifierPayload(
                        type: $0.type,
                        label: $0.label,
                        ingredientId: $0.ingredientId,
                        optionChoiceId: $0.optionChoiceId,
                        priceDeltaCents: $0.priceDeltaCents
                    )
                }
            )
        }

        let addCents = lines.reduce(0) { $0 + $1.lineTotalCents }
        PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: addCents)
        let localOrderNumber = (snapshot?.floor.orderCountBySessionId[sessionId] ?? 0) + 1
        PosHubState.shared.routeKitchenOutput(orderNumber: localOrderNumber, cartLines: lines)
        pendingPrintJobs = PosHubState.shared.pendingPrintJobCount
        Task { await PosPrintDispatcher.shared.kick() }
        publishSnapshot(PosHubState.shared.makeSnapshot())

        do {
            _ = try await PosCloudClient.createOrder(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: items
            )
            statusMessage = "Bestellung gesendet (\(lines.count) Positionen)."
            return true
        } catch {
            for line in lines {
                PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                    restaurantId: restaurantId,
                    tableSessionId: sessionId,
                    items: [PosSyncOrderItem(
                        menuItemId: line.menuItemId,
                        quantity: line.quantity,
                        notes: line.notes.isEmpty ? nil : line.notes
                    )],
                    localOrderId: UUID().uuidString
                ))
            }
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Lokal gebucht — Sync später (\(error.localizedDescription))"
            return true
        }
    }

    func loadOpenLines(tableId: String) async -> [SessionOpenLine] {
        guard let sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id else {
            return []
        }
        let restaurantId = PosHubState.shared.restaurantId
        guard PosAuthStore.shared.isSignedIn else { return [] }
        do {
            let lines = try await PosCloudClient.fetchSessionSummary(
                restaurantId: restaurantId,
                sessionId: sessionId
            )
            return lines.compactMap { line in
                guard line.openQuantity > 0 else { return nil }
                var detailParts: [String] = []
                if let course = line.course, let c = PosCourse(rawValue: course) {
                    detailParts.append(c.label)
                }
                if let mods = line.modifiers {
                    detailParts.append(contentsOf: mods.compactMap(\.label))
                }
                if let notes = line.notes, !notes.isEmpty {
                    detailParts.append(notes)
                }
                return SessionOpenLine(
                    id: line.id,
                    orderLineId: line.id,
                    name: line.name,
                    openQuantity: line.openQuantity,
                    openCents: line.openAmountCents,
                    detail: detailParts.joined(separator: " · ")
                )
            }
        } catch {
            statusMessage = "Offene Positionen: \(error.localizedDescription)"
            return []
        }
    }

    func collectSplit(
        sessionId: String,
        lines: [SessionOpenLine],
        method: PosPaymentMethodKind,
        tipCents: Int,
        receivedAmountCents: Int? = nil,
        giftVoucherId: String? = nil
    ) async {
        let restaurantId = PosHubState.shared.restaurantId
        let allocations = lines.map { ($0.orderLineId, $0.openQuantity) }

        if method == .voucher {
            guard let giftVoucherId, !giftVoucherId.isEmpty else {
                statusMessage = "Gutschein fehlt — bitte scannen oder Code eingeben."
                return
            }
            do {
                let result = try await PosCloudClient.collectVoucher(
                    restaurantId: restaurantId,
                    tableSessionId: sessionId,
                    giftVoucherId: giftVoucherId,
                    allocations: allocations,
                    tipCents: tipCents
                )
                if result.remainingVoucherCents > 0 {
                    statusMessage =
                        "Gutschein \(result.voucherCode) · Rest \(PosMoney.format(result.remainingVoucherCents)). Nachdruck?"
                } else {
                    statusMessage = "Gutschein \(result.voucherCode) vollständig eingelöst."
                }
                await pullCloudBootstrap(forceDemoFallback: false)
                publishSnapshot(PosHubState.shared.makeSnapshot())
            } catch {
                statusMessage = "Gutschein-Zahlung fehlgeschlagen — \(error.localizedDescription)"
            }
            return
        }

        guard method == .cash else {
            statusMessage = "\(method.label) folgt — bitte Bar oder Gutschein nutzen."
            return
        }
        do {
            try await PosCloudClient.collectCash(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                allocations: allocations,
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            )
            statusMessage = "Teilzahlung kassiert."
            await pullCloudBootstrap(forceDemoFallback: false)
            publishSnapshot(PosHubState.shared.makeSnapshot())
        } catch {
            PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                allocations: allocations.map { PosSyncCashAllocation(orderLineId: $0.0, quantity: $0.1) },
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Zahlung lokal gequeued — \(error.localizedDescription)"
        }
    }

    func moveLines(
        lineIds: [String],
        quantities: [Int],
        fromTableId: String,
        toTableId: String
    ) async {
        let restaurantId = PosHubState.shared.restaurantId
        // Ziel-Session sicherstellen
        var targetSessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == toTableId })?.id
        if targetSessionId == nil {
            await openTable(tableId: toTableId, covers: 2)
            targetSessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == toTableId })?.id
        }
        guard let targetSessionId else {
            statusMessage = "Ziel-Tisch konnte nicht geöffnet werden."
            return
        }
        let moves = zip(lineIds, quantities).map { ($0, $1) }
        do {
            try await PosCloudClient.moveLines(
                restaurantId: restaurantId,
                targetTableSessionId: targetSessionId,
                lineMoves: moves
            )
            statusMessage = "\(lineIds.count) Position(en) umgezogen."
            await pullCloudBootstrap(forceDemoFallback: false)
            publishSnapshot(PosHubState.shared.makeSnapshot())
        } catch {
            statusMessage = "Umziehen fehlgeschlagen: \(error.localizedDescription)"
        }
        _ = fromTableId
    }

    func addDemoOrder(tableId: String) async {
        guard role == .hub else { return }
        guard let menuItem = PosHubState.shared.menu?.items.first else {
            statusMessage = "Keine Speisekarte geladen."
            return
        }
        let restaurantId = PosHubState.shared.restaurantId

        // Sicherstellen, dass Session existiert (online bevorzugen)
        var sessionId: String?
        if let open = PosHubState.shared.makeSnapshot().floor.openSessions.first(where: { $0.dining_table_id == tableId }) {
            sessionId = open.id
        } else {
            await openTable(tableId: tableId, covers: 2)
            sessionId = PosHubState.shared.makeSnapshot().floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
        }
        guard let sessionId else {
            statusMessage = "Keine Tisch-Session."
            return
        }

        PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: menuItem.priceCents)
        publishSnapshot(PosHubState.shared.makeSnapshot())

        do {
            _ = try await PosCloudClient.createOrder(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: [
                    PosCloudOrderItem(
                        menuItemId: menuItem.id,
                        quantity: 1,
                        notes: nil,
                        course: PosCourse.main.rawValue,
                        ohneIngredientIds: nil,
                        modifiers: nil
                    ),
                ]
            )
            statusMessage = "„\(menuItem.name)“ in der Cloud gebucht."
        } catch {
            PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: [PosSyncOrderItem(menuItemId: menuItem.id, quantity: 1, notes: nil)],
                localOrderId: UUID().uuidString
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "„\(menuItem.name)“ lokal — Sync später (\(error.localizedDescription))"
        }
    }

    private func saveConfigFromInputs() {
        if !apiBaseInput.isEmpty { PosCloudConfig.setApiBaseURL(apiBaseInput) }
        if !supabaseUrlInput.isEmpty { PosCloudConfig.setSupabaseURL(supabaseUrlInput) }
        if !supabaseAnonInput.isEmpty { PosCloudConfig.setSupabaseAnonKey(supabaseAnonInput) }
        if !restaurantIdInput.isEmpty { PosCloudConfig.setRestaurantId(restaurantIdInput) }
    }

    private func startHub() async {
        stopHub()
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        PosHubState.shared.loadCachedOrDemo()

        isSignedIn = PosAuthStore.shared.isSignedIn
        await pullCloudBootstrap(forceDemoFallback: true)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"

        let server = HubHTTPServer { method, path, body in
            Self.handleHubRequest(method: method, path: path, body: body)
        }

        do {
            try server.start()
            httpServer = server
            let name = PosLanProtocol.bonjourName(restaurantName: PosHubState.shared.restaurantName)
            advertiser.publish(
                name: name,
                port: Int(PosLanProtocol.hubPort),
                restaurantId: PosHubState.shared.restaurantId
            )
            bonjourPublishing = true
            phase = .hubReady
            if !isSignedIn {
                statusMessage = "Kasse läuft lokal. Anmelden für Cloud-Pull & Sync."
            } else {
                statusMessage = PosHubState.shared.isDemo
                    ? "Kasse läuft (Cache). Cloud-Refresh fehlgeschlagen?"
                    : "Kasse läuft — lokale Daten bereit, Sync-Queue aktiv."
            }
            startPeriodicFlush()
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "Server-Start fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func startPeriodicFlush() {
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                await PosSyncQueue.shared.flushIfPossible()
                await MainActor.run {
                    self?.syncPending = PosSyncQueue.shared.pendingCount
                    if !PosSyncQueue.shared.lastFlushMessage.isEmpty {
                        self?.statusMessage = PosSyncQueue.shared.lastFlushMessage
                    }
                }
            }
        }
    }

    private func pullCloudBootstrap(forceDemoFallback: Bool) async {
        guard PosAuthStore.shared.isSignedIn else {
            if forceDemoFallback {
                PosHubState.shared.loadCachedOrDemo()
            }
            return
        }
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            statusMessage = "Restaurant-ID fehlt in den Einstellungen."
            return
        }
        do {
            let bootstrap = try await PosCloudClient.fetchBootstrap(restaurantId: restaurantId)
            PosHubState.shared.applyBootstrap(bootstrap)
            statusMessage = "Cloud-Daten geladen (\(bootstrap.floor.tables.count) Tische, \(bootstrap.menu.items.count) Gerichte)."
        } catch {
            PosHubState.shared.loadCachedOrDemo()
            statusMessage = "Cloud nicht erreichbar — Cache/Demo: \(error.localizedDescription)"
        }
    }

    private func stopHub() {
        httpServer?.stop()
        httpServer = nil
        advertiser.stop()
        bonjourPublishing = false
    }

    private nonisolated static func handleHubRequest(
        method: String,
        path: String,
        body: Data
    ) -> (Int, Data) {
        if method == "OPTIONS" {
            return (204, Data())
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let decoder = JSONDecoder()

        if method == "GET" {
            if path == PosLanProtocol.healthPath {
                let health = PosHubState.shared.makeHealth()
                let data = (try? encoder.encode(health)) ?? Data(#"{"ok":false}"#.utf8)
                return (200, data)
            }
            if path == PosLanProtocol.snapshotPath {
                let snap = PosHubState.shared.makeSnapshot()
                let data = (try? encoder.encode(snap)) ?? Data(#"{"error":"encode"}"#.utf8)
                return (200, data)
            }
            if path == PosLanProtocol.kdsPath {
                return (200, KdsHubHTML.page())
            }
            if path == PosLanProtocol.kdsTicketsPath {
                return (200, PosHubState.shared.kdsTicketsJSON())
            }
            if path == PosLanProtocol.printJobsPath {
                return (200, PosHubState.shared.printJobsJSON())
            }
            return (404, Data(#"{"error":"not_found"}"#.utf8))
        }

        if method == "POST" {
            if path == PosLanProtocol.openSessionPath {
                struct Req: Decodable {
                    var diningTableId: String
                    var coverCount: Int?
                }
                guard let req = try? decoder.decode(Req.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let sessionId = PosHubState.shared.openLocalSession(
                    diningTableId: req.diningTableId,
                    coverCount: req.coverCount ?? 2
                )
                let restaurantId = PosHubState.shared.restaurantId
                Task { @MainActor in
                    PosSyncQueue.shared.enqueueOpenSession(PosSyncOpenSessionPayload(
                        restaurantId: restaurantId,
                        diningTableId: req.diningTableId,
                        coverCount: req.coverCount ?? 2,
                        localSessionId: sessionId
                    ))
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let payload = ["sessionId": sessionId]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }

            if path == PosLanProtocol.createOrderPath {
                struct Item: Decodable {
                    var menuItemId: String
                    var quantity: Int
                    var notes: String?
                }
                struct Req: Decodable {
                    var diningTableId: String
                    var coverCount: Int?
                    var items: [Item]
                }
                guard let req = try? decoder.decode(Req.self, from: body), !req.items.isEmpty else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let sessionId = PosHubState.shared.openLocalSession(
                    diningTableId: req.diningTableId,
                    coverCount: req.coverCount ?? 2
                )
                var addCents = 0
                if let menu = PosHubState.shared.menu {
                    for item in req.items {
                        let price = menu.items.first(where: { $0.id == item.menuItemId })?.priceCents ?? 0
                        addCents += price * item.quantity
                    }
                }
                PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: addCents)
                let orderNumber = (PosHubState.shared.makeSnapshot().floor.orderCountBySessionId[sessionId] ?? 1)
                let cartLines: [PosCartLine] = req.items.compactMap { item in
                    guard let menuItem = PosHubState.shared.menu?.items.first(where: { $0.id == item.menuItemId }) else {
                        return nil
                    }
                    return PosCartLine(
                        menuItemId: menuItem.id,
                        name: menuItem.name,
                        unitPriceCents: menuItem.priceCents,
                        quantity: item.quantity,
                        course: .other,
                        notes: item.notes ?? "",
                        modifiers: []
                    )
                }
                PosHubState.shared.routeKitchenOutput(orderNumber: orderNumber, cartLines: cartLines)
                Task { await PosPrintDispatcher.shared.kick() }
                let restaurantId = PosHubState.shared.restaurantId
                let localOrderId = UUID().uuidString
                Task { @MainActor in
                    PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                        restaurantId: restaurantId,
                        tableSessionId: sessionId,
                        items: req.items.map {
                            PosSyncOrderItem(menuItemId: $0.menuItemId, quantity: $0.quantity, notes: $0.notes)
                        },
                        localOrderId: localOrderId
                    ))
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let payload: [String: Any] = [
                    "sessionId": sessionId,
                    "localOrderId": localOrderId,
                    "ok": true,
                ]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }
        }

        return (405, Data(#"{"error":"method_not_allowed"}"#.utf8))
    }

    private func connectHandheld(preferredHost: String? = nil) async {
        phase = .searching
        statusMessage = "Suche iPad-Kasse im WLAN …"
        publishSnapshot(nil)
        hubBaseURL = nil

        var candidates: [URL] = []
        if let preferredHost, !preferredHost.isEmpty {
            candidates.append(PosLanProtocol.hubBaseURL(host: preferredHost))
        } else if let saved = UserDefaults.standard.string(forKey: manualHostKey), !saved.isEmpty {
            candidates.append(PosLanProtocol.hubBaseURL(host: saved))
        }

        let discovered = await browser.scan(timeout: 4.5)
        for hub in discovered where !candidates.contains(hub.baseURL) {
            candidates.append(hub.baseURL)
        }

        guard !candidates.isEmpty else {
            phase = .error("Keine Kasse gefunden")
            statusMessage = "Handgerät kann nur starten, wenn die iPad-Kasse im WLAN erreichbar ist."
            return
        }

        var lastError: String?
        for base in candidates {
            do {
                statusMessage = "Verbinde \(base.host ?? "") …"
                let health = try await HandheldHubClient.fetchHealth(baseURL: base)
                guard health.ok else { throw HandheldHubClientError.invalidResponse }
                let snap = try await HandheldHubClient.fetchSnapshot(
                    baseURL: base,
                    restaurantId: health.restaurantId
                )
                if let host = base.host {
                    UserDefaults.standard.set(host, forKey: manualHostKey)
                }
                hubBaseURL = base
                publishSnapshot(snap)
                phase = .connected
                statusMessage = "Verbunden mit \(snap.hub.displayName)."
                return
            } catch {
                lastError = error.localizedDescription
            }
        }

        phase = .error(lastError ?? "Kasse nicht erreichbar")
        statusMessage = lastError ?? "Kasse nicht erreichbar — Handgerät wartet auf die Kasse."
    }
}
