import Foundation
import Security
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
        case awaitingApproval
        case error(String)
    }

    @Published private(set) var role: PosDeviceRole
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var detectionLabel: String
    @Published private(set) var hubBaseURL: URL?
    @Published private(set) var pairingChallenge: PosLanPairChallenge?
    private var pairingPollTask: Task<Void, Never>?
    /// Handgerät ohne iPad-Kasse (Demo/Cloud lokal) — UI bleibt Kellner-Tabs.
    @Published private(set) var isSoloMode = false
    @Published private(set) var snapshot: PosLanHubSnapshot?
    @Published private(set) var bonjourPublishing = false
    @Published private(set) var statusMessage: String = ""
    @Published private(set) var syncPending: Int = 0
    @Published private(set) var isSignedIn = false
    @Published private(set) var dataSourceLabel = "—"
    /// Feste Gwada-Marke (`#EAB308`) — nicht Restaurant-Settings.
    @Published private(set) var brandAccentHex = PosDesign.defaultAccentHex
    @Published private(set) var pendingPrintJobs = 0
    /// Phase 3: Anzahl ausstehender Handheld→Hub-Events.
    @Published private(set) var outboxPending = 0
    /// Wann die Kasse getrennt wurde (für 45‑Min-Banner).
    @Published private(set) var hubDisconnectedAt: Date?
    /// Phase 6: Hard-Reject Sheet (Tisch zu / Session weg).
    @Published var outboxConflict: OutboxConflictPresentation?

    /// Paired + Hub down länger als 45 Min → verstärkter Banner.
    var isHubDisconnectedStale: Bool {
        guard isHubDisconnectedWhilePaired, let since = hubDisconnectedAt else { return false }
        return Date().timeIntervalSince(since) >= 45 * 60
    }

    /// Phase 6: Banner / Suche — kurze Statuszeile für Capsule.
    var hubConnectionBannerSearching: Bool {
        role == .handheld && phase == .searching
    }

    var brandTint: Color {
        PosDesign.brandAccent
    }

    private nonisolated static func nonEmptyId(_ raw: String?) -> String? {
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Paired Handgerät ohne erreichbare Kasse (Cache-Modus / Banner).
    var isHubDisconnectedWhilePaired: Bool {
        role == .handheld
            && PosEnrollmentStore.shared.isHandheldPaired
            && (isSoloMode || hubBaseURL == nil)
    }

    /// Phase 2/4: neue Tisch-Session nur mit Live-Hub (DEBUG-Solo ausgenommen).
    var canOpenNewTableSession: Bool {
        if role == .hub { return true }
        if PosSecurityPolicy.allowsSoloMode, isSoloMode, !PosEnrollmentStore.shared.isHandheldPaired {
            return true
        }
        return role == .handheld && hubBaseURL != nil && !isSoloMode
    }

    /// Phase 4: Kassieren nur mit Live-Hub (gleiche Gate-Logik wie neue Session).
    var canCollectAtRegister: Bool { canOpenNewTableSession }

    /// Phase 4: Reservierungen schreiben nur mit Live-Hub; UI sonst read-only aus Cache.
    var canWriteReservations: Bool { canOpenNewTableSession }

    var hubOpsBlockedMessage: String { "Nur mit erreichbarer Kasse." }

    /// Phase 4/Review A: Floor-Mutationen (Freigeben/Feuern/Umziehen) nur mit Live-Hub.
    var canMutateLiveFloor: Bool { canOpenNewTableSession }

    /// Lokalen Hub-Floor als Snapshot publishen — nie am gekoppelten Handgerät (LAN-SoT).
    private var shouldPublishLocalHubFloor: Bool {
        if role == .hub { return true }
        if PosSecurityPolicy.allowsSoloMode, isSoloMode, !PosEnrollmentStore.shared.isHandheldPaired {
            return true
        }
        return false
    }

    @Published var restaurantIdInput = ""
    @Published var apiBaseInput = ""
    @Published var supabaseUrlInput = ""
    @Published var supabaseAnonInput = ""
    @Published var nestApiBaseInput = ""
    @Published var waiterProfileIdInput = ""

    private let hubDeviceId = PosDeviceIdentity.id
    private var httpServer: HubHTTPServer?
    private let advertiser = BonjourHubAdvertiser()
    private let browser = BonjourHubBrowser()
    private let manualHostKey = "gwada_pos_hub_host"
    private let hubDisconnectedAtKey = "gwada_pos_hub_disconnected_at"
    private var flushTask: Task<Void, Never>?
    private var hubReconnectLoopTask: Task<Void, Never>?

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
        nestApiBaseInput = PosCloudConfig.nestApiBaseURL?.absoluteString ?? ""
        waiterProfileIdInput = PosCloudConfig.waiterProfileId ?? ""
        isSignedIn = PosAuthStore.shared.isSignedIn
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"
        applyBrandAccent(fromHex: PosHubState.shared.brandAccentHex)
        syncWaiterCapsToHub()
        outboxPending = PosHandheldOutbox.shared.pendingCount
        restorePersistedHubDisconnectedAtIfNeeded()
    }

    private func restorePersistedHubDisconnectedAtIfNeeded() {
        guard role == .handheld,
              PosEnrollmentStore.shared.isHandheldPaired,
              let t = UserDefaults.standard.object(forKey: hubDisconnectedAtKey) as? Double
        else { return }
        hubDisconnectedAt = Date(timeIntervalSince1970: t)
    }

    private func setHubDisconnectedAt(_ date: Date?) {
        hubDisconnectedAt = date
        if let date {
            UserDefaults.standard.set(date.timeIntervalSince1970, forKey: hubDisconnectedAtKey)
        } else {
            UserDefaults.standard.removeObject(forKey: hubDisconnectedAtKey)
        }
    }

    func start() async {
        PosCloudConfig.applyEnvironmentDefaultsIfNeeded()
        phase = .starting
        switch role {
        case .hub:
            if PosEnrollmentStore.shared.isHubEnrolled {
                // Lokal starten auch ohne Cloud-Login (Demo/Cache); Cloud-Pull wenn Session/Device-Token da.
                await startHub()
            } else {
                phase = .needsLogin
                statusMessage = "Kasse einrichten."
            }
        case .handheld:
            HandheldHubClient.configureTLSPin(
                fingerprintHex: PosEnrollmentStore.shared.handheldTlsFingerprint
            )
            if PosEnrollmentStore.shared.isHandheldPaired {
                restoreHandheldSnapshotCacheIfNeeded()
                await tryReconnectHubKeepingPairing()
            } else if PosSecurityPolicy.allowsSoloMode, PosEnrollmentStore.shared.isHandheldCloudReady {
                await startHandheldSolo(preferCloud: true)
            } else if PosEnrollmentStore.shared.isHandheldCloudReady {
                phase = .needsLogin
                statusMessage = "iPad-Kasse koppeln — Hub ist Pflicht."
            } else {
                phase = .needsLogin
                statusMessage = "Handgerät einrichten."
            }
        }
    }

    /// Wizard: Standort gewählt → Bootstrap + Hub-Server.
    func completeHubOnboarding(restaurantName: String) async {
        PosCloudConfig.applyEnvironmentDefaultsIfNeeded()
        isSignedIn = PosAuthStore.shared.isSignedIn
        await startHub()
        PosEnrollmentStore.shared.markHubEnrolled(restaurantName: restaurantName)
        statusMessage = "Kasse eingerichtet (\(restaurantName))."
    }

    /// Nach Cloud-Onboarding: Ready-Flag. Solo nur DEBUG — produktiv folgt Hub-Pairing.
    func finishHandheldCloudOnboarding() async {
        guard role == .handheld else { return }
        let name = PosEnrollmentStore.shared.restaurantDisplayName
        PosEnrollmentStore.shared.markHandheldCloudReady(
            restaurantName: name.isEmpty ? "Restaurant" : name
        )
        guard PosSecurityPolicy.allowsSoloMode else {
            statusMessage = "Jetzt iPad-Kasse koppeln."
            return
        }
        await startHandheldSolo(preferCloud: true)
        statusMessage = "Bereit — Tisch antippen zum Bestellen."
    }

    /// Einrichtungs-Code akzeptiert: Bootstrap in den Cache, Wizard bleibt bis „Zu den Tischen“.
    func preloadHandheldCloudAfterEnroll(restaurantName: String) async {
        guard role == .handheld else { return }
        PosEnrollmentStore.shared.setRestaurantDisplayName(restaurantName)
        PosCloudConfig.setNestClientFallbackEnabled(true)
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        _ = await pullCloudBootstrap(forceDemoFallback: true)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo ? "Solo · Demo/Cache" : "Solo · Cloud"
        statusMessage = "Speisekarte geladen — weiter tippen."
    }

    /// iPhone ohne iPad: lokale Demo-/Cloud-Daten, Kellner-Tabs bleiben.
    /// Produktiv gesperrt — nur `PosSecurityPolicy.allowsSoloMode` (DEBUG).
    func startHandheldSolo(preferCloud: Bool = false) async {
        guard role == .handheld else { return }
        guard PosSecurityPolicy.allowsSoloMode else {
            statusMessage = "Solo ohne Kasse ist in dieser Build nicht erlaubt."
            phase = .needsLogin
            return
        }
        phase = .starting
        isSoloMode = true
        hubBaseURL = nil
        PosCloudConfig.setNestClientFallbackEnabled(true)
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        isSignedIn = PosAuthStore.shared.isSignedIn
        let wantCloud =
            preferCloud
            || isSignedIn
            || PosEnrollmentCredential.hasCredential
        var cloudNote = ""
        if wantCloud {
            cloudNote = await pullCloudBootstrap(forceDemoFallback: true)
        } else {
            PosHubState.shared.loadCachedOrDemo()
        }
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo ? "Solo · Demo/Cache" : "Solo · Cloud"
        phase = .connected
        let menuCount = PosHubState.shared.menu?.items.count ?? 0
        let tableCount = snapshot?.floor.tables.count ?? 0
        if cloudNote.isEmpty {
            statusMessage = wantCloud
                ? "Cloud — \(tableCount) Tische, \(menuCount) Gerichte."
                : "Solo-Modus (ohne Kasse) — Demo-Daten. Optional Code aus dem Dashboard."
        } else {
            statusMessage = cloudNote
        }
        await pullReservationsDay(PosReservationsStore.todayYmd())
        syncPending = PosSyncQueue.shared.pendingCount
    }

    /// Paired, Hub weg: Cache behalten, Banner-Modus — kein Cloud-Solo-SoT.
    private func enterHubDisconnectedCacheMode(message: String) {
        isSoloMode = true
        hubBaseURL = nil
        if hubDisconnectedAt == nil {
            setHubDisconnectedAt(Date())
        }
        if snapshot == nil {
            restoreHandheldSnapshotCacheIfNeeded()
        }
        if snapshot == nil {
            publishSnapshot(PosHubState.shared.makeSnapshot())
        }
        dataSourceLabel = "Cache · Kasse getrennt"
        phase = .connected
        statusMessage = message
        refreshOutboxPending()
        startHubReconnectLoopIfNeeded()
    }

    /// Lädt letzten Hub-Snapshot + Open-Lines vom Disk (App-Kill / Reconnect-Fail).
    private func restoreHandheldSnapshotCacheIfNeeded() {
        PosHubState.shared.reloadPersistedOpenLines()
        guard snapshot == nil, let cached = PosHandheldSnapshotCache.load() else { return }
        publishSnapshot(cached, persistHandheldCache: false)
        dataSourceLabel = "Cache · Hub"
    }

    /// Erzwingt Bootstrap + heutigen Reservierungstag neu (nach Login / wenn Web gerade startet).
    func reloadCloudData() async {
        saveConfigFromInputs()
        if let userId = PosAuthStore.shared.pinSession?.staffId {
            await resolveRestaurantIdIfNeeded(userId: userId)
        }
        let note = await pullCloudBootstrap(forceDemoFallback: true)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo
            ? (role == .handheld ? "Solo · Demo/Cache" : "Demo/Cache")
            : (role == .handheld ? "Solo · Cloud" : "Cloud-Cache")
        await pullReservationsDay(PosReservationsStore.todayYmd())
        let resCount = PosReservationsStore.shared.cachedDay(PosReservationsStore.todayYmd())?.reservations.count ?? 0
        if note.contains("geladen") {
            statusMessage = "\(note) · \(resCount) Res. heute."
        } else if !note.isEmpty {
            statusMessage = note
        }
    }

    private func resolveRestaurantIdIfNeeded(userId: String) async {
        let current = PosCloudConfig.restaurantId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let deviceRestaurantId = PosAuthStore.shared.device?.restaurantId
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !deviceRestaurantId.isEmpty, deviceRestaurantId != current else {
            if current.isEmpty {
                statusMessage = "Restaurant-ID fehlt — Gerät erneut einrichten."
            }
            return
        }
        restaurantIdInput = deviceRestaurantId
        PosCloudConfig.setRestaurantId(deviceRestaurantId)
        statusMessage = "Restaurant-ID vom Gerät: \(deviceRestaurantId.prefix(8))…"
    }


    private func applyBrandAccent(fromHex raw: String?) {
        // POS nutzt feste Gwada-Marke (Web `--brand-accent`), nicht Restaurant-Settings.
        brandAccentHex = PosDesign.resolveAccentHex(raw)
    }

    private func publishSnapshot(_ snap: PosLanHubSnapshot?, persistHandheldCache: Bool = true) {
        // Gleiche Hub-Revision + gleiches Hub-Gerät → kein SwiftUI-Storm.
        // hub.deviceId verhindert, dass nach Hub-Restart Version `1` einen fremden Floor schluckt.
        if let snap,
           let incoming = snap.snapshotVersion,
           let current = snapshot?.snapshotVersion,
           incoming == current,
           snap.restaurantId == snapshot?.restaurantId,
           snap.hub.deviceId == snapshot?.hub.deviceId
        {
            let jobs = PosHubState.shared.pendingPrintJobCount
            if jobs != pendingPrintJobs {
                pendingPrintJobs = jobs
            }
            return
        }
        snapshot = snap
        if let snap {
            applyBrandAccent(fromHex: snap.brandAccentHex)
            if persistHandheldCache, role == .handheld, PosEnrollmentStore.shared.isHandheldPaired {
                PosHandheldSnapshotCache.save(snap)
            }
        }
        pendingPrintJobs = PosHubState.shared.pendingPrintJobCount
    }

    func announce(_ message: String) {
        statusMessage = message
    }

    func noteSyncPending() {
        syncPending = PosSyncQueue.shared.pendingCount
    }

    func publishHubSnapshot() {
        publishSnapshot(PosHubState.shared.makeSnapshot())
    }

    func signOut() {
        PosAuthStore.shared.clearDevice()
        PosEnrollmentCredential.clear()
        isSignedIn = false
        isSoloMode = false
        stopHub()
        flushTask?.cancel()
        if role == .hub {
            PosEnrollmentStore.shared.resetHubEnrollment()
        } else {
            PosEnrollmentStore.shared.resetHandheldCloud()
            PosEnrollmentStore.shared.resetHandheldPairing()
            PosHandheldSnapshotCache.clear()
            PosHandheldOutbox.shared.clear()
            outboxPending = 0
            setHubDisconnectedAt(nil)
            outboxConflict = nil
            stopHubReconnectLoop()
        }
        phase = .needsLogin
        statusMessage = "Abgemeldet."
    }

    func refresh() async {
        switch role {
        case .hub:
            await pullCloudBootstrap(forceDemoFallback: false)
            publishSnapshot(PosHubState.shared.makeSnapshot())
            await pullReservationsDay(PosReservationsStore.shared.selectedDayYmd)
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = PosSyncQueue.shared.lastFlushMessage.isEmpty
                ? "Aktualisiert."
                : PosSyncQueue.shared.lastFlushMessage
        case .handheld:
            if hubBaseURL != nil, !isSoloMode {
                await connectHandheld()
                await pullReservationsDay(PosReservationsStore.shared.selectedDayYmd)
            } else if PosEnrollmentStore.shared.isHandheldPaired {
                await tryReconnectHubKeepingPairing()
                await pullReservationsDay(PosReservationsStore.shared.selectedDayYmd)
            } else if PosSecurityPolicy.allowsSoloMode {
                await startHandheldSolo(preferCloud: isSignedIn)
            } else {
                statusMessage = "iPad-Kasse koppeln — Hub ist Pflicht."
            }
        }
    }

    func selectReservationsDay(_ ymd: String) {
        PosReservationsStore.shared.selectDay(ymd)
    }

    func pullReservationsDay(_ ymd: String) async {
        switch role {
        case .hub:
            await pullReservationsDayFromCloud(ymd)
        case .handheld:
            if let base = hubBaseURL, !isSoloMode {
                do {
                    let day = try await HandheldHubClient.fetchReservationsDay(
                        baseURL: base,
                        dayYmd: ymd,
                        pairToken: PosEnrollmentStore.shared.handheldPairToken
                    )
                    PosReservationsStore.shared.applyDay(day)
                } catch {
                    if let cached = PosReservationsStore.shared.cachedDay(ymd) {
                        PosReservationsStore.shared.applyDay(cached)
                    }
                    statusMessage = "Reservierungen von Kasse nicht geladen: \(error.localizedDescription)"
                }
            } else {
                await pullReservationsDayFromCloud(ymd)
            }
        }
    }

    private func pullReservationsDayFromCloud(_ ymd: String) async {
        let canCloud = PosAuthStore.shared.isSignedIn || PosEnrollmentCredential.hasCredential
        guard canCloud else {
            statusMessage = "Reservierungen: nicht angemeldet."
            return
        }
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            statusMessage = "Reservierungen: Restaurant-ID fehlt."
            return
        }
        do {
            let day = try await PosCloudClient.fetchReservationsDay(
                restaurantId: restaurantId,
                dayYmd: ymd
            )
            PosReservationsStore.shared.applyDay(day)
            if day.reservations.isEmpty {
                statusMessage = "Keine Reservierungen am \(ymd) (TZ \(day.timezone))."
            }
        } catch {
            if let cached = PosReservationsStore.shared.cachedDay(ymd) {
                PosReservationsStore.shared.applyDay(cached)
            }
            let api = PosCloudConfig.apiBaseURL.absoluteString
            statusMessage = "Reservierungen fehlgeschlagen (\(api)): \(error.localizedDescription)"
        }
    }

    func createReservation(_ draft: PosCreateReservationPayload) async -> Bool {
        guard canWriteReservations else {
            statusMessage = "Reservierung nur mit erreichbarer Kasse."
            return false
        }

        var payload = draft
        if payload.localId.isEmpty {
            payload.localId = UUID().uuidString
        }
        if payload.restaurantId.isEmpty {
            payload.restaurantId = PosHubState.shared.restaurantId
        }

        let dayYmd = String(payload.startsAt.prefix(10))
        let optimistic = PosReservationFactory.optimistic(
            from: payload,
            day: PosReservationsStore.shared.cachedDay(dayYmd)
                ?? PosReservationsStore.shared.currentDay
        )
        PosReservationsStore.shared.upsertLocalReservation(optimistic, dayYmd: dayYmd)

        // Gekoppeltes Handgerät: nur Hub — kein Cloud-/Outbox-Fallback (Phase 4).
        if role == .handheld, !isSoloMode {
            guard let base = hubBaseURL else {
                statusMessage = "Reservierung nur mit erreichbarer Kasse."
                return false
            }
            do {
                let res = try await HandheldHubClient.createReservation(
                    baseURL: base,
                    payload: payload,
                    pairToken: PosEnrollmentStore.shared.handheldPairToken
                )
                if let reservation = res.reservation {
                    PosReservationsStore.shared.upsertLocalReservation(
                        reservation,
                        dayYmd: dayYmd,
                        replacingLocalId: payload.localId
                    )
                }
                statusMessage = res.reservationNumber > 0
                    ? "Reservierung #\(res.reservationNumber) angelegt."
                    : "Reservierung an Kasse übergeben."
                return true
            } catch {
                statusMessage = "Reservierung fehlgeschlagen: \(Self.hubOpsErrorMessage(error))"
                return false
            }
        }

        // Hub oder Solo-Handgerät: online direkt in DB, sonst Queue / lokal
        do {
            let res = try await PosCloudClient.createReservation(payload: payload)
            if let reservation = res.reservation {
                PosReservationsStore.shared.upsertLocalReservation(
                    reservation,
                    dayYmd: dayYmd,
                    replacingLocalId: payload.localId
                )
            } else {
                await pullReservationsDay(dayYmd)
            }
            statusMessage = "Reservierung #\(res.reservationNumber) gespeichert."
            return true
        } catch {
            PosSyncQueue.shared.enqueueCreateReservation(payload)
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Reservierung lokal — Sync später (\(error.localizedDescription))"
            return true
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
        if role == .handheld, !canOpenNewTableSession {
            statusMessage = "Neuer Tisch nur mit erreichbarer Kasse."
            return
        }
        if role == .handheld, let base = hubBaseURL, !isSoloMode {
            do {
                let sessionId = try await HandheldHubClient.openSession(
                    baseURL: base,
                    diningTableId: tableId,
                    coverCount: covers,
                    pairToken: PosEnrollmentStore.shared.handheldPairToken
                )
                if snapshot == nil {
                    let snap = try await HandheldHubClient.fetchSnapshot(
                        baseURL: base,
                        restaurantId: nil,
                        pairToken: PosEnrollmentStore.shared.handheldPairToken
                    )
                    publishSnapshot(snap)
                } else {
                    patchSnapshotOpenedSession(
                        tableId: tableId,
                        sessionId: sessionId,
                        covers: covers
                    )
                }
                statusMessage = "Tisch geöffnet."
            } catch {
                if PosCloudConfig.nestClientFallbackEnabled && PosCloudConfig.nestSyncEnabled {
                    await openTableViaNestFallback(tableId: tableId, covers: covers)
                } else {
                    statusMessage = error.localizedDescription
                }
            }
            return
        }

        if role == .handheld && isSoloMode {
            if PosCloudConfig.nestClientFallbackEnabled && PosCloudConfig.nestSyncEnabled {
                await openTableViaNestFallback(tableId: tableId, covers: covers)
                // Ensure local floor reflects open even if Nest flush slow
                if snapshot?.floor.openSessions.contains(where: { $0.dining_table_id == tableId }) != true {
                    _ = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: covers)
                    publishSnapshot(PosHubState.shared.makeSnapshot())
                }
            } else {
                _ = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: covers)
                publishSnapshot(PosHubState.shared.makeSnapshot())
                statusMessage = "Tisch lokal geöffnet (Solo)."
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

        var sessionId = PosHubState.shared.openLocalSession(
            diningTableId: tableId,
            coverCount: covers,
            preferredSessionId: cloudSessionId
        )

        // Online nach Offline-Open: lokale ID → Cloud-ID mappen (Floor + Queue).
        if let cloudSessionId {
            if sessionId != cloudSessionId {
                PosHubState.shared.remapSessionId(from: sessionId, to: cloudSessionId)
                sessionId = cloudSessionId
            }
            PosSessionIdMap.shared.remember(
                localSessionId: sessionId,
                cloudSessionId: cloudSessionId
            )
        }

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

    /// Handheld Nest-Fallback wenn Hub offline (Feature-Flag).
    private func openTableViaNestFallback(tableId: String, covers: Int) async {
        let localId = UUID().uuidString
        PosSyncQueue.shared.enqueueOpenSession(PosSyncOpenSessionPayload(
            restaurantId: PosCloudConfig.restaurantId ?? "",
            diningTableId: tableId,
            coverCount: covers,
            localSessionId: localId
        ))
        await PosSyncQueue.shared.flushIfPossible()
        syncPending = PosSyncQueue.shared.pendingCount
        statusMessage = "Tisch via Nest-Fallback — \(PosSyncQueue.shared.lastFlushMessage)"
        // Optimistic local floor patch on handheld snapshot if present
        if var snap = snapshot {
            let session = PosLanOpenSession(
                id: PosSessionIdMap.shared.resolve(localId),
                dining_table_id: tableId,
                cover_count: covers,
                opened_at: ISO8601DateFormatter().string(from: Date())
            )
            if !snap.floor.openSessions.contains(where: { $0.dining_table_id == tableId }) {
                snap.floor.openSessions.append(session)
                snap.floor.orderCountBySessionId[session.id] = 0
                snap.floor.sessionMetaBySessionId[session.id] = PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
                snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
                publishSnapshot(snap)
            }
        }
    }

    /// Gesamte Session umziehen (Hub lokal + Outbox; Handheld nur mit Live-Hub).
    @discardableResult
    func moveSession(sessionId: String, toTableId: String) async -> Bool {
        if role == .handheld {
            guard canMutateLiveFloor else {
                statusMessage = "Umziehen nur mit erreichbarer Kasse."
                return false
            }
            // Nest-Fallback nur DEBUG-Solo — gekoppelt: Hub-SoT, kein paralleles Cloud-Move.
            if PosSecurityPolicy.allowsSoloMode,
               isSoloMode,
               !PosEnrollmentStore.shared.isHandheldPaired,
               PosCloudConfig.nestClientFallbackEnabled,
               PosCloudConfig.nestSyncEnabled
            {
                PosSyncQueue.shared.enqueueMoveSession(PosSyncMoveSessionPayload(
                    restaurantId: PosCloudConfig.restaurantId ?? "",
                    tableSessionId: sessionId,
                    toTableId: toTableId
                ))
                await PosSyncQueue.shared.flushIfPossible()
                syncPending = PosSyncQueue.shared.pendingCount
                if var snap = snapshot,
                   let idx = snap.floor.openSessions.firstIndex(where: { $0.id == sessionId })
                {
                    let old = snap.floor.openSessions[idx]
                    snap.floor.openSessions[idx] = PosLanOpenSession(
                        id: old.id,
                        dining_table_id: toTableId,
                        cover_count: old.cover_count,
                        opened_at: old.opened_at
                    )
                    publishSnapshot(snap)
                }
                statusMessage = "Tisch umgezogen (Nest-Fallback)."
                return true
            }
            statusMessage = "Umziehen bitte an der Kasse."
            return false
        }

        let ok = PosHubState.shared.moveLocalSession(sessionId: sessionId, toTableId: toTableId)
        guard ok else {
            statusMessage = "Ziel-Tisch belegt oder Session unbekannt."
            return false
        }
        publishSnapshot(PosHubState.shared.makeSnapshot())
        PosSyncQueue.shared.enqueueMoveSession(PosSyncMoveSessionPayload(
            restaurantId: PosHubState.shared.restaurantId,
            tableSessionId: sessionId,
            toTableId: toTableId
        ))
        syncPending = PosSyncQueue.shared.pendingCount
        await PosSyncQueue.shared.flushIfPossible()
        syncPending = PosSyncQueue.shared.pendingCount
        statusMessage = "Tisch umgezogen."
        return true
    }

    func ensureLocalSession(tableId: String, covers: Int = 2) -> String {
        if let existing = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id {
            return existing
        }
        // Phase 2: offline kein neues open session.
        if isHubDisconnectedWhilePaired {
            return "pending-\(tableId)"
        }
        // Gekoppeltes Handgerät: keine lokale Ghost-Session — sendCart/openTable öffnet am Hub.
        if role == .handheld, hubBaseURL != nil, !isSoloMode {
            return "pending-\(tableId)"
        }
        let sid = PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: covers)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        return sid
    }

    /// Gästezahl anpassen — lokal im Hub/Solo-Snapshot; Cloud/LAN-PATCH folgt wenn API existiert.
    func updateCovers(sessionId: String, covers: Int) async {
        let clamped = min(50, max(1, covers))

        if role == .handheld {
            if isHubDisconnectedWhilePaired {
                patchSnapshotCoverCount(sessionId: sessionId, covers: clamped)
                return
            }
            if isSoloMode || hubBaseURL == nil {
                guard PosHubState.shared.updateCoverCount(sessionId: sessionId, count: clamped) else { return }
                publishSnapshot(PosHubState.shared.makeSnapshot())
            } else {
                patchSnapshotCoverCount(sessionId: sessionId, covers: clamped)
            }
            // TODO: LAN-Hub / Nest PATCH coverCount when endpoint exists
            return
        }

        guard PosHubState.shared.updateCoverCount(sessionId: sessionId, count: clamped) else { return }
        publishSnapshot(PosHubState.shared.makeSnapshot())
        // TODO: Cloud PATCH coverCount when PosCloudClient endpoint exists
    }

    private func patchSnapshotCoverCount(sessionId: String, covers: Int) {
        guard var snap = snapshot,
              let idx = snap.floor.openSessions.firstIndex(where: { $0.id == sessionId })
        else { return }
        let old = snap.floor.openSessions[idx]
        snap.floor.openSessions[idx] = PosLanOpenSession(
            id: old.id,
            dining_table_id: old.dining_table_id,
            cover_count: covers,
            opened_at: old.opened_at
        )
        snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
        publishSnapshot(snap)
    }

    func sendCart(tableId: String, lines: [PosCartLine]) async -> Bool {
        guard !lines.isEmpty else { return false }
        if isHubDisconnectedWhilePaired {
            return enqueueOutboxOrder(tableId: tableId, lines: lines)
        }

        // Gekoppeltes Handgerät: Order an Hub, Snapshot vom Hub behalten.
        // Nie `makeSnapshot()` lokal publishen — das überschreibt den LAN-Floor und
        // lässt `loadOpenLines` die Session (und damit die Bestellung) verlieren.
        if role == .handheld, let base = hubBaseURL, !isSoloMode {
            return await sendCartViaHub(baseURL: base, tableId: tableId, lines: lines)
        }

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
                course: line.course,
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
        let localLineIds = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: lines)
        let localOrderNumber = (snapshot?.floor.orderCountBySessionId[sessionId] ?? 0) + 1
        PosHubState.shared.routeKitchenOutput(orderNumber: localOrderNumber, cartLines: lines)
        pendingPrintJobs = PosHubState.shared.pendingPrintJobCount
        Task { await PosPrintDispatcher.shared.kick() }
        publishSnapshot(PosHubState.shared.makeSnapshot())

        do {
            let result = try await PosCloudClient.createOrder(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: items
            )
            applyCloudOrderLineMapping(
                sessionId: sessionId,
                localLineIds: localLineIds,
                cloudLines: result.lines
            )
            statusMessage = "Bestellung gesendet (\(lines.count) Positionen)."
            return true
        } catch {
            PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload.make(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                lines: lines,
                localLineIds: localLineIds
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Lokal gebucht — Sync später (\(error.localizedDescription))"
            return true
        }
    }

    private func applyCloudOrderLineMapping(
        sessionId: String,
        localLineIds: [String],
        cloudLines: [PosCloudClient.PosCloudCreateOrderResult.Line]
    ) {
        let sorted = cloudLines.sorted { $0.position < $1.position }
        var mappings: [(localLineId: String, cloudLineId: String)] = []
        for (local, cloud) in zip(localLineIds, sorted) {
            PosOrderLineIdMap.shared.remember(localLineId: local, cloudLineId: cloud.id)
            mappings.append((localLineId: local, cloudLineId: cloud.id))
        }
        if !mappings.isEmpty {
            PosHubState.shared.remapOpenLineIds(sessionId: sessionId, mappings: mappings)
        }
    }

    /// Handgerät → Hub-LAN Order; lokale Open-Lines + Hub-Snapshot für Bon/Floor.
    private func sendCartViaHub(baseURL: URL, tableId: String, lines: [PosCartLine]) async -> Bool {
        var sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
        if sessionId == nil {
            await openTable(tableId: tableId, covers: 2)
            sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
        }
        guard let sessionId else {
            statusMessage = "Tisch konnte nicht geöffnet werden."
            return false
        }

        let covers = snapshot?.floor.openSessions.first(where: { $0.id == sessionId })?.cover_count ?? 2
        let token = PosEnrollmentStore.shared.handheldPairToken
        do {
            try await HandheldHubClient.createOrder(
                baseURL: baseURL,
                diningTableId: tableId,
                coverCount: covers,
                items: lines.map {
                    (
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes.isEmpty ? nil : $0.notes,
                        course: $0.course,
                        clientLineId: $0.id
                    )
                },
                pairToken: token
            )
        } catch let HandheldHubClientError.hubRejected(_, message) {
            statusMessage = "Bestellung abgelehnt: \(message)"
            return false
        } catch {
            // Live-Hub kurz weg → Outbox, wenn Session schon bekannt.
            if PosEnrollmentStore.shared.isHandheldPaired {
                return enqueueOutboxOrder(tableId: tableId, lines: lines)
            }
            statusMessage = "Bestellung an Hub fehlgeschlagen: \(error.localizedDescription)"
            return false
        }

        // Bon-UI auf dem Handgerät: Positionen lokal unter der Hub-Session-ID halten.
        PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: lines)
        // Kein Full-Snapshot-Refetch — Floor-Meta lokal patchen (Menü bleibt).
        patchSnapshotOpenCents(sessionId: sessionId, addCents: lines.reduce(0) { $0 + $1.lineTotalCents })

        statusMessage = "Bestellung gesendet (\(lines.count) Positionen)."
        return true
    }

    /// Phase 3: Order lokal buchen + Outbox (nur bestehende Session).
    @discardableResult
    private func enqueueOutboxOrder(tableId: String, lines: [PosCartLine]) -> Bool {
        guard let sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id,
              !sessionId.hasPrefix("pending-")
        else {
            statusMessage = "Kein offener Tisch im Cache — Bestellung nicht möglich."
            return false
        }
        let covers = snapshot?.floor.openSessions.first(where: { $0.id == sessionId })?.cover_count ?? 2
        let payload = PosHandheldOutbox.CreateOrderPayload.make(
            diningTableId: tableId,
            sessionId: sessionId,
            coverCount: covers,
            lines: lines
        )
        PosHandheldOutbox.shared.enqueueCreateOrder(payload)
        PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: lines)
        patchSnapshotOpenCents(sessionId: sessionId, addCents: lines.reduce(0) { $0 + $1.lineTotalCents })
        refreshOutboxPending()
        let n = outboxPending
        statusMessage = n == 1
            ? "Bestellung lokal — wird gesendet, sobald die Kasse da ist."
            : "Bestellung lokal — \(n) ausstehend für die Kasse."
        return true
    }

    func refreshOutboxPending() {
        outboxPending = PosHandheldOutbox.shared.pendingCount
    }

    /// Manuell / nach Reconnect: Outbox → Hub.
    @discardableResult
    func flushHandheldOutbox() async -> Bool {
        guard role == .handheld, let base = hubBaseURL, !isSoloMode else {
            statusMessage = "Keine Kasse — Ausstehende bleiben gespeichert."
            return false
        }
        let token = PosEnrollmentStore.shared.handheldPairToken
        let outcome = await PosHandheldOutbox.shared.flushIfPossible(
            baseURL: base,
            pairToken: token
        ) { [weak self] _, message, payload in
            Task { @MainActor in
                self?.handleOutboxHardReject(message: message, payload: payload)
            }
        }
        refreshOutboxPending()
        switch outcome {
        case .flushed(let n):
            statusMessage = n == 1
                ? "1 ausstehende Bestellung an die Kasse gesendet."
                : "\(n) ausstehende Bestellungen an die Kasse gesendet."
            if let snap = try? await HandheldHubClient.fetchSnapshot(
                baseURL: base,
                restaurantId: nil,
                pairToken: token
            ) {
                publishSnapshot(snap)
            }
            return true
        case .hardReject(_, let error):
            statusMessage = "Konflikt beim Sync: \(error)"
            return false
        case .softFail(let error):
            statusMessage = "Sync pausiert: \(error)"
            return false
        case .empty:
            return true
        case .noHub:
            return false
        }
    }

    private func handleOutboxHardReject(
        message: String,
        payload: PosHandheldOutbox.CreateOrderPayload
    ) {
        let lineIds = Set(payload.items.map(\.clientLineId))
        PosHubState.shared.removeLocalOpenLines(sessionId: payload.sessionId, lineIds: lineIds)
        let tableLabel = snapshot?.floor.tables.first(where: { $0.id == payload.diningTableId })?.label
        outboxConflict = OutboxConflictPresentation.fromHardReject(
            message: message,
            payload: payload,
            tableLabel: tableLabel
        )
        Task { @MainActor in
            if let base = hubBaseURL {
                if let snap = try? await HandheldHubClient.fetchSnapshot(
                    baseURL: base,
                    restaurantId: nil,
                    pairToken: PosEnrollmentStore.shared.handheldPairToken
                ) {
                    publishSnapshot(snap)
                }
            } else {
                restoreHandheldSnapshotCacheIfNeeded()
            }
            refreshOutboxPending()
            statusMessage = "Bestellung abgelehnt — bitte Konflikt prüfen."
        }
    }

    func dismissOutboxConflict() {
        outboxConflict = nil
    }

    /// Phase 6: Banner / Mehr / Gerät — Pairing bleibt, Bonjour inklusive.
    func reconnectToHub() async {
        guard role == .handheld, PosEnrollmentStore.shared.isHandheldPaired else { return }
        await tryReconnectHubKeepingPairing()
    }

    private func patchSnapshotOpenedSession(tableId: String, sessionId: String, covers: Int) {
        guard var snap = snapshot else { return }
        if snap.floor.openSessions.contains(where: { $0.id == sessionId || $0.dining_table_id == tableId }) {
            // Session schon bekannt — nur Revision anheben, falls nötig.
            snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
            publishSnapshot(snap)
            return
        }
        let session = PosLanOpenSession(
            id: sessionId,
            dining_table_id: tableId,
            cover_count: max(1, covers),
            opened_at: ISO8601DateFormatter().string(from: Date())
        )
        snap.floor.openSessions.append(session)
        snap.floor.orderCountBySessionId[sessionId] = 0
        snap.floor.sessionMetaBySessionId[sessionId] = PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
        snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
        publishSnapshot(snap)
    }

    private func patchSnapshotOpenCents(sessionId: String, addCents: Int) {
        guard var snap = snapshot else { return }
        var meta = snap.floor.sessionMetaBySessionId[sessionId]
            ?? PosLanSessionFloorMeta(orderCount: 0, openCents: 0)
        meta.openCents += addCents
        meta.orderCount += 1
        snap.floor.sessionMetaBySessionId[sessionId] = meta
        snap.floor.orderCountBySessionId[sessionId] = (snap.floor.orderCountBySessionId[sessionId] ?? 0) + 1
        snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
        publishSnapshot(snap)
    }

    func loadOpenLines(tableId: String) async -> [SessionOpenLine] {
        guard let sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id else {
            return []
        }
        let local = PosHubState.shared.localOpenLines(sessionId: sessionId)

        // Phase 2: Hub getrennt → nur lokaler Cache (kein Cloud-Summary als SoT).
        if isHubDisconnectedWhilePaired {
            return local
        }

        // Demo-/DEBUG-Hub ohne Cloud-Login: lokale gesendete Positionen behalten.
        guard PosAuthStore.shared.isSignedIn else {
            return local
        }

        let restaurantId = PosHubState.shared.restaurantId
        do {
            let lines = try await PosCloudClient.fetchSessionSummary(
                restaurantId: restaurantId,
                sessionId: sessionId
            )
            let remote = lines.compactMap { line -> SessionOpenLine? in
                guard line.openQuantity > 0 else { return nil }
                var detailParts: [String] = []
                detailParts.append(PosCourse.label(line.course ?? PosCourse.default))
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
                    course: line.course ?? PosCourse.default,
                    firedAt: line.firedAt,
                    detail: detailParts.joined(separator: " · "),
                    menuItemId: nil
                )
            }
            // Cloud leer, lokal noch da (Sync-Delay / Offline-Buchung) → lokal zeigen.
            return remote.isEmpty && !local.isEmpty ? local : remote
        } catch {
            statusMessage = "Offene Positionen: \(error.localizedDescription)"
            return local
        }
    }

    @discardableResult
    func collectSplit(
        sessionId: String,
        lines: [SessionOpenLine],
        method: PosPaymentMethodKind,
        tipCents: Int,
        receivedAmountCents: Int? = nil,
        giftVoucherId: String? = nil,
        customPaymentMethodId: String? = nil,
        receiptLabel: String? = nil
    ) async -> PosLocalReceipt? {
        guard !lines.isEmpty else {
            statusMessage = "Keine Positionen gewählt."
            return nil
        }
        guard !sessionId.hasPrefix("pending-") else {
            statusMessage = "Tisch noch nicht geöffnet."
            return nil
        }
        if !PosSecurityPolicy.allowsUnsignedLocalCollect, !PosAuthStore.shared.isSignedIn {
            statusMessage = "Zahlung: bitte mit PIN anmelden."
            return nil
        }
        guard canCollectAtRegister else {
            statusMessage = "Kassieren nur mit erreichbarer Kasse."
            return nil
        }

        let lineIds = Set(lines.map(\.id))
        switch PosHubState.shared.validateCollectLines(sessionId: sessionId, lineIds: lineIds) {
        case .unknownLines:
            statusMessage = "Zahlung abgebrochen — Positionen unbekannt oder bereits kassiert."
            return nil
        case .noOpenLines:
            statusMessage = "Keine offenen Positionen mehr."
            return nil
        case .ok:
            break
        }

        // Gekoppeltes Handgerät: Hub Pflicht — nur Bar über LAN settle (Review A).
        if role == .handheld, PosEnrollmentStore.shared.isHandheldPaired, !isSoloMode {
            if method == .voucher || method == .other {
                statusMessage = "Diese Zahlart nur an der Kasse."
                return nil
            }
            if method == .card || method == .paypal {
                statusMessage = "Karte/PayPal folgt — bitte Bar oder an der Kasse."
                return nil
            }
            guard method == .cash else {
                statusMessage = "Kassieren an der Kasse nur Bar."
                return nil
            }
            guard let base = hubBaseURL else {
                statusMessage = "Kassieren nur mit erreichbarer Kasse."
                return nil
            }
            let token = PosEnrollmentStore.shared.handheldPairToken
            let attemptId = UUID().uuidString
            do {
                try await HandheldHubClient.collect(
                    baseURL: base,
                    sessionId: sessionId,
                    lineIds: Array(lineIds),
                    method: method.rawValue,
                    tipCents: tipCents,
                    receivedAmountCents: receivedAmountCents,
                    paymentAttemptId: attemptId,
                    pairToken: token
                )
            } catch {
                statusMessage = "Zahlung an Kasse fehlgeschlagen: \(Self.hubOpsErrorMessage(error))"
                return nil
            }

            let tableMeta = tableMetaForSession(sessionId)
            let waiterName = PosAuthStore.shared.pinSession?.staffName
                ?? PosCloudConfig.waiterProfileId
                ?? "Service"
            let receipt = PosOfflineCaches.makeReceipt(
                sessionId: sessionId,
                tableLabel: tableMeta.label,
                diningTableId: tableMeta.tableId,
                lines: lines,
                method: method,
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents,
                label: receiptLabel,
                waiterName: waiterName
            )
            PosOfflineCaches.appendReceipt(receipt)
            // Hub hat Zeilen bereits removed — lokal spiegeln + Beleg nicht ewig fiscalPending.
            _ = PosHubState.shared.collectLocalLines(sessionId: sessionId, lineIds: lineIds)
            PosOfflineCaches.markReceiptSynced(localId: receipt.localId, paymentId: attemptId)
            if let snap = try? await HandheldHubClient.fetchSnapshot(
                baseURL: base,
                restaurantId: nil,
                pairToken: token
            ) {
                publishSnapshot(snap)
            }
            let paidCents = lines.reduce(0) { $0 + $1.openCents }
            let tipNote = tipCents > 0 ? " inkl. \(PosMoney.format(tipCents)) Tip" : ""
            statusMessage =
                "Beleg #\(receipt.orderNumber) · \(method.label) · \(PosMoney.format(paidCents + tipCents))\(tipNote)"
            PosAuditLog.shared.record(
                "payment.local",
                detail: "\(method.rawValue):\(paidCents)",
                sessionId: sessionId
            )
            return receipt
        }

        let tableMeta = tableMetaForSession(sessionId)
        let waiterName = PosAuthStore.shared.pinSession?.staffName
            ?? PosCloudConfig.waiterProfileId
            ?? "Service"
        let receipt = PosOfflineCaches.makeReceipt(
            sessionId: sessionId,
            tableLabel: tableMeta.label,
            diningTableId: tableMeta.tableId,
            lines: lines,
            method: method,
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents,
            label: receiptLabel,
            waiterName: waiterName
        )
        PosOfflineCaches.appendReceipt(receipt)

        let paidCents = PosHubState.shared.collectLocalLines(sessionId: sessionId, lineIds: lineIds)
        if shouldPublishLocalHubFloor {
            publishSnapshot(PosHubState.shared.makeSnapshot())
        } else if let base = hubBaseURL {
            let token = PosEnrollmentStore.shared.handheldPairToken
            if let snap = try? await HandheldHubClient.fetchSnapshot(
                baseURL: base,
                restaurantId: nil,
                pairToken: token
            ) {
                publishSnapshot(snap)
            }
        }

        PosAuditLog.shared.record(
            "payment.local",
            detail: "\(method.rawValue):\(paidCents)",
            sessionId: sessionId
        )

        let tipNote = tipCents > 0 ? " inkl. \(PosMoney.format(tipCents)) Tip" : ""

        // Ohne Cloud-Login: Demo fertig; Bar trotzdem queueen falls später Login.
        if !PosAuthStore.shared.isSignedIn {
            if method == .cash {
                enqueueLocalCollectForSync(
                    receipt: receipt,
                    sessionId: sessionId,
                    lines: lines,
                    tipCents: tipCents,
                    receivedAmountCents: receivedAmountCents,
                    method: method,
                    paidCents: paidCents
                )
            }
            statusMessage =
                "Beleg #\(receipt.orderNumber) · \(method.label) · \(PosMoney.format(paidCents + tipCents))\(tipNote)"
            return receipt
        }

        let restaurantId = PosHubState.shared.restaurantId
        let allocations = lines.map {
            (PosOrderLineIdMap.shared.resolve($0.orderLineId), $0.openQuantity)
        }

        if method == .voucher {
            guard let giftVoucherId, !giftVoucherId.isEmpty else {
                statusMessage = "Gutschein fehlt — bitte scannen oder Code eingeben."
                return receipt
            }
            guard PosNetworkMonitor.shared.canCollectPayment else {
                statusMessage = "Beleg #\(receipt.orderNumber) lokal — Gutschein braucht Netz."
                return receipt
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
                PosOfflineCaches.markReceiptSynced(
                    localId: receipt.localId,
                    paymentId: giftVoucherId
                )
                await pullCloudBootstrap(forceDemoFallback: false)
                if role == .hub || isSoloMode || hubBaseURL == nil {
                    publishSnapshot(PosHubState.shared.makeSnapshot())
                }
            } catch {
                statusMessage = "Gutschein-Zahlung fehlgeschlagen — \(error.localizedDescription)"
            }
            return receipt
        }

        if method == .other {
            guard let customPaymentMethodId, !customPaymentMethodId.isEmpty else {
                statusMessage = "Zahlungsart fehlt."
                return receipt
            }
            guard PosNetworkMonitor.shared.canCollectPayment else {
                statusMessage = "Beleg #\(receipt.orderNumber) lokal — Sync wenn online."
                return receipt
            }
            do {
                try await PosCloudClient.collectCustomMethod(
                    restaurantId: restaurantId,
                    tableSessionId: sessionId,
                    paymentMethodId: customPaymentMethodId,
                    allocations: allocations,
                    tipCents: tipCents
                )
                PosOfflineCaches.markReceiptSynced(
                    localId: receipt.localId,
                    paymentId: customPaymentMethodId
                )
                statusMessage = "Teilzahlung kassiert · Beleg #\(receipt.orderNumber)."
                await pullCloudBootstrap(forceDemoFallback: false)
                if role == .hub || isSoloMode || hubBaseURL == nil {
                    publishSnapshot(PosHubState.shared.makeSnapshot())
                }
            } catch {
                statusMessage = "Zahlung fehlgeschlagen — \(error.localizedDescription)"
            }
            return receipt
        }

        if method == .card || method == .paypal {
            enqueueLocalCollectForSync(
                receipt: receipt,
                sessionId: sessionId,
                lines: lines,
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents,
                method: method,
                paidCents: paidCents
            )
            syncPending = PosSyncQueue.shared.pendingCount
            if PosNetworkMonitor.shared.canCollectPayment {
                let n = await PosSyncQueue.shared.flushIfPossible()
                syncPending = PosSyncQueue.shared.pendingCount
                if n > 0 {
                    statusMessage = method == .paypal ? "PayPal gebucht." : "Karte gebucht."
                    await pullCloudBootstrap(forceDemoFallback: false)
                    if role == .hub || isSoloMode || hubBaseURL == nil {
                        publishSnapshot(PosHubState.shared.makeSnapshot())
                    }
                } else {
                    statusMessage =
                        "Beleg #\(receipt.orderNumber) · \(method.label) — Sync \(PosSyncQueue.shared.lastFlushMessage)"
                }
            } else {
                statusMessage = "Beleg #\(receipt.orderNumber) lokal — Cloud-Sync wenn online."
            }
            return receipt
        }

        guard method == .cash else {
            statusMessage = "Beleg #\(receipt.orderNumber) lokal."
            return receipt
        }

        enqueueLocalCollectForSync(
            receipt: receipt,
            sessionId: sessionId,
            lines: lines,
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents,
            method: .cash,
            paidCents: paidCents
        )
        syncPending = PosSyncQueue.shared.pendingCount

        if PosNetworkMonitor.shared.canCollectPayment {
            let n = await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
            if n > 0 {
                statusMessage = "Teilzahlung kassiert · Beleg #\(receipt.orderNumber)."
                await pullCloudBootstrap(forceDemoFallback: false)
                if role == .hub || isSoloMode || hubBaseURL == nil {
                    publishSnapshot(PosHubState.shared.makeSnapshot())
                }
                PosAuditLog.shared.record("payment.cash", detail: "ok", sessionId: sessionId)
            } else {
                statusMessage = "Beleg #\(receipt.orderNumber) · Sync später"
                PosAuditLog.shared.record(
                    "payment.cash_queued",
                    detail: PosSyncQueue.shared.lastFlushMessage,
                    sessionId: sessionId
                )
            }
        } else {
            statusMessage = "Beleg #\(receipt.orderNumber) lokal — Cloud-Sync wenn online."
            PosAuditLog.shared.record("payment.cash_queued", detail: "offline", sessionId: sessionId)
        }
        return receipt
    }

    private func enqueueLocalCollectForSync(
        receipt: PosLocalReceipt,
        sessionId: String,
        lines: [SessionOpenLine],
        tipCents: Int,
        receivedAmountCents: Int?,
        method: PosPaymentMethodKind,
        paidCents: Int
    ) {
        let attemptId = UUID().uuidString
        PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
            restaurantId: PosHubState.shared.restaurantId,
            tableSessionId: sessionId,
            allocations: lines.map {
                PosSyncCashAllocation(
                    orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                    quantity: $0.openQuantity
                )
            },
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents,
            paymentAttemptId: attemptId,
            receiptLocalId: receipt.localId,
            method: method.rawValue,
            amountCents: paidCents
        ))
        syncPending = PosSyncQueue.shared.pendingCount
    }

    private func tableMetaForSession(_ sessionId: String) -> (label: String, tableId: String) {
        if let session = snapshot?.floor.openSessions.first(where: { $0.id == sessionId }),
           let table = snapshot?.floor.tables.first(where: { $0.id == session.dining_table_id })
        {
            return (table.label, table.id)
        }
        return ("Tisch", "")
    }

    /// Gang an Küche feuern (Nest Outbox + lokaler KDS/Druck).
    @discardableResult
    func fireCourse(sessionId: String, course: Int) async -> Bool {
        guard !sessionId.hasPrefix("pending-") else {
            statusMessage = "Tisch noch nicht geöffnet."
            return false
        }
        if role == .handheld, PosEnrollmentStore.shared.isHandheldPaired {
            guard canMutateLiveFloor else {
                statusMessage = "Feuern nur mit erreichbarer Kasse."
                return false
            }
        }
        let restaurantId = PosHubState.shared.restaurantId
        PosHubState.shared.markFired(sessionId: sessionId, course: course)
        PosHubState.shared.markLocalCourseFired(sessionId: sessionId, course: course)
        if shouldPublishLocalHubFloor {
            PosSyncQueue.shared.enqueueFireCourse(PosSyncFireCoursePayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                course: course,
                fireAttemptId: UUID().uuidString
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
        }
        Task { await PosPrintDispatcher.shared.kick() }
        PosAuditLog.shared.record("course.fired", detail: "\(course)", sessionId: sessionId)
        statusMessage = "Gang „\(PosCourse.label(course))“ gefeuert."
        if shouldPublishLocalHubFloor {
            publishSnapshot(PosHubState.shared.makeSnapshot())
        } else if let base = hubBaseURL {
            if let snap = try? await HandheldHubClient.fetchSnapshot(
                baseURL: base,
                restaurantId: nil,
                pairToken: PosEnrollmentStore.shared.handheldPairToken
            ) {
                publishSnapshot(snap)
            }
        }
        return true
    }

    /// Tisch freigeben (nach bezahlt) oder Abbruch nur vor erstem Fire.
    @discardableResult
    func releaseTable(sessionId: String, forceAbort: Bool = false) async -> Bool {
        if forceAbort, PosHubState.shared.hasFired(sessionId: sessionId) {
            statusMessage = "Abbruch nur vor erstem Küchen-Fire."
            PosAuditLog.shared.record("session.abort_blocked", detail: "already_fired", sessionId: sessionId)
            return false
        }
        if role == .handheld, PosEnrollmentStore.shared.isHandheldPaired {
            guard canMutateLiveFloor else {
                statusMessage = "Freigeben nur mit erreichbarer Kasse."
                return false
            }
            // Kein makeSnapshot — LAN-Floor nicht mit lokalem Bootstrap überschreiben.
            _ = PosHubState.shared.releaseLocalSession(sessionId: sessionId)
            removeSessionFromHandheldSnapshot(sessionId)
            if let base = hubBaseURL,
               let snap = try? await HandheldHubClient.fetchSnapshot(
                   baseURL: base,
                   restaurantId: nil,
                   pairToken: PosEnrollmentStore.shared.handheldPairToken
               )
            {
                publishSnapshot(snap)
            }
            PosAuditLog.shared.record(
                forceAbort ? "session.aborted" : "session.released",
                detail: forceAbort ? "abort_handheld" : "release_handheld",
                sessionId: sessionId
            )
            statusMessage = forceAbort
                ? "Tisch abgebrochen (lokal)."
                : "Tisch freigegeben — bitte an der Kasse prüfen."
            return true
        }

        let ok = PosHubState.shared.releaseLocalSession(sessionId: sessionId)
        guard ok else {
            statusMessage = "Session nicht gefunden."
            return false
        }
        publishSnapshot(PosHubState.shared.makeSnapshot())
        PosSyncQueue.shared.enqueueReleaseSession(PosSyncReleaseSessionPayload(
            restaurantId: PosHubState.shared.restaurantId,
            tableSessionId: sessionId
        ))
        syncPending = PosSyncQueue.shared.pendingCount
        await PosSyncQueue.shared.flushIfPossible()
        syncPending = PosSyncQueue.shared.pendingCount
        PosAuditLog.shared.record(
            forceAbort ? "session.aborted" : "session.released",
            detail: forceAbort ? "abort" : "release",
            sessionId: sessionId
        )
        statusMessage = forceAbort ? "Tisch abgebrochen." : "Tisch freigegeben."
        return true
    }

    private func removeSessionFromHandheldSnapshot(_ sessionId: String) {
        guard var snap = snapshot else { return }
        snap.floor.openSessions.removeAll { $0.id == sessionId }
        snap.floor.orderCountBySessionId[sessionId] = nil
        snap.floor.sessionMetaBySessionId[sessionId] = nil
        snap.snapshotVersion = (snap.snapshotVersion ?? 0) + 1
        publishSnapshot(snap)
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

    private func saveConfigFromInputs() {
        if !apiBaseInput.isEmpty { PosCloudConfig.setApiBaseURL(apiBaseInput) }
        if !supabaseUrlInput.isEmpty { PosCloudConfig.setSupabaseURL(supabaseUrlInput) }
        if !supabaseAnonInput.isEmpty { PosCloudConfig.setSupabaseAnonKey(supabaseAnonInput) }
        if !restaurantIdInput.isEmpty { PosCloudConfig.setRestaurantId(restaurantIdInput) }
        PosCloudConfig.setNestApiBaseURL(nestApiBaseInput)
        PosCloudConfig.setWaiterProfileId(waiterProfileIdInput)
    }

    func saveNestSettingsFromInputs() {
        PosCloudConfig.setNestApiBaseURL(nestApiBaseInput)
        PosCloudConfig.setWaiterProfileId(waiterProfileIdInput)
        statusMessage = PosCloudConfig.nestSyncEnabled
            ? "Nest-Sync aktiv (\(PosCloudConfig.nestApiBaseURL?.host ?? "…"))."
            : "Nest-URL leer — Sync über Next `/api/pos`."
    }

    private func syncWaiterCapsToHub() {
        PosHubState.shared.setWaiterCaps(PosWaiterPinCache.shared.capsByProfileId())
    }

    private func startHub() async {
        stopHub()
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)

        let tlsIdentity: SecIdentity
        do {
            tlsIdentity = try PosHubTLSIdentity.loadOrCreate()
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "TLS-Identität fehlgeschlagen: \(error.localizedDescription)"
            return
        }
        let tlsFingerprint = PosHubTLSIdentity.certificateFingerprintSHA256Hex(identity: tlsIdentity)

        PosPairingStore.shared.configureHubInfo(
            PosLanHubInfo(
                deviceId: hubDeviceId,
                displayName: PosHubState.shared.restaurantName,
                role: "hub",
                tlsFingerprint: tlsFingerprint
            )
        )
        PosHubState.shared.loadCachedOrDemo()

        isSignedIn = PosAuthStore.shared.isSignedIn
        await pullCloudBootstrap(forceDemoFallback: true)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"
        await pullReservationsDay(PosReservationsStore.todayYmd())

        let server = HubHTTPServer(tlsIdentity: tlsIdentity) { method, path, headers, body in
            Self.handleHubRequest(method: method, path: path, headers: headers, body: body)
        }

        do {
            try server.start()
            httpServer = server
            let name = PosLanProtocol.bonjourName(restaurantName: PosHubState.shared.restaurantName)
            advertiser.publish(
                name: name,
                port: Int(PosLanProtocol.hubPort),
                restaurantId: PosHubState.shared.restaurantId,
                tlsFingerprint: tlsFingerprint
            )
            bonjourPublishing = true
            phase = .hubReady
            if !isSignedIn {
                statusMessage = "Kasse läuft lokal (TLS). Anmelden für Cloud-Pull & Sync."
            } else {
                statusMessage = PosHubState.shared.isDemo
                    ? "Kasse läuft (Cache, TLS). Cloud-Refresh fehlgeschlagen?"
                    : "Kasse läuft (TLS) — lokale Daten bereit, Sync-Queue aktiv."
            }
            startPeriodicFlush()
            wireNetworkFlush()
            await PosSyncQueue.shared.flushIfPossible()
            syncPending = PosSyncQueue.shared.pendingCount
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "Server-Start fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func wireNetworkFlush() {
        PosNetworkMonitor.shared.onBecameOnline = { [weak self] in
            Task { @MainActor in
                let n = await PosSyncQueue.shared.flushIfPossible()
                self?.syncPending = PosSyncQueue.shared.pendingCount
                if n > 0 {
                    self?.statusMessage = PosSyncQueue.shared.lastFlushMessage
                }
            }
        }
    }

    private func startPeriodicFlush() {
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                let n = await PosSyncQueue.shared.flushIfPossible()
                await MainActor.run {
                    self?.syncPending = PosSyncQueue.shared.pendingCount
                    // Phase 5: Status nur bei Fortschritt — kein 20s-Churn.
                    if n > 0 {
                        self?.statusMessage = PosSyncQueue.shared.lastFlushMessage
                    }
                }
            }
        }
    }

    private func pullCloudBootstrap(forceDemoFallback: Bool) async -> String {
        let canCloud = PosAuthStore.shared.isSignedIn || PosEnrollmentCredential.hasCredential
        guard canCloud else {
            if forceDemoFallback {
                PosHubState.shared.loadCachedOrDemo()
            }
            return ""
        }
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            let msg = "Restaurant-ID fehlt in den Einstellungen."
            statusMessage = msg
            return msg
        }
        do {
            let cachedRevision = PosHubState.shared.menuRevision
            let bootstrap = try await PosCloudClient.fetchBootstrap(
                restaurantId: restaurantId,
                menuRevision: cachedRevision
            )
            PosHubState.shared.applyBootstrap(bootstrap)
            let menuCount = PosHubState.shared.menu?.items.count ?? 0
            let unchanged = bootstrap.menuUnchanged == true
            let msg = unchanged
                ? "Cloud aktualisiert (\(bootstrap.floor.tables.count) Tische · Speisekarte Cache)."
                : "Cloud-Daten geladen (\(bootstrap.floor.tables.count) Tische, \(menuCount) Gerichte)."
            statusMessage = msg
            return msg
        } catch {
            if forceDemoFallback {
                PosHubState.shared.loadCachedOrDemo()
            }
            let api = PosCloudConfig.apiBaseURL.absoluteString
            let msg = "Bootstrap fehlgeschlagen (\(api)): \(error.localizedDescription)"
            statusMessage = msg
            return msg
        }
    }

    private func stopHub() {
        httpServer?.stop()
        httpServer = nil
        advertiser.stop()
        bonjourPublishing = false
    }

    private nonisolated static func lanPathOnly(_ pathWithQuery: String) -> String {
        pathWithQuery.split(separator: "?").first.map(String.init) ?? pathWithQuery
    }

    private nonisolated static func lanQueryValue(_ pathWithQuery: String, key: String) -> String? {
        guard let qIndex = pathWithQuery.firstIndex(of: "?") else { return nil }
        let query = pathWithQuery[pathWithQuery.index(after: qIndex)...]
        for part in query.split(separator: "&") {
            let kv = part.split(separator: "=", maxSplits: 1).map(String.init)
            guard kv.count == 2, kv[0] == key else { continue }
            return kv[1].removingPercentEncoding ?? kv[1]
        }
        return nil
    }

    private nonisolated static func handleHubRequest(
        method: String,
        path: String,
        headers: [String: String],
        body: Data
    ) -> (Int, Data) {
        if method == "OPTIONS" {
            return (204, Data())
        }

        let pathOnly = lanPathOnly(path)

        if pathOnly != PosLanProtocol.pairRefreshPath,
           PosLanAuth.requiresToken(pathOnly: pathOnly)
        {
            let token = headers[PosLanProtocol.headerPairToken.lowercased()] ?? ""
            guard PosPairingStore.shared.verify(token: token) else {
                return (401, Data(#"{"error":"unpaired"}"#.utf8))
            }
        }
        if PosLanAuth.requiresKdsLanSecret(pathOnly: pathOnly) {
            let expected = PosHubLanSecret.current()
            let got = (headers[PosLanProtocol.headerLanSecret.lowercased()] ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !got.isEmpty, got == expected else {
                return (401, Data(#"{"error":"kds_unauthorized"}"#.utf8))
            }
        }

        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        if method == "GET" {
            if pathOnly == PosLanProtocol.healthPath {
                let health = PosHubState.shared.makeHealth()
                let data = (try? encoder.encode(health)) ?? Data(#"{"ok":false}"#.utf8)
                return (200, data)
            }
            if pathOnly == PosLanProtocol.snapshotPath {
                return (200, PosHubState.shared.encodedSnapshotJSON())
            }
            if pathOnly == PosLanProtocol.reservationsPath {
                let day = lanQueryValue(path, key: "day") ?? PosReservationsStore.todayYmd()
                if let cached = PosReservationsStore.shared.cachedDay(day) {
                    let data = (try? encoder.encode(cached)) ?? Data(#"{"error":"encode"}"#.utf8)
                    return (200, data)
                }
                return (404, Data(#"{"error":"day_not_cached"}"#.utf8))
            }
            if pathOnly == PosLanProtocol.kdsPath {
                return (200, KdsHubHTML.page(lanSecret: PosHubLanSecret.current()))
            }
            if pathOnly == PosLanProtocol.kdsTicketsPath {
                let deviceId = lanQueryValue(path, key: "deviceId")
                return (200, PosHubState.shared.kdsTicketsJSON(deviceId: deviceId))
            }
            if pathOnly == PosLanProtocol.printJobsPath {
                return (200, PosHubState.shared.printJobsJSON())
            }
            if pathOnly == PosLanProtocol.pairStatusPath {
                let pairId = lanQueryValue(path, key: "pairId") ?? ""
                let status = PosPairingStore.shared.status(pairId: pairId)
                let data = (try? encoder.encode(status)) ?? Data(#"{"state":"rejected"}"#.utf8)
                return (200, data)
            }
            #if DEBUG
            if pathOnly == PosLanProtocol.pairDebugApproveAllPath {
                let n = PosPairingStore.shared.approveAllPending()
                let data = (try? JSONSerialization.data(withJSONObject: ["ok": true, "approved": n])) ?? Data()
                return (200, data)
            }
            #endif
            return (404, Data(#"{"error":"not_found"}"#.utf8))
        }

        if method == "POST" {
            if pathOnly == PosLanProtocol.reservationsPath {
                guard let payload = try? decoder.decode(PosCreateReservationPayload.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                var local = payload
                if local.localId.isEmpty { local.localId = UUID().uuidString }
                if local.restaurantId.isEmpty {
                    local.restaurantId = PosHubState.shared.restaurantId
                }
                let dayYmd = String(local.startsAt.prefix(10))
                let optimistic = PosReservationFactory.optimistic(
                    from: local,
                    day: PosReservationsStore.shared.cachedDay(dayYmd)
                        ?? PosReservationsStore.shared.currentDay
                )
                PosReservationsStore.shared.upsertLocalReservation(optimistic, dayYmd: dayYmd)
                Task { @MainActor in
                    PosSyncQueue.shared.enqueueCreateReservation(local)
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let response = PosCreateReservationResponse(
                    ok: true,
                    id: local.localId,
                    reservationNumber: 0,
                    guestPin: nil,
                    reservation: optimistic
                )
                let data = (try? encoder.encode(response)) ?? Data(#"{"ok":true}"#.utf8)
                return (200, data)
            }
            if pathOnly == PosLanProtocol.kdsAdvancePath {
                struct Req: Decodable { var orderId: String }
                guard let req = try? decoder.decode(Req.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let result = PosHubState.shared.advanceLocalTicket(orderId: req.orderId)
                let data =
                    (try? JSONSerialization.data(withJSONObject: result))
                    ?? Data(#"{"ok":false}"#.utf8)
                return (200, data)
            }
            if pathOnly == PosLanProtocol.openSessionPath {
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

            if pathOnly == PosLanProtocol.createOrderPath {
                struct Item: Decodable {
                    var menuItemId: String
                    var quantity: Int
                    var notes: String?
                    var course: Int?
                    var clientLineId: String?
                }
                struct Req: Decodable {
                    var diningTableId: String
                    var coverCount: Int?
                    var items: [Item]
                    var sessionId: String?
                    var eventId: String?
                    var requireExistingSession: Bool?
                }
                guard let req = try? decoder.decode(Req.self, from: body), !req.items.isEmpty else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                if let eventId = req.eventId?.trimmingCharacters(in: .whitespacesAndNewlines), !eventId.isEmpty {
                    if !PosHubState.shared.registerOrderEventId(eventId) {
                        let existing = PosHubState.shared.openSessionId(forDiningTableId: req.diningTableId)
                            ?? req.sessionId
                            ?? ""
                        let payload: [String: Any] = [
                            "sessionId": existing,
                            "localOrderId": eventId,
                            "ok": true,
                            "duplicate": true,
                        ]
                        let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                        return (200, data)
                    }
                }

                let requireExisting = req.requireExistingSession == true || !(req.sessionId ?? "").isEmpty
                let sessionId: String
                if requireExisting {
                    if let preferred = req.sessionId?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !preferred.isEmpty
                    {
                        guard PosHubState.shared.hasOpenSession(id: preferred, diningTableId: req.diningTableId) else {
                            return (409, Data(#"{"error":"session_gone"}"#.utf8))
                        }
                        sessionId = preferred
                    } else if let existing = PosHubState.shared.openSessionId(forDiningTableId: req.diningTableId) {
                        sessionId = existing
                    } else {
                        return (409, Data(#"{"error":"session_gone"}"#.utf8))
                    }
                } else {
                    sessionId = PosHubState.shared.openLocalSession(
                        diningTableId: req.diningTableId,
                        coverCount: req.coverCount ?? 2
                    )
                }

                let cartLines: [PosCartLine] = req.items.compactMap { item in
                    guard let menuItem = PosHubState.shared.menu?.items.first(where: { $0.id == item.menuItemId }) else {
                        return nil
                    }
                    var line = PosCartLine(
                        menuItemId: menuItem.id,
                        name: menuItem.name,
                        unitPriceCents: menuItem.priceCents,
                        quantity: item.quantity,
                        course: item.course ?? PosCourse.default,
                        notes: item.notes ?? "",
                        modifiers: []
                    )
                    if let clientLineId = item.clientLineId?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !clientLineId.isEmpty {
                        line.id = clientLineId
                    }
                    return line
                }
                guard !cartLines.isEmpty else {
                    return (400, Data(#"{"error":"unknown_menu_items"}"#.utf8))
                }

                // Additive merge: bereits vorhandene clientLineIds nicht doppelt anhängen.
                let freshLines = cartLines.filter {
                    !PosHubState.shared.containsOpenLine(sessionId: sessionId, lineId: $0.id)
                }
                if !freshLines.isEmpty {
                    let addCents = freshLines.reduce(0) { $0 + $1.lineTotalCents }
                    PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: addCents)
                    let localLineIds = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, from: freshLines)
                    let orderNumber = (PosHubState.shared.makeSnapshot().floor.orderCountBySessionId[sessionId] ?? 1)
                    PosHubState.shared.routeKitchenOutput(orderNumber: orderNumber, cartLines: freshLines)
                    Task { await PosPrintDispatcher.shared.kick() }
                    let restaurantId = PosHubState.shared.restaurantId
                    let localOrderId = Self.nonEmptyId(req.eventId) ?? UUID().uuidString
                    Task { @MainActor in
                        PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                            restaurantId: restaurantId,
                            tableSessionId: sessionId,
                            items: freshLines.map {
                                PosSyncOrderItem(
                                    menuItemId: $0.menuItemId,
                                    quantity: $0.quantity,
                                    notes: $0.notes.isEmpty ? nil : $0.notes,
                                    course: $0.course
                                )
                            },
                            localOrderId: localOrderId,
                            localLineIds: localLineIds
                        ))
                        await PosSyncQueue.shared.flushIfPossible()
                    }
                }

                let localOrderId = Self.nonEmptyId(req.eventId) ?? UUID().uuidString
                let payload: [String: Any] = [
                    "sessionId": sessionId,
                    "localOrderId": localOrderId,
                    "ok": true,
                ]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }

            if pathOnly == PosLanProtocol.collectPath {
                struct Req: Decodable {
                    var sessionId: String
                    var lineIds: [String]
                    var method: String
                    var tipCents: Int?
                    var receivedAmountCents: Int?
                    var paymentAttemptId: String?
                }
                guard let req = try? decoder.decode(Req.self, from: body), !req.lineIds.isEmpty else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                guard PosSecurityPolicy.isAllowedCollectMethod(req.method) else {
                    return (400, Data(#"{"error":"invalid_method"}"#.utf8))
                }
                // Review A: LAN settle nur Bar — kein Gutschein ohne Validierung, kein Unbar vor Provider.
                guard PosSecurityPolicy.isHubLanSettleMethod(req.method) else {
                    let code = req.method == PosPaymentMethodKind.voucher.rawValue
                        ? "voucher_not_on_lan"
                        : "method_not_settled_on_lan"
                    let body = "{\"error\":\"\(code)\"}"
                    return (400, Data(body.utf8))
                }
                if !PosSecurityPolicy.allowsHubCollectWithoutStaffSession {
                    let staffSignedIn = DispatchQueue.main.sync { PosAuthStore.shared.isSignedIn }
                    if !staffSignedIn {
                        return (403, Data(#"{"error":"staff_required"}"#.utf8))
                    }
                }
                if let attemptId = req.paymentAttemptId,
                   !PosHubState.shared.registerCollectAttemptId(attemptId)
                {
                    return (409, Data(#"{"error":"duplicate_attempt"}"#.utf8))
                }
                let lineIds = Set(req.lineIds)
                guard let settled = PosHubState.shared.settleCollectLines(
                    sessionId: req.sessionId,
                    lineIds: lineIds
                ) else {
                    // Race / bereits kassiert — nichts enqueueen.
                    switch PosHubState.shared.validateCollectLines(sessionId: req.sessionId, lineIds: lineIds) {
                    case .unknownLines:
                        return (400, Data(#"{"error":"unknown_lines"}"#.utf8))
                    case .noOpenLines:
                        return (400, Data(#"{"error":"no_open_lines"}"#.utf8))
                    case .ok:
                        return (409, Data(#"{"error":"nothing_to_collect"}"#.utf8))
                    }
                }
                let paid = settled.paidCents
                let method = req.method
                let tip = req.tipCents ?? 0
                let sessionId = req.sessionId
                let received = req.receivedAmountCents
                let attemptId = {
                    let t = req.paymentAttemptId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    return t.isEmpty ? UUID().uuidString : t
                }()
                let allocations = settled.allocations
                let amountCents = settled.amountCents
                Task { @MainActor in
                    PosAuditLog.shared.record(
                        "payment.hub_collect",
                        detail: "\(method):\(paid):tip=\(tip)",
                        sessionId: sessionId
                    )
                    PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
                        restaurantId: PosHubState.shared.restaurantId,
                        tableSessionId: sessionId,
                        allocations: allocations,
                        tipCents: tip,
                        receivedAmountCents: received,
                        paymentAttemptId: attemptId,
                        receiptLocalId: nil,
                        method: method,
                        amountCents: amountCents
                    ))
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let payload: [String: Any] = [
                    "ok": true,
                    "paidCents": paid,
                    "method": method,
                    "paymentAttemptId": attemptId,
                ]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }

            if pathOnly == PosLanProtocol.pairRequestPath {
                guard let req = try? decoder.decode(PosLanPairRequest.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let challenge = PosPairingStore.shared.createPending(req)
                let data = (try? encoder.encode(challenge)) ?? Data(#"{"error":"encode"}"#.utf8)
                return (201, data)
            }

            if pathOnly == PosLanProtocol.pairRefreshPath {
                let token = headers[PosLanProtocol.headerPairToken.lowercased()] ?? ""
                guard let refreshed = PosPairingStore.shared.refresh(token: token) else {
                    return (401, Data(#"{"error":"refresh_denied"}"#.utf8))
                }
                let data = (try? encoder.encode(refreshed)) ?? Data(#"{"error":"encode"}"#.utf8)
                return (200, data)
            }

            #if DEBUG
            if pathOnly == PosLanProtocol.pairDebugApproveAllPath {
                let n = PosPairingStore.shared.approveAllPending()
                let data = (try? JSONSerialization.data(withJSONObject: ["ok": true, "approved": n])) ?? Data()
                return (200, data)
            }
            #endif
        }

        return (405, Data(#"{"error":"method_not_allowed"}"#.utf8))
    }

    /// Versucht LAN-Hub erneut, ohne Pairing zu löschen und ohne Solo-Snapshot zu verwerfen.
    /// Phase 6: nach gespeicherten Hosts auch Bonjour-Scan (IP-Wechsel).
    private func tryReconnectHubKeepingPairing() async {
        guard role == .handheld, PosEnrollmentStore.shared.isHandheldPaired else { return }
        let previousSnap = snapshot
        phase = .searching
        statusMessage = "Suche iPad-Kasse …"
        var candidates: [URL] = []
        func appendCandidate(_ url: URL) {
            if !candidates.contains(url) { candidates.append(url) }
        }
        if let hint = Self.savedHubHostHint() {
            appendCandidate(PosLanProtocol.hubBaseURL(host: hint))
        }
        if let enrolled = PosEnrollmentStore.shared.handheldHubBaseURL,
           let url = URL(string: enrolled)
        {
            appendCandidate(url)
        }
        if let saved = UserDefaults.standard.string(forKey: manualHostKey), !saved.isEmpty {
            appendCandidate(PosLanProtocol.hubBaseURL(host: saved))
        }

        if !candidates.isEmpty,
           await tryConnectHandheldCandidates(candidates, clearPairingOn401: false) != nil
        {
            return
        }

        let discovered = await browser.scan(timeout: 4.5)
        var bonjourOnly: [URL] = []
        for hub in discovered {
            if !candidates.contains(hub.baseURL) {
                bonjourOnly.append(hub.baseURL)
                appendCandidate(hub.baseURL)
            }
        }
        if !bonjourOnly.isEmpty,
           await tryConnectHandheldCandidates(bonjourOnly, clearPairingOn401: false) != nil
        {
            return
        }

        if let previousSnap {
            publishSnapshot(previousSnap)
        }
        enterHubDisconnectedCacheMode(
            message: "Kasse getrennt — Cache aktiv. Pairing bleibt gespeichert."
        )
    }

    private func startHubReconnectLoopIfNeeded() {
        guard hubReconnectLoopTask == nil else { return }
        hubReconnectLoopTask = Task { [weak self] in
            // Erste Auto-Suche nach kurzer Pause, dann alle ~45s (Review P2-2).
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            while !Task.isCancelled {
                guard let self, !Task.isCancelled else { return }
                guard self.isHubDisconnectedWhilePaired else {
                    await MainActor.run { self.stopHubReconnectLoop() }
                    return
                }
                await self.tryReconnectHubKeepingPairing()
                if self.hubBaseURL != nil {
                    await MainActor.run { self.stopHubReconnectLoop() }
                    return
                }
                try? await Task.sleep(nanoseconds: 45_000_000_000)
            }
        }
    }

    private func stopHubReconnectLoop() {
        hubReconnectLoopTask?.cancel()
        hubReconnectLoopTask = nil
    }

    private func connectHandheld(preferredHost: String? = nil) async {
        phase = .searching
        statusMessage = "Suche iPad-Kasse im WLAN …"
        isSoloMode = false
        let previousSnap = snapshot
        publishSnapshot(nil)
        hubBaseURL = nil

        var candidates: [URL] = []
        func appendCandidate(_ url: URL) {
            if !candidates.contains(url) { candidates.append(url) }
        }
        if let preferredHost, !preferredHost.isEmpty {
            appendCandidate(PosLanProtocol.hubBaseURL(host: preferredHost))
        }
        if let enrolled = PosEnrollmentStore.shared.handheldHubBaseURL,
           let enrolledURL = URL(string: enrolled)
        {
            appendCandidate(enrolledURL)
        }
        if let saved = UserDefaults.standard.string(forKey: manualHostKey), !saved.isEmpty {
            appendCandidate(PosLanProtocol.hubBaseURL(host: saved))
        }

        // Gespeicherte Kandidaten sofort versuchen (Simulator/Bonjour oft leer), danach Discovery.
        if !candidates.isEmpty {
            if let connected = await tryConnectHandheldCandidates(candidates) {
                _ = connected
                return
            }
        }

        let discovered = await browser.scan(timeout: 4.5)
        for hub in discovered {
            appendCandidate(hub.baseURL)
        }

        guard !candidates.isEmpty else {
            if PosEnrollmentStore.shared.isHandheldPaired {
                if let previousSnap { publishSnapshot(previousSnap) }
                enterHubDisconnectedCacheMode(
                    message: "Keine Kasse gefunden — Cache aktiv. Pairing bleibt."
                )
                return
            }
            if PosSecurityPolicy.allowsSoloMode,
               PosEnrollmentStore.shared.isHandheldCloudReady || PosEnrollmentCredential.hasCredential
            {
                await startHandheldSolo(preferCloud: true)
                statusMessage = "Keine Kasse gefunden — Cloud/Cache aktiv."
                return
            }
            phase = .error("Keine Kasse gefunden")
            statusMessage =
                "Keine Kasse per WLAN gefunden. Hub-Adresse prüfen (Simulator: 127.0.0.1:8787) und „Koppeln“ tippen."
            return
        }

        if await tryConnectHandheldCandidates(candidates) != nil {
            return
        }

        if PosEnrollmentStore.shared.isHandheldPaired {
            if let previousSnap { publishSnapshot(previousSnap) }
            enterHubDisconnectedCacheMode(
                message: "Kasse nicht erreichbar — Cache aktiv. Pairing bleibt."
            )
            return
        }

        if PosSecurityPolicy.allowsSoloMode,
           PosEnrollmentStore.shared.isHandheldCloudReady || PosEnrollmentCredential.hasCredential
        {
            await startHandheldSolo(preferCloud: true)
            statusMessage = "Kasse nicht erreichbar — Cloud/Cache aktiv. Pairing bleibt."
            return
        }

        phase = .error("Kasse nicht erreichbar")
        statusMessage = "Kasse nicht erreichbar — iPad einschalten?"
    }

    /// Versucht die Kandidaten der Reihe nach; bei Erfolg `.connected`, sonst `nil`.
    @discardableResult
    private func tryConnectHandheldCandidates(
        _ candidates: [URL],
        clearPairingOn401: Bool = false
    ) async -> URL? {
        var lastError: String?
        for base in candidates {
            do {
                statusMessage = "Verbinde \(base.host ?? "") …"
                let health = try await HandheldHubClient.fetchHealth(baseURL: base)
                guard health.ok else { throw HandheldHubClientError.invalidResponse }
                let token = PosEnrollmentStore.shared.handheldPairToken
                do {
                    let snap = try await HandheldHubClient.fetchSnapshot(
                        baseURL: base,
                        restaurantId: health.restaurantId,
                        pairToken: token
                    )
                    rememberHubHost(base)
                    hubBaseURL = base
                    isSoloMode = false
                    setHubDisconnectedAt(nil)
                    stopHubReconnectLoop()
                    publishSnapshot(snap)
                    phase = .connected
                    statusMessage = "Verbunden mit \(snap.hub.displayName)."
                    await pullReservationsDay(PosReservationsStore.todayYmd())
                    if PosHandheldOutbox.shared.pendingCount > 0 {
                        _ = await flushHandheldOutbox()
                    } else {
                        refreshOutboxPending()
                    }
                    return base
                } catch HandheldHubClientError.httpStatus(401) {
                    // P2-1: kurzer Token — einmal refresh versuchen, bevor Re-Pair.
                    if let token,
                       let refreshed = try? await HandheldHubClient.refreshPairing(
                        baseURL: base,
                        pairToken: token
                       )
                    {
                        PosEnrollmentStore.shared.updatePairToken(refreshed.token)
                        if let fp = refreshed.hub?.tlsFingerprint {
                            PosEnrollmentStore.shared.markHandheldPaired(
                                token: refreshed.token,
                                hubBaseURL: base.absoluteString,
                                tlsFingerprint: fp
                            )
                            HandheldHubClient.configureTLSPin(fingerprintHex: fp)
                        }
                        if let snap = try? await HandheldHubClient.fetchSnapshot(
                            baseURL: base,
                            restaurantId: health.restaurantId,
                            pairToken: refreshed.token
                        ) {
                            rememberHubHost(base)
                            hubBaseURL = base
                            isSoloMode = false
                            setHubDisconnectedAt(nil)
                            stopHubReconnectLoop()
                            publishSnapshot(snap)
                            phase = .connected
                            statusMessage = "Verbunden mit \(snap.hub.displayName)."
                            await pullReservationsDay(PosReservationsStore.todayYmd())
                            if PosHandheldOutbox.shared.pendingCount > 0 {
                                _ = await flushHandheldOutbox()
                            } else {
                                refreshOutboxPending()
                            }
                            return base
                        }
                    }
                    if clearPairingOn401 {
                        PosEnrollmentStore.shared.resetHandheldPairing()
                        HandheldHubClient.configureTLSPin(fingerprintHex: nil)
                    }
                    await beginPairing(base: base)
                    return base
                }
            } catch {
                lastError = error.localizedDescription
            }
        }
        if let lastError {
            statusMessage = lastError
        }
        return nil
    }

    private func rememberHubHost(_ base: URL) {
        if let host = base.host {
            let port = base.port.map(String.init) ?? String(PosLanProtocol.hubPort)
            UserDefaults.standard.set("\(host):\(port)", forKey: manualHostKey)
        }
    }

    /// Zuletzt bekannte Hub-Adresse (Enrollment oder manuell) — für Auto-Reconnect ohne Bonjour.
    private static func savedHubHostHint() -> String? {
        if let enrolled = PosEnrollmentStore.shared.handheldHubBaseURL,
           let url = URL(string: enrolled),
           let host = url.host
        {
            let port = url.port.map(String.init) ?? String(PosLanProtocol.hubPort)
            return "\(host):\(port)"
        }
        if let saved = UserDefaults.standard.string(forKey: "gwada_pos_hub_host"), !saved.isEmpty {
            return saved
        }
        return nil
    }

    /// Kurze, UI-taugliche Meldung für Hub-/Netzfehler (Kassieren, Resa).
    static func hubOpsErrorMessage(_ error: Error) -> String {
        if let hub = error as? HandheldHubClientError, let desc = hub.errorDescription {
            return desc
        }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            switch ns.code {
            case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost:
                return "Kein Netzwerk — Kasse prüfen."
            case NSURLErrorTimedOut:
                return "Zeitüberschreitung — Kasse antwortet nicht."
            case NSURLErrorCannotConnectToHost, NSURLErrorDNSLookupFailed:
                return "Kasse nicht erreichbar."
            default:
                break
            }
        }
        return error.localizedDescription
    }

    func startHandheldPairing(host: String) async {
        let base = PosLanProtocol.hubBaseURL(host: host)
        await beginPairing(base: base)
    }

    /// Pairing-Gate: zuerst manuelle Hub-Adresse (z. B. `127.0.0.1:8787`), dann Bonjour.
    /// Erreichbarer Hub ohne Token → Pairing-Anfrage (Freigabe am iPad).
    func searchOrPairHandheld(manualHost: String) async {
        let trimmed = manualHost.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            UserDefaults.standard.set(trimmed, forKey: manualHostKey)
        }
        await connectHandheld(preferredHost: trimmed.isEmpty ? nil : trimmed)
    }

    func cancelHandheldPairing() {
        pairingPollTask?.cancel()
        pairingPollTask = nil
        pairingChallenge = nil
        phase = .searching
        statusMessage = ""
    }

    private func beginPairing(base: URL) async {
        do {
            let req = PosLanPairRequest(
                deviceName: PosDeviceRoleDetector.deviceKindLabel,
                installationId: PosDeviceIdentity.id
            )
            let challenge = try await HandheldHubClient.requestPairing(baseURL: base, request: req)
            pairingChallenge = challenge
            hubBaseURL = nil
            phase = .awaitingApproval
            statusMessage = "Warte auf Freigabe am iPad …"
            pollPairing(base: base, pairId: challenge.pairId)
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "Kopplung fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func pollPairing(base: URL, pairId: String) {
        pairingPollTask?.cancel()
        pairingPollTask = Task { [weak self] in
            for _ in 0..<150 { // ~5 min bei 2s
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard let status = try? await HandheldHubClient.pairingStatus(baseURL: base, pairId: pairId) else { continue }
                switch status.state {
                case .approved:
                    guard let token = status.token else { continue }
                    let fp = status.hub?.tlsFingerprint
                        ?? HandheldHubTLS.lastAcceptedFingerprintHex
                    await MainActor.run {
                        PosEnrollmentStore.shared.markHandheldPaired(
                            token: token,
                            hubBaseURL: base.absoluteString,
                            tlsFingerprint: fp
                        )
                        HandheldHubClient.configureTLSPin(fingerprintHex: fp)
                        self?.pairingChallenge = nil
                    }
                    await self?.connectHandheld(preferredHost: {
                        guard let host = base.host else { return nil }
                        let port = base.port.map(String.init) ?? String(PosLanProtocol.hubPort)
                        return "\(host):\(port)"
                    }())
                    return
                case .rejected, .expired:
                    await MainActor.run {
                        self?.pairingChallenge = nil
                        self?.phase = .error(status.state == .rejected ? "Freigabe abgelehnt" : "Code abgelaufen")
                        self?.statusMessage = status.state == .rejected
                            ? "Freigabe am iPad abgelehnt."
                            : "Code abgelaufen — erneut koppeln."
                    }
                    return
                case .pending:
                    continue
                }
            }
        }
    }
}
