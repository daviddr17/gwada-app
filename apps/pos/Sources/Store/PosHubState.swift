import Foundation

struct PosFiredCourseStore: Equatable {
    private var bySession: [String: Set<Int>] = [:]

    mutating func mark(sessionId: String, course: Int) {
        bySession[sessionId, default: []].insert(course)
    }

    func hasAny(sessionId: String) -> Bool {
        !(bySession[sessionId]?.isEmpty ?? true)
    }

    func has(sessionId: String, course: Int) -> Bool {
        bySession[sessionId]?.contains(course) ?? false
    }

    mutating func clear(sessionId: String) {
        bySession[sessionId] = nil
    }
}

/// Autoritative lokale Hub-Daten (Floor + Speisekarte), die Handgeräte per LAN abrufen.
final class PosHubState: @unchecked Sendable {
    static let shared = PosHubState()

    private let lock = NSLock()
    private var bootstrap: PosCloudBootstrap?
    private var hubDeviceId: String = UUID().uuidString
    private var usingDemo = true
    private var snapshotVersion: Int = 1
    private var waiterCaps: [String: [String]] = [:]
    /// Stabiles `generatedAt` pro Revision — sonst ist Snapshot-JSON-Cache nutzlos.
    private var generatedAtForVersion: (version: Int, iso: String)?
    /// Cache für LAN `GET /v1/snapshot` (volle Speisekarte).
    private var encodedSnapshotCache: (version: Int, data: Data)?

    private static let lanSnapshotEncoder = JSONEncoder()

    private init() {}

    func configure(hubDeviceId: String) {
        lock.lock()
        defer { lock.unlock() }
        self.hubDeviceId = hubDeviceId
    }

    private func bumpSnapshotVersionLocked() {
        snapshotVersion += 1
        encodedSnapshotCache = nil
        generatedAtForVersion = nil
    }

    private func stableGeneratedAtLocked() -> String {
        if let existing = generatedAtForVersion, existing.version == snapshotVersion {
            return existing.iso
        }
        let iso = ISO8601DateFormatter().string(from: Date())
        generatedAtForVersion = (snapshotVersion, iso)
        return iso
    }

    /// Erhöht die Snapshot-Revision (nach lokalen Floor-/Order-Mutationen).
    func bumpSnapshotVersion() {
        lock.lock()
        defer { lock.unlock() }
        bumpSnapshotVersionLocked()
    }

    /// Caps-Snapshot für LAN (ohne Klartext-PINs) — von MainActor nach Login/Cache-Update setzen.
    func setWaiterCaps(_ caps: [String: [String]]) {
        lock.lock()
        defer { lock.unlock() }
        waiterCaps = caps
        bumpSnapshotVersionLocked()
    }

    func applyBootstrap(_ bootstrap: PosCloudBootstrap) {
        lock.lock()
        defer { lock.unlock() }
        var next = bootstrap
        let keepMenu =
            bootstrap.menuUnchanged == true
            || (bootstrap.menu.items.isEmpty
                && !(self.bootstrap?.menu.items.isEmpty ?? true)
                && bootstrap.menuRevision != nil
                && bootstrap.menuRevision == self.bootstrap?.menuRevision)
        if keepMenu, let previous = self.bootstrap {
            next.menu = previous.menu
            if next.menuRevision == nil {
                next.menuRevision = previous.menuRevision
            }
            next.menuUnchanged = nil
        }
        self.bootstrap = next
        self.usingDemo = false
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(next)
    }

