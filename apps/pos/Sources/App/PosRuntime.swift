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
    @Published private(set) var isPaired = false
    @Published private(set) var dataSourceLabel = "—"
    /// Aktiver Restaurant-Akzent (Gwada-Gold oder Tenant).
    @Published private(set) var brandAccentHex = PosDesign.defaultAccentHex
    @Published private(set) var pendingPrintJobs = 0

    var brandTint: Color {
        PosDesign.color(hex: brandAccentHex)
    }

    @Published var pairingCodeInput = ""
    @Published var pinInput = ""
    @Published var apiBaseInput = ""
    @Published var restaurantIdInput = ""

    var staffDisplayName: String { PosAuthStore.shared.pinSession?.staffName ?? "" }
    var restaurantDisplayName: String {
        PosAuthStore.shared.device?.restaurantName
            ?? snapshot?.restaurantName
            ?? ""
    }

    private let hubDeviceId = UUID().uuidString
    private var httpServer: HubHTTPServer?
    private let advertiser = BonjourHubAdvertiser()
    private let browser = BonjourHubBrowser()
    private let manualHostKey = "gwada_pos_hub_host"
    private var flushTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    private var idleLockTask: Task<Void, Never>?
    private var lastUserActivity = Date()

    func noteUserActivity() {
        lastUserActivity = Date()
    }

    init() {
        let role = PosDeviceRoleDetector.detect()
        self.role = role
        self.detectionLabel = "Automatisch: \(PosDeviceRoleDetector.deviceKindLabel) → \(role.title)"
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        PosHubState.shared.loadCachedOrDemo()
        restaurantIdInput = PosAuthStore.shared.restaurantId ?? PosCloudConfig.restaurantId ?? ""
        apiBaseInput = PosCloudConfig.apiBaseURL.absoluteString
        isPaired = PosAuthStore.shared.isPaired
        isSignedIn = PosAuthStore.shared.isSignedIn
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"
        applyBrandAccent(fromHex: PosHubState.shared.brandAccentHex)
    }

    func start() async {
        phase = .starting
        await PosAuthStore.shared.restoreDeviceIfNeeded()
        isPaired = PosAuthStore.shared.isPaired
        isSignedIn = PosAuthStore.shared.isSignedIn
        restaurantIdInput = PosAuthStore.shared.restaurantId ?? restaurantIdInput

        guard isPaired else {
            phase = .needsLogin
            statusMessage = "Gerät noch nicht gekoppelt — Kopplungscode aus dem Dashboard eingeben."
            return
        }

        // Online: Roster aktualisieren; Offline-Session ggf. zur Cloud-Session machen
        if PosAuthStore.shared.isOfflineSession {
            if await PosAuthStore.shared.resumeCloudSessionIfNeeded() {
                isSignedIn = true
                statusMessage = "Wieder online — Session synchronisiert."
            }
        } else {
            try? await PosAuthStore.shared.refreshAuthRoster()
        }

        guard PosAuthStore.shared.isSignedIn else {
            phase = .needsLogin
            let rosterHint = PosAuthStore.shared.hasOfflineRoster
                ? "Mit Display-PIN anmelden (auch offline möglich)."
                : "Mit Display-PIN anmelden (einmal online für Offline-Cache)."
            statusMessage = rosterHint
            if role == .hub {
                await startHub()
            }
            return
        }

        switch role {
        case .hub:
            await startHub()
            startHeartbeat()
        case .handheld:
            await connectHandheld()
            if phase == .connected {
                await pullReservationsDay(PosReservationsStore.todayYmd())
            }
            startHeartbeat()
        }
    }

    func pairDevice() async {
        saveConfigFromInputs()
        let code = pairingCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard code.count == 8 else {
            statusMessage = "Kopplungscode muss 8 Zeichen haben."
            return
        }
        do {
            try await PosAuthStore.shared.pair(code: code)
            pairingCodeInput = ""
            restaurantIdInput = PosAuthStore.shared.restaurantId ?? ""
            isPaired = true
            isSignedIn = false
            phase = .needsLogin
            statusMessage = "Gerät gekoppelt: \(PosAuthStore.shared.device?.restaurantName ?? "Restaurant"). Bitte PIN eingeben."
            if role == .hub {
                await startHub()
            }
        } catch {
            statusMessage = "Kopplung fehlgeschlagen: \(error.localizedDescription)"
            phase = .error(error.localizedDescription)
        }
    }

    func signInWithPin() async {
        saveConfigFromInputs()
        let pin = pinInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard pin.count == 4, pin.allSatisfy(\.isNumber) else {
            statusMessage = "Bitte 4-stellige Display-PIN eingeben."
            return
        }
        do {
            try await PosAuthStore.shared.signInWithPin(pin)
            pinInput = ""
            isSignedIn = true
            noteUserActivity()
            let offline = PosAuthStore.shared.isOfflineSession
            statusMessage = offline
                ? "Offline angemeldet als \(staffDisplayName) — Sync bei Internet."
                : "Angemeldet als \(staffDisplayName)."
            switch role {
            case .hub:
                await startHub()
            case .handheld:
                await connectHandheld()
                if phase == .connected {
                    await pullReservationsDay(PosReservationsStore.todayYmd())
                }
            }
            startHeartbeat()
        } catch {
            let message = error.localizedDescription
            if message.contains("forbidden_pos") {
                statusMessage = "Keine Berechtigung für die Kasse (Recht „Kasse bedienen“)."
            } else if message.contains("pin_invalid") {
                statusMessage = "PIN ungültig."
            } else if message.contains("roster_missing") {
                statusMessage = "Kein Offline-Login möglich — einmal online anmelden oder koppeln."
            } else {
                statusMessage = "Anmeldung fehlgeschlagen: \(message)"
            }
            phase = .needsLogin
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
        heartbeatTask?.cancel()
        idleLockTask?.cancel()
        Task {
            await PosAuthStore.shared.signOutPin()
        }
        isSignedIn = false
        if role == .hub {
            // Hub bleibt gekoppelt und lokal erreichbar; nur PIN-Session weg
            phase = .hubReady
            statusMessage = "Abgemeldet — Display-PIN erneut eingeben."
        } else {
            phase = .needsLogin
            statusMessage = "Abgemeldet."
        }
    }

    func unpairDevice() async {
        heartbeatTask?.cancel()
        idleLockTask?.cancel()
        flushTask?.cancel()
        stopHub()
        await PosAuthStore.shared.unpairDevice()
        isPaired = false
        isSignedIn = false
        phase = .needsLogin
        statusMessage = "Gerät entkoppelt."
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
            await connectHandheld()
            await pullReservationsDay(PosReservationsStore.shared.selectedDayYmd)
        }
    }

    func selectReservationsDay(_ ymd: String) {
        PosReservationsStore.shared.selectDay(ymd)
    }

    func pullReservationsDay(_ ymd: String) async {
        switch role {
        case .hub:
            guard PosAuthStore.shared.isSignedIn else { return }
            guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else { return }
            do {
                let day = try await PosCloudClient.fetchReservationsDay(
                    restaurantId: restaurantId,
                    dayYmd: ymd
                )
                PosReservationsStore.shared.applyDay(day)
            } catch {
                if let cached = PosReservationsStore.shared.cachedDay(ymd) {
                    PosReservationsStore.shared.applyDay(cached)
                }
                statusMessage = "Reservierungen offline — Cache: \(error.localizedDescription)"
            }
        case .handheld:
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden."
                return
            }
            do {
                let day = try await HandheldHubClient.fetchReservationsDay(
                    baseURL: base,
                    dayYmd: ymd
                )
                PosReservationsStore.shared.applyDay(day)
            } catch {
                if let cached = PosReservationsStore.shared.cachedDay(ymd) {
                    PosReservationsStore.shared.applyDay(cached)
                }
                statusMessage = "Reservierungen von Kasse nicht geladen: \(error.localizedDescription)"
            }
        }
    }

    func createReservation(_ draft: PosCreateReservationPayload) async -> Bool {
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

        if role == .handheld {
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden."
                return false
            }
            do {
                let res = try await HandheldHubClient.createReservation(baseURL: base, payload: payload)
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
                statusMessage = "Reservierung fehlgeschlagen: \(error.localizedDescription)"
                return false
            }
        }

        // Hub: online direkt in DB, sonst Queue
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
        noteUserActivity()
        guard role == .hub || role == .handheld else { return }
        if role == .handheld {
            guard PosAuthStore.shared.isSignedIn else {
                statusMessage = "Bitte mit Display-PIN anmelden."
                return
            }
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden — Handgerät nur mit iPad-Kasse."
                return
            }
            do {
                _ = try await HandheldHubClient.openSession(
                    baseURL: base,
                    diningTableId: tableId,
                    coverCount: covers
                )
                let snap = try await HandheldHubClient.fetchSnapshot(baseURL: base)
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

    func ensureLocalSession(tableId: String, covers: Int = 2) -> String {
        PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: covers)
    }

    func sendCart(tableId: String, lines: [PosCartLine]) async -> Bool {
        noteUserActivity()
        guard !lines.isEmpty else { return false }
        guard PosAuthStore.shared.isSignedIn else {
            statusMessage = "Bitte mit Display-PIN anmelden."
            return false
        }

        if role == .handheld {
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden — Handgerät nur mit iPad-Kasse."
                return false
            }
            do {
                let items = lines.map {
                    PosLanOrderItem(
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes.isEmpty ? nil : $0.notes,
                        course: $0.course.rawValue,
                        name: $0.name,
                        unitPriceCents: $0.unitPriceCents,
                        ohneIngredientIds: $0.ohneIngredientIds,
                        modifiers: $0.modifiers.map {
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
                try await HandheldHubClient.createOrder(
                    baseURL: base,
                    diningTableId: tableId,
                    coverCount: 2,
                    items: items
                )
                let snap = try await HandheldHubClient.fetchSnapshot(baseURL: base)
                publishSnapshot(snap)
                statusMessage = "Bestellung an Kasse (\(lines.count) Positionen)."
                return true
            } catch {
                statusMessage = error.localizedDescription
                return false
            }
        }

        let restaurantId = PosHubState.shared.restaurantId
        var sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
        if sessionId == nil {
            await openTable(tableId: tableId, covers: 2)
            sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id
                ?? PosHubState.shared.openLocalSession(diningTableId: tableId, coverCount: 2)
        }
        guard let sessionId else { return false }

        let (_, localLineIds) = applyHubOrder(
            sessionId: sessionId,
            lines: lines,
            staffId: PosAuthStore.shared.pinSession?.staffId,
            staffName: PosAuthStore.shared.pinSession?.staffName
        )

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
            PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: items.map {
                    PosSyncOrderItem(
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes,
                        course: $0.course,
                        ohneIngredientIds: $0.ohneIngredientIds,
                        modifiers: $0.modifiers
                    )
                },
                localOrderId: UUID().uuidString,
                localLineIds: localLineIds
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "Lokal gebucht — Sync später (\(error.localizedDescription))"
            return true
        }
    }

    /// Hub: lokale Buchung + Küche/Druck + offene Zeilen.
    @discardableResult
    private func applyHubOrder(
        sessionId: String,
        lines: [PosCartLine],
        staffId: String?,
        staffName: String?
    ) -> (orderNumber: Int, localLineIds: [String]) {
        let addCents = lines.reduce(0) { $0 + $1.lineTotalCents }
        PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: addCents)
        let localLineIds = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, cartLines: lines)
        let localOrderNumber = (snapshot?.floor.orderCountBySessionId[sessionId] ?? 0) + 1
        PosHubState.shared.routeKitchenOutput(orderNumber: localOrderNumber, cartLines: lines)
        pendingPrintJobs = PosHubState.shared.pendingPrintJobCount
        Task { await PosPrintDispatcher.shared.kick() }
        publishSnapshot(PosHubState.shared.makeSnapshot())
        if let staffName, !staffName.isEmpty {
            statusMessage = "Gebucht von \(staffName)."
        }
        _ = staffId
        return (localOrderNumber, localLineIds)
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

    func loadOpenLines(tableId: String) async -> [SessionOpenLine] {
        guard let sessionId = snapshot?.floor.openSessions.first(where: { $0.dining_table_id == tableId })?.id else {
            return []
        }
        guard PosAuthStore.shared.isSignedIn else { return [] }

        if role == .handheld {
            guard let base = hubBaseURL else { return [] }
            do {
                return try await HandheldHubClient.fetchSessionSummary(
                    baseURL: base,
                    sessionId: sessionId
                )
            } catch {
                statusMessage = "Offene Positionen: \(error.localizedDescription)"
                return []
            }
        }

        let local = PosHubState.shared.localOpenLines(sessionId: sessionId)
        if !local.isEmpty { return local }

        let restaurantId = PosHubState.shared.restaurantId
        guard !PosAuthStore.shared.isOfflineSession else { return local }
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
            return local
        }
    }

    func collectSplit(
        sessionId: String,
        lines: [SessionOpenLine],
        method: PosPaymentMethodKind,
        tipCents: Int,
        receivedAmountCents: Int? = nil,
        giftVoucherId: String? = nil,
        customPaymentMethodId: String? = nil
    ) async {
        noteUserActivity()
        guard PosAuthStore.shared.isSignedIn else {
            statusMessage = "Bitte mit Display-PIN anmelden."
            return
        }
        let restaurantId = PosHubState.shared.restaurantId
        let allocations = lines.map { ($0.orderLineId, $0.openQuantity) }

        if role == .handheld {
            guard method == .cash else {
                statusMessage = "Am Handgerät offline nur Bar über die Kasse — andere Arten an der Kasse."
                return
            }
            guard let base = hubBaseURL else {
                statusMessage = "Keine Kasse verbunden."
                return
            }
            do {
                let result = try await HandheldHubClient.collectCash(
                    baseURL: base,
                    sessionId: sessionId,
                    allocations: allocations,
                    tipCents: tipCents,
                    receivedAmountCents: receivedAmountCents
                )
                let snap = try await HandheldHubClient.fetchSnapshot(baseURL: base)
                publishSnapshot(snap)
                if result.fiscalPending {
                    statusMessage = result.message
                        ?? "Bar kassiert — Fiskalisierung nicht möglich, Nachsignierung ausstehend."
                } else {
                    statusMessage = result.message ?? "Teilzahlung kassiert."
                }
            } catch {
                statusMessage = error.localizedDescription
            }
            return
        }

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

        if method == .other {
            guard let customPaymentMethodId, !customPaymentMethodId.isEmpty else {
                statusMessage = "Zahlungsart fehlt."
                return
            }
            do {
                try await PosCloudClient.collectCustomMethod(
                    restaurantId: restaurantId,
                    tableSessionId: sessionId,
                    paymentMethodId: customPaymentMethodId,
                    allocations: allocations,
                    tipCents: tipCents
                )
                statusMessage = "Teilzahlung kassiert."
                await pullCloudBootstrap(forceDemoFallback: false)
                publishSnapshot(PosHubState.shared.makeSnapshot())
            } catch {
                statusMessage = "Zahlung fehlgeschlagen — \(error.localizedDescription)"
            }
            return
        }

        guard method == .cash else {
            statusMessage = "Unbar folgt — bitte Bar, Gutschein oder eigene Art nutzen."
            return
        }

        // Immer lokal abbuchen (auch offline), dann Cloud versuchen.
        let localResult = PosHubState.shared.collectLocalCash(
            sessionId: sessionId,
            allocations: allocations
        )
        publishSnapshot(PosHubState.shared.makeSnapshot())

        if PosAuthStore.shared.isOfflineSession {
            PosHubState.shared.enqueueFiscalPendingCashReceipt(
                amountCents: localResult.amountCents,
                tipCents: tipCents
            )
            await PosPrintDispatcher.shared.kick()
            PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                allocations: allocations.map { PosSyncCashAllocation(orderLineId: $0.0, quantity: $0.1) },
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage =
                "Bar \(PosMoney.format(localResult.amountCents + tipCents)) — Fiskalisierung nicht möglich, Nachsignierung ausstehend."
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
            PosHubState.shared.enqueueFiscalPendingCashReceipt(
                amountCents: localResult.amountCents,
                tipCents: tipCents
            )
            await PosPrintDispatcher.shared.kick()
            PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                allocations: allocations.map { PosSyncCashAllocation(orderLineId: $0.0, quantity: $0.1) },
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage =
                "Bar lokal — Fiskalisierung nicht möglich, Nachsignierung ausstehend (\(error.localizedDescription))"
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

        let cartLine = PosCartLine(
            menuItemId: menuItem.id,
            name: menuItem.name,
            unitPriceCents: menuItem.priceCents,
            quantity: 1,
            course: .main,
            notes: "",
            ohneIngredientIds: [],
            modifiers: []
        )
        let (_, localLineIds) = applyHubOrder(
            sessionId: sessionId,
            lines: [cartLine],
            staffId: PosAuthStore.shared.pinSession?.staffId,
            staffName: PosAuthStore.shared.pinSession?.staffName
        )

        do {
            let result = try await PosCloudClient.createOrder(
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
            applyCloudOrderLineMapping(
                sessionId: sessionId,
                localLineIds: localLineIds,
                cloudLines: result.lines
            )
            statusMessage = "„\(menuItem.name)“ in der Cloud gebucht."
        } catch {
            PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                restaurantId: restaurantId,
                tableSessionId: sessionId,
                items: [PosSyncOrderItem(menuItemId: menuItem.id, quantity: 1, notes: nil)],
                localOrderId: UUID().uuidString,
                localLineIds: localLineIds
            ))
            syncPending = PosSyncQueue.shared.pendingCount
            statusMessage = "„\(menuItem.name)“ lokal — Sync später (\(error.localizedDescription))"
        }
    }

    private func saveConfigFromInputs() {
        if !apiBaseInput.isEmpty { PosCloudConfig.setApiBaseURL(apiBaseInput) }
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        startIdleLockMonitor()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)

                let activityThreshold: TimeInterval = await MainActor.run {
                    let autoLock = PosAuthStore.shared.device?.autoLockSeconds ?? 0
                    return autoLock > 0 ? TimeInterval(autoLock) : 60
                }

                let recentlyActive = await MainActor.run {
                    guard let self else { return false }
                    return Date().timeIntervalSince(self.lastUserActivity) <= activityThreshold
                }
                guard recentlyActive else { continue }

                if PosAuthStore.shared.isOfflineSession {
                    if await PosAuthStore.shared.resumeCloudSessionIfNeeded() {
                        await MainActor.run {
                            self?.isSignedIn = true
                            self?.statusMessage = "Wieder online — Cloud-Sync aktiv."
                            self?.syncPending = PosSyncQueue.shared.pendingCount
                        }
                        await PosSyncQueue.shared.flushIfPossible()
                        await MainActor.run {
                            self?.syncPending = PosSyncQueue.shared.pendingCount
                        }
                    }
                } else {
                    await PosAuthStore.shared.heartbeat()
                    try? await PosAuthStore.shared.refreshAuthRoster()
                }
                await MainActor.run {
                    self?.isSignedIn = PosAuthStore.shared.isSignedIn
                    if self?.isSignedIn != true {
                        self?.statusMessage = "Session abgelaufen — bitte PIN erneut eingeben."
                        self?.phase = .needsLogin
                    }
                }
            }
        }
    }

    private func startIdleLockMonitor() {
        idleLockTask?.cancel()
        idleLockTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run {
                    self?.checkIdleAutoLock()
                }
            }
        }
    }

    private func checkIdleAutoLock() {
        guard isSignedIn else { return }
        guard let autoLock = PosAuthStore.shared.device?.autoLockSeconds, autoLock > 0 else { return }
        let idleSeconds = Date().timeIntervalSince(lastUserActivity)
        guard idleSeconds >= TimeInterval(autoLock) else { return }
        signOut()
    }

    private func startHub() async {
        stopHub()
        PosHubState.shared.configure(hubDeviceId: hubDeviceId)
        PosHubState.shared.setLanSharedSecret(PosAuthStore.shared.lanSharedSecret)
        PosHubState.shared.loadCachedOrDemo()

        isSignedIn = PosAuthStore.shared.isSignedIn
        await pullCloudBootstrap(forceDemoFallback: true)
        publishSnapshot(PosHubState.shared.makeSnapshot())
        dataSourceLabel = PosHubState.shared.isDemo ? "Demo/Cache" : "Cloud-Cache"
        await pullReservationsDay(PosReservationsStore.todayYmd())

        let server = HubHTTPServer { method, path, headers, body in
            Self.handleHubRequest(method: method, path: path, headers: headers, body: body)
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

    private nonisolated static func lanSecretOK(_ headers: [String: String]) -> Bool {
        let got = headers[PosLanProtocol.headerLanSecret.lowercased()] ?? ""
        return PosHubState.shared.lanSharedSecretMatches(got)
    }

    private nonisolated static func lanStaff(from headers: [String: String]) -> (id: String, name: String)? {
        let id = headers[PosLanProtocol.headerStaffId.lowercased()]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !id.isEmpty else { return nil }
        let name = headers[PosLanProtocol.headerStaffName.lowercased()] ?? ""
        return (id, name)
    }

    private nonisolated static func lanRestaurantIdOK(_ headers: [String: String]) -> Bool {
        let got = headers[PosLanProtocol.headerRestaurantId.lowercased()]?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !got.isEmpty else { return true }
        return got == PosHubState.shared.restaurantId
    }

    private nonisolated static func lanKdsPageSecret(_ path: String, headers: [String: String]) -> String? {
        let headerSecret = headers[PosLanProtocol.headerLanSecret.lowercased()] ?? ""
        if PosHubState.shared.lanSharedSecretMatches(headerSecret) {
            return headerSecret
        }
        let querySecret = lanQueryValue(path, key: "s") ?? ""
        if PosHubState.shared.lanSharedSecretMatches(querySecret) {
            return querySecret
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
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let decoder = JSONDecoder()

        // Health ohne Secret (Discovery); KDS-HTML auch per ?s=; alles andere braucht LAN-Secret-Header.
        let isKdsPage = pathOnly == PosLanProtocol.kdsPath && method == "GET"
        let needsSecret = pathOnly != PosLanProtocol.healthPath && !isKdsPage
        if needsSecret && !lanSecretOK(headers) {
            return (401, Data(#"{"error":"lan_unauthorized"}"#.utf8))
        }
        if isKdsPage {
            guard lanKdsPageSecret(path, headers: headers) != nil else {
                return (401, Data(#"{"error":"lan_unauthorized"}"#.utf8))
            }
        }
        if needsSecret || isKdsPage {
            if !lanRestaurantIdOK(headers) {
                return (403, Data(#"{"error":"restaurant_mismatch"}"#.utf8))
            }
        }

        if method == "GET" {
            if pathOnly == PosLanProtocol.healthPath {
                let health = PosHubState.shared.makeHealth()
                let data = (try? encoder.encode(health)) ?? Data(#"{"ok":false}"#.utf8)
                return (200, data)
            }
            if pathOnly == PosLanProtocol.snapshotPath {
                let snap = PosHubState.shared.makeSnapshot()
                let data = (try? encoder.encode(snap)) ?? Data(#"{"error":"encode"}"#.utf8)
                return (200, data)
            }
            if pathOnly == PosLanProtocol.sessionSummaryPath {
                guard lanStaff(from: headers) != nil else {
                    return (401, Data(#"{"error":"staff_required"}"#.utf8))
                }
                let sessionId = lanQueryValue(path, key: "sessionId") ?? ""
                let lines = PosHubState.shared.localOpenLines(sessionId: sessionId)
                let payload = ["lines": lines.map {
                    [
                        "id": $0.id,
                        "orderLineId": $0.orderLineId,
                        "name": $0.name,
                        "openQuantity": $0.openQuantity,
                        "openCents": $0.openCents,
                        "detail": $0.detail,
                    ] as [String: Any]
                }]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data(#"{"lines":[]}"#.utf8)
                return (200, data)
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
                let secret = lanKdsPageSecret(path, headers: headers) ?? ""
                return (200, KdsHubHTML.page(lanSecret: secret))
            }
            if pathOnly == PosLanProtocol.kdsTicketsPath {
                let deviceId = lanQueryValue(path, key: "deviceId")
                return (200, PosHubState.shared.kdsTicketsJSON(deviceId: deviceId))
            }
            if pathOnly == PosLanProtocol.printJobsPath {
                return (200, PosHubState.shared.printJobsJSON())
            }
            return (404, Data(#"{"error":"not_found"}"#.utf8))
        }

        if method == "POST" {
            guard let staff = lanStaff(from: headers) else {
                return (401, Data(#"{"error":"staff_required"}"#.utf8))
            }

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
                let payload = ["sessionId": sessionId, "staffId": staff.id, "staffName": staff.name]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }

            if pathOnly == PosLanProtocol.collectCashPath {
                struct Allocation: Decodable {
                    var orderLineId: String
                    var quantity: Int
                }
                struct Req: Decodable {
                    var sessionId: String
                    var allocations: [Allocation]
                    var tipCents: Int?
                    var receivedAmountCents: Int?
                }
                guard let req = try? decoder.decode(Req.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let result = PosHubState.shared.collectLocalCash(
                    sessionId: req.sessionId,
                    allocations: req.allocations.map { ($0.orderLineId, $0.quantity) }
                )
                let tip = req.tipCents ?? 0
                PosHubState.shared.enqueueFiscalPendingCashReceipt(
                    amountCents: result.amountCents,
                    tipCents: tip
                )
                let restaurantId = PosHubState.shared.restaurantId
                Task { @MainActor in
                    await PosPrintDispatcher.shared.kick()
                    PosSyncQueue.shared.enqueueCollectCash(PosSyncCollectCashPayload(
                        restaurantId: restaurantId,
                        tableSessionId: req.sessionId,
                        allocations: req.allocations.map {
                            PosSyncCashAllocation(orderLineId: $0.orderLineId, quantity: $0.quantity)
                        },
                        tipCents: tip,
                        receivedAmountCents: req.receivedAmountCents
                    ))
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let payload: [String: Any] = [
                    "ok": true,
                    "fiscalPending": true,
                    "message": "Bar \(result.amountCents + tip) ct — Fiskalisierung nicht möglich, Nachsignierung ausstehend.",
                    "staffId": staff.id,
                    "staffName": staff.name,
                ]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }

            if pathOnly == PosLanProtocol.createOrderPath {
                struct Req: Decodable {
                    var diningTableId: String
                    var coverCount: Int?
                    var items: [PosLanOrderItem]
                }
                guard let req = try? decoder.decode(Req.self, from: body), !req.items.isEmpty else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let sessionId = PosHubState.shared.openLocalSession(
                    diningTableId: req.diningTableId,
                    coverCount: req.coverCount ?? 2
                )
                let cartLines: [PosCartLine] = req.items.compactMap { item in
                    let menuItem = PosHubState.shared.menu?.items.first(where: { $0.id == item.menuItemId })
                    let name = item.name ?? menuItem?.name ?? "Artikel"
                    let price = item.unitPriceCents ?? menuItem?.priceCents ?? 0
                    let course = PosCourse(rawValue: item.course ?? "") ?? .other
                    return PosCartLine(
                        menuItemId: item.menuItemId,
                        name: name,
                        unitPriceCents: price,
                        quantity: item.quantity,
                        course: course,
                        notes: item.notes ?? "",
                        modifiers: (item.modifiers ?? []).map {
                            PosCartModifier(
                                id: UUID().uuidString,
                                type: $0.type,
                                label: $0.label,
                                ingredientId: $0.ingredientId,
                                optionChoiceId: $0.optionChoiceId,
                                priceDeltaCents: $0.priceDeltaCents ?? 0
                            )
                        }
                    )
                }
                let addCents = cartLines.reduce(0) { $0 + $1.lineTotalCents }
                PosHubState.shared.bumpLocalOrder(sessionId: sessionId, addCents: addCents)
                let localLineIds = PosHubState.shared.appendLocalOpenLines(sessionId: sessionId, cartLines: cartLines)
                let orderNumber = (PosHubState.shared.makeSnapshot().floor.orderCountBySessionId[sessionId] ?? 1)
                PosHubState.shared.routeKitchenOutput(orderNumber: orderNumber, cartLines: cartLines)
                Task { await PosPrintDispatcher.shared.kick() }
                let restaurantId = PosHubState.shared.restaurantId
                let localOrderId = UUID().uuidString
                Task { @MainActor in
                    PosSyncQueue.shared.enqueueCreateOrder(PosSyncCreateOrderPayload(
                        restaurantId: restaurantId,
                        tableSessionId: sessionId,
                        items: req.items.map {
                            PosSyncOrderItem(
                                menuItemId: $0.menuItemId,
                                quantity: $0.quantity,
                                notes: $0.notes,
                                course: $0.course,
                                ohneIngredientIds: $0.ohneIngredientIds,
                                modifiers: $0.modifiers
                            )
                        },
                        localOrderId: localOrderId,
                        localLineIds: localLineIds
                    ))
                    await PosSyncQueue.shared.flushIfPossible()
                }
                let payload: [String: Any] = [
                    "sessionId": sessionId,
                    "localOrderId": localOrderId,
                    "ok": true,
                    "staffId": staff.id,
                    "staffName": staff.name,
                ]
                let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
                return (200, data)
            }
        }

        return (405, Data(#"{"error":"method_not_allowed"}"#.utf8))
    }

    private func connectHandheld(preferredHost: String? = nil) async {
        guard PosAuthStore.shared.isPaired else {
            phase = .needsLogin
            statusMessage = "Gerät koppeln (Dashboard-Code)."
            return
        }
        guard PosAuthStore.shared.isSignedIn else {
            phase = .needsLogin
            statusMessage = "Mit Display-PIN anmelden — dann verbindet sich das Handgerät mit der Kasse."
            return
        }
        guard PosAuthStore.shared.lanSharedSecret != nil else {
            phase = .needsLogin
            statusMessage = "LAN-Kopplung unvollständig — Gerät erneut koppeln."
            return
        }

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
            statusMessage = "Handgerät nur mit erreichbarer iPad-Kasse nutzbar."
            return
        }

        var lastError: String?
        for base in candidates {
            do {
                statusMessage = "Verbinde \(base.host ?? "") …"
                let health = try await HandheldHubClient.fetchHealth(baseURL: base)
                guard health.ok else { throw HandheldHubClientError.invalidResponse }
                let snap = try await HandheldHubClient.fetchSnapshot(baseURL: base)
                if let host = base.host {
                    UserDefaults.standard.set(host, forKey: manualHostKey)
                }
                hubBaseURL = base
                publishSnapshot(snap)
                phase = .connected
                let who = staffDisplayName.isEmpty ? "" : " · \(staffDisplayName)"
                statusMessage = "Verbunden mit \(snap.hub.displayName)\(who)."
                await pullReservationsDay(PosReservationsStore.todayYmd())
                return
            } catch {
                lastError = error.localizedDescription
            }
        }

        phase = .error(lastError ?? "Kasse nicht erreichbar")
        statusMessage = lastError ?? "Kasse nicht erreichbar — Handgerät wartet auf die Kasse."
    }
}