    func loadCachedOrDemo() {
        lock.lock()
        defer { lock.unlock() }
        if var cached = PosLocalStore.loadBootstrap() {
            var dirty = false
            // Alte DEBUG-Caches ohne Speisekarte → Demo-Menü nachziehen.
            if cached.menu.items.isEmpty {
                cached.menu = DemoSnapshotFactory.makeDemoMenu()
                dirty = true
            }
            // Solo-Demo-Restaurant: Menü immer an aktuelle Factory anbinden
            // (Rezept/Beilagen), sonst bleibt ein alter Disk-Cache ohne Sheet-Felder.
            if cached.restaurantId == DemoSnapshotFactory.restaurantId {
                let freshMenu = DemoSnapshotFactory.makeDemoMenu()
                if cached.menu != freshMenu {
                    cached.menu = freshMenu
                    dirty = true
                }
            }
            // Alte Fake-Session (24,50 € ohne echte Positionen) — auch wenn Menü schon gepatcht.
            if cached.floor.openSessions.contains(where: { $0.id == "session-open-1" }) {
                cached.floor.openSessions.removeAll { $0.id == "session-open-1" }
                cached.floor.orderCountBySessionId.removeValue(forKey: "session-open-1")
                cached.floor.sessionMetaBySessionId.removeValue(forKey: "session-open-1")
                dirty = true
            }
            if dirty {
                PosLocalStore.saveBootstrap(cached)
            }
            bootstrap = cached
            usingDemo = false
        } else {
            let demo = DemoSnapshotFactory.makeBootstrap(hubDeviceId: hubDeviceId)
            bootstrap = demo
            usingDemo = true
            PosLocalStore.saveBootstrap(demo)
        }
        loadLocalOpenLinesLocked()
    }

    /// Handgerät: Open-Lines vom Disk ohne Bootstrap/Demo zu überschreiben.
    func reloadPersistedOpenLines() {
        lock.lock()
        defer { lock.unlock() }
        loadLocalOpenLinesLocked()
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

    var menuRevision: String? {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.menuRevision
    }

    var isDemo: Bool {
        lock.lock()
        defer { lock.unlock() }
        return usingDemo || bootstrap == nil
    }

    func makeSnapshot() -> PosLanHubSnapshot {
        lock.lock()
        defer { lock.unlock() }
        return makeSnapshotLocked()
    }

    /// Vorkodiertes Snapshot-JSON für LAN — Cache pro `snapshotVersion`, Encode außerhalb des Locks.
    func encodedSnapshotJSON() -> Data {
        lock.lock()
        if let cache = encodedSnapshotCache, cache.version == snapshotVersion {
            let data = cache.data
            lock.unlock()
            return data
        }
        let snap = makeSnapshotLocked()
        let version = snapshotVersion
        lock.unlock()

        let data = (try? Self.lanSnapshotEncoder.encode(snap))
            ?? Data(#"{"error":"encode"}"#.utf8)

        lock.lock()
        if snapshotVersion == version {
            encodedSnapshotCache = (version, data)
        }
        lock.unlock()
        return data
    }

    private func makeSnapshotLocked() -> PosLanHubSnapshot {
        let caps = waiterCaps.isEmpty ? nil : waiterCaps
        let generatedAt = stableGeneratedAtLocked()
        if let bootstrap {
            return PosLanHubSnapshot(
                protocolVersion: PosLanProtocol.version,
                restaurantId: bootstrap.restaurantId,
                restaurantName: bootstrap.restaurantName,
                brandAccentHex: bootstrap.resolvedAccentHex,
                generatedAt: generatedAt,
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
                ),
                snapshotVersion: snapshotVersion,
                waiterCaps: caps
            )
        }
        var demo = DemoSnapshotFactory.makeSnapshot(hubDeviceId: hubDeviceId)
        demo.generatedAt = generatedAt
        demo.snapshotVersion = snapshotVersion
        demo.waiterCaps = caps
        return demo
    }

    func applyLocalRegister(_ state: PosLocalRegisterState) {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return }
        bootstrap.register = PosCloudRegisterStatus(
            isOpen: state.isOpen,
            sessionId: state.sessionId,
            openedAt: state.openedAt
        )
        self.bootstrap = bootstrap
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
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
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
        return sessionId
    }

    /// Offene Session für Tisch — ohne neue anzulegen (Flush / Hard-Reject).
    func openSessionId(forDiningTableId tableId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return bootstrap?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
    }

    func hasOpenSession(id sessionId: String, diningTableId: String?) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let bootstrap else { return false }
        guard let session = bootstrap.floor.openSessions.first(where: { $0.id == sessionId }) else {
            return false
        }
        if let diningTableId, session.dining_table_id != diningTableId {
            return false
        }
        return true
    }

    func containsOpenLine(sessionId: String, lineId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return localOpenLinesBySession[sessionId]?.contains(where: { $0.id == lineId || $0.orderLineId == lineId }) == true
    }

    func removeLocalOpenLines(sessionId: String, lineIds: Set<String>) {
        guard !lineIds.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        guard var lines = localOpenLinesBySession[sessionId] else { return }
        lines.removeAll { lineIds.contains($0.id) || lineIds.contains($0.orderLineId) }
        localOpenLinesBySession[sessionId] = lines.isEmpty ? nil : lines
        persistLocalOpenLinesLocked()
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
        if let lines = localOpenLinesBySession.removeValue(forKey: local) {
            localOpenLinesBySession[cloud] = (localOpenLinesBySession[cloud] ?? []) + lines
            persistLocalOpenLinesLocked()
        }

        self.bootstrap = bootstrap
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
    }

    /// Gästezahl einer offenen Session lokal anpassen.
    @discardableResult
    func updateCoverCount(sessionId: String, count: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return false }
        guard let idx = bootstrap.floor.openSessions.firstIndex(where: { $0.id == sessionId }) else {
            return false
        }
        let old = bootstrap.floor.openSessions[idx]
        let clamped = min(50, max(1, count))
        guard old.cover_count != clamped else { return true }
        bootstrap.floor.openSessions[idx] = PosLanOpenSession(
            id: old.id,
            dining_table_id: old.dining_table_id,
            cover_count: clamped,
            opened_at: old.opened_at
        )
        self.bootstrap = bootstrap
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
        return true
    }

    /// Session auf freien Ziel-Tisch umhängen (Floor-Metas bleiben an sessionId).
    @discardableResult
    func moveLocalSession(sessionId: String, toTableId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return false }
        guard let idx = bootstrap.floor.openSessions.firstIndex(where: { $0.id == sessionId }) else {
            return false
        }
        if bootstrap.floor.openSessions.contains(where: { $0.dining_table_id == toTableId }) {
            return false
        }
        guard bootstrap.floor.tables.contains(where: { $0.id == toTableId && $0.is_active }) else {
            return false
        }
        let old = bootstrap.floor.openSessions[idx]
        bootstrap.floor.openSessions[idx] = PosLanOpenSession(
            id: old.id,
            dining_table_id: toTableId,
            cover_count: old.cover_count,
            opened_at: old.opened_at
        )
        self.bootstrap = bootstrap
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
        return true
    }

    /// Session freigeben (nach bezahlt / Abbruch vor Fire).
    @discardableResult
    func releaseLocalSession(sessionId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var bootstrap else { return false }
        let diningTableId = bootstrap.floor.openSessions.first(where: { $0.id == sessionId })?.dining_table_id
        let before = bootstrap.floor.openSessions.count
        bootstrap.floor.openSessions.removeAll { $0.id == sessionId }
        bootstrap.floor.orderCountBySessionId.removeValue(forKey: sessionId)
        bootstrap.floor.sessionMetaBySessionId.removeValue(forKey: sessionId)
        guard bootstrap.floor.openSessions.count < before else { return false }
        firedCourses.clear(sessionId: sessionId)
        localOpenLinesBySession.removeValue(forKey: sessionId)
        kassierenLocksBySession.removeValue(forKey: sessionId)
        persistKassierenLocksLocked()
        self.bootstrap = bootstrap
        bumpSnapshotVersionLocked()
        PosLocalStore.saveBootstrap(bootstrap)
        PosDraftCartStore.clear(diningTableId: diningTableId, sessionId: sessionId)
        PosPaidHistoryStore.clear(sessionId: sessionId)
        return true
    }

    /// Ob für die Session schon ein Küchen-Fire gelaufen ist (Abbruch-Gate).
    func hasFired(sessionId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return firedCourses.hasAny(sessionId: sessionId)
    }

    func hasFired(sessionId: String, course: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return firedCourses.has(sessionId: sessionId, course: course)
    }

    func markFired(sessionId: String, course: Int) {
        lock.lock()
        defer { lock.unlock() }
        firedCourses.mark(sessionId: sessionId, course: course)
    }

    func clearFired(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        firedCourses.clear(sessionId: sessionId)
    }

    private var firedCourses = PosFiredCourseStore()

    /// Offline / Demo-Hub: gesendete Positionen bleiben sichtbar bis Cloud-Summary greift.
    private var localOpenLinesBySession: [String: [SessionOpenLine]] = [:]
    /// Kassieren-Modus-Lock pro Session (Positions ↔ Gleich teilen).
    private var kassierenLocksBySession: [String: PosKassierenLockState] = [:]

    /// Hängt offene Positionen an. Nutzt `PosCartLine.id` (LAN: `clientLineId`), damit Hub und Handgerät dieselben IDs teilen.
    @discardableResult
    func appendLocalOpenLines(sessionId: String, from cartLines: [PosCartLine]) -> [String] {
        guard !cartLines.isEmpty else { return [] }
        lock.lock()
        defer { lock.unlock() }
        var existing = localOpenLinesBySession[sessionId] ?? []
        var ids: [String] = []
        for line in cartLines {
            let id = line.id
            ids.append(id)
            existing.append(
                SessionOpenLine(
                    id: id,
                    orderLineId: id,
                    name: line.name,
                    openQuantity: line.quantity,
                    openCents: line.lineTotalCents,
                    course: line.course,
                    firedAt: nil,
                    detail: line.subtitle,
                    menuItemId: line.menuItemId,
                    lineQuantity: line.quantity,
                    lineTotalCents: line.lineTotalCents
                )
            )
        }
        localOpenLinesBySession[sessionId] = existing
        persistLocalOpenLinesLocked()
        return ids
    }

    /// Nach Offline-Order: lokale Zeilen-IDs durch Cloud-IDs ersetzen.
    func remapOpenLineIds(sessionId: String, mappings: [(localLineId: String, cloudLineId: String)]) {
        let sid = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sid.isEmpty, !mappings.isEmpty else { return }

        lock.lock()
        defer { lock.unlock() }
        guard var list = localOpenLinesBySession[sid] else { return }
        for mapping in mappings {
            let local = mapping.localLineId.trimmingCharacters(in: .whitespacesAndNewlines)
            let cloud = mapping.cloudLineId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !local.isEmpty, !cloud.isEmpty else { continue }
            guard let idx = list.firstIndex(where: { $0.orderLineId == local || $0.id == local }) else {
                continue
            }
            list[idx].id = cloud
            list[idx].orderLineId = cloud
        }
        localOpenLinesBySession[sid] = list
        persistLocalOpenLinesLocked()
    }

    func localOpenLines(sessionId: String) -> [SessionOpenLine] {
        lock.lock()
        defer { lock.unlock() }
        return localOpenLinesBySession[sessionId] ?? []
    }

    func markLocalCourseFired(sessionId: String, course: Int, at date: Date = Date()) {
        lock.lock()
        defer { lock.unlock() }
        guard var lines = localOpenLinesBySession[sessionId] else { return }
        for i in lines.indices where lines[i].course == course && lines[i].firedAt == nil {
            lines[i].firedAt = date
        }
        localOpenLinesBySession[sessionId] = lines
        persistLocalOpenLinesLocked()
    }

    func clearLocalOpenLines(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        localOpenLinesBySession.removeValue(forKey: sessionId)
        kassierenLocksBySession.removeValue(forKey: sessionId)
        persistLocalOpenLinesLocked()
        persistKassierenLocksLocked()
    }

    /// Ersetzt lokale Open-Lines (Tests / Demo-Seed).
    func replaceLocalOpenLines(sessionId: String, lines: [SessionOpenLine]) {
        lock.lock()
        defer { lock.unlock() }
        localOpenLinesBySession[sessionId] = lines.isEmpty ? nil : lines
        persistLocalOpenLinesLocked()
    }

    func kassierenLock(sessionId: String) -> PosKassierenLockState? {
        lock.lock()
        defer { lock.unlock() }
        return kassierenLocksBySession[sessionId]
    }

    func setKassierenLock(sessionId: String, state: PosKassierenLockState) {
        lock.lock()
        defer { lock.unlock() }
        kassierenLocksBySession[sessionId] = state
        persistKassierenLocksLocked()
    }

    func clearKassierenLock(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        kassierenLocksBySession.removeValue(forKey: sessionId)
        persistKassierenLocksLocked()
    }

    /// Atomar: validate + Teilmengen-Collect.
    /// `nil` wenn nichts zu zahlen / Race (kein Enqueue).
    func settleCollectAllocations(
        sessionId: String,
        allocations: [(lineId: String, quantity: Int)]
    ) -> (paidCents: Int, allocations: [PosSyncCashAllocation], amountCents: Int)? {
        lock.lock()
        defer { lock.unlock() }
        switch validateCollectAllocationsLocked(sessionId: sessionId, allocations: allocations) {
        case .ok(let paidCents, let resolved):
            guard paidCents > 0, !resolved.isEmpty else { return nil }
            let syncAllocs = resolved.map {
                PosSyncCashAllocation(orderLineId: $0.orderLineId, quantity: $0.quantity)
            }
            applyCollectAllocationsLocked(sessionId: sessionId, resolved: resolved, paidCents: paidCents)
            return (paidCents, syncAllocs, paidCents)
        case .unknownLines, .noOpenLines, .exceedsOpen:
            return nil
        }
    }

    /// Atomar: validate + volle Zeilen (Legacy).
    /// Alle `lineIds` müssen bekannt sein — unbekannte IDs → kein Partial-Settle.
    func settleCollectLines(
        sessionId: String,
        lineIds: Set<String>
    ) -> (paidCents: Int, allocations: [PosSyncCashAllocation], amountCents: Int)? {
        lock.lock()
        defer { lock.unlock() }
        switch validateCollectLinesLocked(sessionId: sessionId, lineIds: lineIds) {
        case .unknownLines, .noOpenLines:
            return nil
        case .ok:
            break
        }
        guard let lines = localOpenLinesBySession[sessionId] else { return nil }
        let allocs: [(lineId: String, quantity: Int)] = lines
            .filter { lineIds.contains($0.id) }
            .map { ($0.id, $0.openQuantity) }
        switch validateCollectAllocationsLocked(sessionId: sessionId, allocations: allocs) {
        case .ok(let paidCents, let resolved):
            guard paidCents > 0, !resolved.isEmpty else { return nil }
            let syncAllocs = resolved.map {
                PosSyncCashAllocation(orderLineId: $0.orderLineId, quantity: $0.quantity)
            }
            applyCollectAllocationsLocked(sessionId: sessionId, resolved: resolved, paidCents: paidCents)
            return (paidCents, syncAllocs, paidCents)
        case .unknownLines, .noOpenLines, .exceedsOpen:
            return nil
        }
    }

    /// Nach Teilzahlung: gewählte Positionen entfernen bzw. Mengen reduzieren.
    @discardableResult
    func collectLocalLines(sessionId: String, lineIds: Set<String>) -> Int {
        settleCollectLines(sessionId: sessionId, lineIds: lineIds)?.paidCents ?? 0
    }

    @discardableResult
    func collectLocalAllocations(
        sessionId: String,
        allocations: [(lineId: String, quantity: Int)]
    ) -> Int {
        settleCollectAllocations(sessionId: sessionId, allocations: allocations)?.paidCents ?? 0
    }

    enum CollectLineValidation: Equatable {
        case ok(paidCents: Int)
        case unknownLines
        case noOpenLines
    }

    enum CollectAllocationValidation: Equatable {
        case ok(paidCents: Int, resolved: [ResolvedCollectAllocation])
        case unknownLines
        case noOpenLines
        case exceedsOpen
    }

    struct ResolvedCollectAllocation: Equatable {
        var lineId: String
        var orderLineId: String
        var quantity: Int
        var amountCents: Int
    }

    /// Prüft, dass alle `lineIds` zur Session gehören und summiert den offenen Betrag.
    func validateCollectLines(sessionId: String, lineIds: Set<String>) -> CollectLineValidation {
        lock.lock()
        defer { lock.unlock() }
        return validateCollectLinesLocked(sessionId: sessionId, lineIds: lineIds)
    }

    func validateCollectAllocations(
        sessionId: String,
        allocations: [(lineId: String, quantity: Int)]
    ) -> CollectAllocationValidation {
        lock.lock()
        defer { lock.unlock() }
        return validateCollectAllocationsLocked(sessionId: sessionId, allocations: allocations)
    }

    private func validateCollectLinesLocked(sessionId: String, lineIds: Set<String>) -> CollectLineValidation {
        guard !lineIds.isEmpty else { return .noOpenLines }
        guard let lines = localOpenLinesBySession[sessionId], !lines.isEmpty else {
            return .noOpenLines
        }
        let known = Set(lines.map(\.id))
        guard lineIds.isSubset(of: known) else { return .unknownLines }
        let paid = lines.reduce(0) { sum, line in
            lineIds.contains(line.id) ? sum + line.openCents : sum
        }
        return .ok(paidCents: paid)
    }

    private func validateCollectAllocationsLocked(
        sessionId: String,
        allocations: [(lineId: String, quantity: Int)]
    ) -> CollectAllocationValidation {
        let normalized = Dictionary(grouping: allocations.filter { $0.quantity > 0 }, by: \.lineId)
            .mapValues { $0.reduce(0) { $0 + $1.quantity } }
        guard !normalized.isEmpty else { return .noOpenLines }
        guard let lines = localOpenLinesBySession[sessionId], !lines.isEmpty else {
            return .noOpenLines
        }
        let byId = Dictionary(uniqueKeysWithValues: lines.map { ($0.id, $0) })
        var resolved: [ResolvedCollectAllocation] = []
        var paid = 0
        for (lineId, qty) in normalized {
            guard let line = byId[lineId] else { return .unknownLines }
            guard qty <= line.openQuantity else { return .exceedsOpen }
            let cents = PosSettlementMath.sliceAmountCents(
                lineTotalCents: line.settlementLineTotalCents,
                lineQuantity: line.settlementLineQuantity,
                paidQuantityBefore: line.paidQuantity,
                allocQuantity: qty
            )
            guard cents > 0 else { return .exceedsOpen }
            paid += cents
            resolved.append(ResolvedCollectAllocation(
                lineId: line.id,
                orderLineId: line.orderLineId,
                quantity: qty,
                amountCents: cents
            ))
        }
        return .ok(paidCents: paid, resolved: resolved)
    }

    private func applyCollectAllocationsLocked(
        sessionId: String,
        resolved: [ResolvedCollectAllocation],
        paidCents: Int
    ) {
        guard var lines = localOpenLinesBySession[sessionId] else { return }
        let payById = Dictionary(uniqueKeysWithValues: resolved.map { ($0.lineId, $0) })
        var next: [SessionOpenLine] = []
        for line in lines {
            guard let pay = payById[line.id] else {
                next.append(line)
                continue
            }
            let leftQty = line.openQuantity - pay.quantity
            if leftQty <= 0 { continue }
            var copy = line
            copy.openQuantity = leftQty
            copy.lineQuantity = line.settlementLineQuantity
            copy.lineTotalCents = line.settlementLineTotalCents
            copy.syncOpenCentsFromOriginal()
            next.append(copy)
        }
        localOpenLinesBySession[sessionId] = next.isEmpty ? nil : next
        persistLocalOpenLinesLocked()

        if paidCents > 0, var bootstrap = self.bootstrap {
            var meta = bootstrap.floor.sessionMetaBySessionId[sessionId]
                ?? PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
            meta.openCents = max(0, meta.openCents - paidCents)
            bootstrap.floor.sessionMetaBySessionId[sessionId] = meta
            self.bootstrap = bootstrap
            bumpSnapshotVersionLocked()
            PosLocalStore.saveBootstrap(bootstrap)
        }
    }

    private func applyCollectLocked(sessionId: String, lineIds: Set<String>, paidCents: Int) {
        guard let lines = localOpenLinesBySession[sessionId] else { return }
        let allocs = lines.filter { lineIds.contains($0.id) }.map {
            ResolvedCollectAllocation(
                lineId: $0.id,
                orderLineId: $0.orderLineId,
                quantity: $0.openQuantity,
                amountCents: $0.openCents
            )
        }
        applyCollectAllocationsLocked(sessionId: sessionId, resolved: allocs, paidCents: paidCents)
    }

    // MARK: Collect idempotency (hub)

    private var consumedCollectAttemptIds: [String] = []
    private let maxConsumedCollectAttempts = 200
    private var consumedOrderEventIds: [String] = []
    private let maxConsumedOrderEvents = 200

    /// `true` wenn die Attempt-ID neu ist und registriert wurde; `false` wenn bereits verbraucht.
    func registerCollectAttemptId(_ id: String) -> Bool {
        let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return true }
        lock.lock()
        defer { lock.unlock() }
        if consumedCollectAttemptIds.contains(trimmed) { return false }
        consumedCollectAttemptIds.append(trimmed)
        if consumedCollectAttemptIds.count > maxConsumedCollectAttempts {
            consumedCollectAttemptIds.removeFirst(consumedCollectAttemptIds.count - maxConsumedCollectAttempts)
        }
        return true
    }

    /// Order-Event-Idempotenz (Outbox-Flush). `true` = neu; `false` = bereits angewendet.
    func registerOrderEventId(_ id: String) -> Bool {
        let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return true }
        lock.lock()
        defer { lock.unlock() }
        if consumedOrderEventIds.contains(trimmed) { return false }
        consumedOrderEventIds.append(trimmed)
        if consumedOrderEventIds.count > maxConsumedOrderEvents {
            consumedOrderEventIds.removeFirst(consumedOrderEventIds.count - maxConsumedOrderEvents)
        }
        return true
    }

    private func persistLocalOpenLinesLocked() {
        PosLocalStore.saveOpenLines(localOpenLinesBySession)
    }

    private func persistKassierenLocksLocked() {
        PosLocalStore.saveKassierenLocks(kassierenLocksBySession)
    }

    private func loadLocalOpenLinesLocked() {
        localOpenLinesBySession = PosLocalStore.loadOpenLines() ?? [:]
        kassierenLocksBySession = PosLocalStore.loadKassierenLocks() ?? [:]
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
        bumpSnapshotVersionLocked()
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
                "course": line.course,
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
                    let course = (line["course"] as? Int) ?? PosCourse.parse(line["course"] as? String)
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
        var payload: [String: Any] = [
            "tickets": tickets,
            "statuses": statusPayload,
        ]
        if let deviceId,
           let device = bootstrap?.kitchen?.kdsDevices.first(where: { $0.id == deviceId && $0.isActive })
        {
            payload["device"] = [
                "id": device.id,
                "name": device.name,
            ]
        }
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
