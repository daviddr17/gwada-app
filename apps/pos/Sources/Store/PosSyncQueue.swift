import Foundation

enum PosSyncQueueItemKind: String, Codable, Sendable {
    case openSession
    case createOrder
    case collectCash
    case createReservation
    case openRegister
    case closeRegister
    case voidCash
    case issueGiftVoucher
    case redeemGiftVoucher
}

struct PosSyncQueueItem: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var kind: PosSyncQueueItemKind
    var createdAt: String
    var payload: Data
    var attempts: Int
    var lastError: String?
}

struct PosSyncOpenSessionPayload: Codable, Sendable {
    var restaurantId: String
    var diningTableId: String
    var coverCount: Int
    var localSessionId: String
}

struct PosSyncCreateOrderPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var items: [PosSyncOrderItem]
    var localOrderId: String
    var localLineIds: [String]?

    var resolvedLocalLineIds: [String] { localLineIds ?? [] }
}

struct PosSyncOrderItem: Codable, Sendable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: String?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]?
}

struct PosSyncCollectCashPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var allocations: [PosSyncCashAllocation]
    var tipCents: Int
    var receivedAmountCents: Int?
    /// Lokale Quittungs-ID zum Nachtragen der Cloud-paymentId.
    var localReceiptId: String?
}

struct PosSyncOpenRegisterPayload: Codable, Sendable {
    var restaurantId: String
    var openingCashCents: Int
    var localSessionId: String
}

struct PosSyncCloseRegisterPayload: Codable, Sendable {
    var restaurantId: String
    var closingCashCents: Int
}

struct PosSyncVoidCashPayload: Codable, Sendable {
    var restaurantId: String
    var paymentId: String?
    var localReceiptId: String
    var reopenTable: Bool
    var voidReasonId: String?
}

struct PosSyncIssueGiftVoucherPayload: Codable, Sendable {
    var restaurantId: String
    var amountCents: Int
    var localId: String
    var localCode: String
    var note: String?
}

struct PosSyncRedeemGiftVoucherPayload: Codable, Sendable {
    var restaurantId: String
    var giftVoucherId: String
    var tableSessionId: String
    var allocations: [PosSyncCashAllocation]
    var tipCents: Int
    var localReceiptId: String?
    var expectedBalanceBefore: Int
}

struct PosSyncCashAllocation: Codable, Sendable {
    var orderLineId: String
    var quantity: Int
}

/// FIFO-Queue: lokale Aktionen → Cloud (DB + Fiskaly über Web-API), sobald online.
/// Offline-Open: lokale Session-ID wird beim Flush gemappt; nachfolgende Orders nutzen die Cloud-ID.
@MainActor
final class PosSyncQueue: ObservableObject {
    static let shared = PosSyncQueue()

    @Published private(set) var items: [PosSyncQueueItem] = []
    @Published private(set) var isFlushing = false
    @Published private(set) var lastFlushMessage: String = ""

    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sync-queue.json")
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        load()
    }

    var pendingCount: Int { items.count }

    func enqueue(_ item: PosSyncQueueItem) {
        items.append(item)
        persist()
    }

    func enqueueOpenSession(_ payload: PosSyncOpenSessionPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .openSession,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueCreateOrder(_ payload: PosSyncCreateOrderPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .createOrder,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueCollectCash(_ payload: PosSyncCollectCashPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        resolved.allocations = payload.allocations.map {
            PosSyncCashAllocation(
                orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                quantity: $0.quantity
            )
        }
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .collectCash,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueCreateReservation(_ payload: PosCreateReservationPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .createReservation,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueOpenRegister(_ payload: PosSyncOpenRegisterPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .openRegister,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueCloseRegister(_ payload: PosSyncCloseRegisterPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .closeRegister,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueVoidCash(_ payload: PosSyncVoidCashPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .voidCash,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueIssueGiftVoucher(_ payload: PosSyncIssueGiftVoucherPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .issueGiftVoucher,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueRedeemGiftVoucher(_ payload: PosSyncRedeemGiftVoucherPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        resolved.allocations = payload.allocations.map {
            PosSyncCashAllocation(
                orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                quantity: $0.quantity
            )
        }
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .redeemGiftVoucher,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func flushIfPossible() async {
        guard !isFlushing, !items.isEmpty else { return }
        guard PosAuthStore.shared.isSignedIn else {
            lastFlushMessage = "Sync wartet auf Login."
            return
        }
        if PosAuthStore.shared.isOfflineSession {
            lastFlushMessage = "Sync wartet auf Internet (Offline-PIN)."
            return
        }
        isFlushing = true
        defer { isFlushing = false }

        // Arbeitskopie: nach openSession werden noch ausstehende Items umgeschrieben.
        var working = items
        var remaining: [PosSyncQueueItem] = []
        var synced = 0
        var stoppedOffline = false
        var index = 0

        while index < working.count {
            if stoppedOffline {
                remaining.append(contentsOf: working[index...])
                break
            }

            var item = working[index]
            do {
                try await process(&item, working: &working, index: index)
                synced += 1
            } catch {
                item.attempts += 1
                item.lastError = error.localizedDescription
                remaining.append(item)
                if case PosCloudError.offline = error {
                    stoppedOffline = true
                    if index + 1 < working.count {
                        remaining.append(contentsOf: working[(index + 1)...])
                    }
                    break
                }
            }
            index += 1
        }

        items = remaining
        persist()
        lastFlushMessage = synced > 0
            ? "\(synced) Vorgang(e) synchronisiert."
            : (remaining.isEmpty ? "Queue leer." : "Sync ausstehend (\(remaining.count)).")
    }

    private func process(
        _ item: inout PosSyncQueueItem,
        working: inout [PosSyncQueueItem],
        index: Int
    ) async throws {
        switch item.kind {
        case .openSession:
            let payload = try decoder.decode(PosSyncOpenSessionPayload.self, from: item.payload)
            let cloudSessionId = try await PosCloudClient.openTableSession(
                restaurantId: payload.restaurantId,
                diningTableId: payload.diningTableId,
                coverCount: payload.coverCount
            )
            applySessionMapping(
                localSessionId: payload.localSessionId,
                cloudSessionId: cloudSessionId,
                working: &working,
                afterIndex: index
            )

        case .createOrder:
            var payload = try decoder.decode(PosSyncCreateOrderPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            let result = try await PosCloudClient.createOrder(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                items: payload.items.map {
                    PosCloudOrderItem(
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes,
                        course: $0.course,
                        ohneIngredientIds: $0.ohneIngredientIds,
                        modifiers: $0.modifiers
                    )
                }
            )
            applyLineMapping(
                sessionId: payload.tableSessionId,
                localLineIds: payload.resolvedLocalLineIds,
                cloudLines: result.lines,
                working: &working,
                afterIndex: index
            )

        case .collectCash:
            var payload = try decoder.decode(PosSyncCollectCashPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            payload.allocations = payload.allocations.map {
                PosSyncCashAllocation(
                    orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                    quantity: $0.quantity
                )
            }
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            let paymentId = try await PosCloudClient.collectCash(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                allocations: payload.allocations.map { ($0.orderLineId, $0.quantity) },
                tipCents: payload.tipCents,
                receivedAmountCents: payload.receivedAmountCents
            )
            if let localId = payload.localReceiptId {
                PosOfflineCaches.markReceiptSynced(localId: localId, paymentId: paymentId)
            }

        case .createReservation:
            let payload = try decoder.decode(PosCreateReservationPayload.self, from: item.payload)
            _ = try await PosCloudClient.createReservation(payload: payload)

        case .openRegister:
            let payload = try decoder.decode(PosSyncOpenRegisterPayload.self, from: item.payload)
            let result = try await PosCloudClient.openRegister(
                openingCashCents: payload.openingCashCents
            )
            var reg = PosOfflineCaches.loadRegister() ?? PosLocalRegisterState(
                isOpen: true,
                sessionId: result.sessionId ?? payload.localSessionId,
                openedAt: PosOfflineCaches.isoNow(),
                openingCashCents: payload.openingCashCents,
                fiscalPending: false,
                pendingClose: false,
                pendingClosingCashCents: nil,
                lastClosingZNr: nil,
                suggestedOpeningCashCents: nil,
                expectedCashCents: nil
            )
            reg.isOpen = true
            reg.sessionId = result.sessionId ?? payload.localSessionId
            reg.openingCashCents = payload.openingCashCents
            reg.fiscalPending = false
            PosOfflineCaches.saveRegister(reg)
            PosHubState.shared.applyLocalRegister(reg)

        case .closeRegister:
            let payload = try decoder.decode(PosSyncCloseRegisterPayload.self, from: item.payload)
            let result = try await PosCloudClient.closeRegister(
                closingCashCents: payload.closingCashCents
            )
            var reg = PosOfflineCaches.loadRegister() ?? PosLocalRegisterState(
                isOpen: false,
                sessionId: nil,
                openedAt: nil,
                openingCashCents: nil,
                fiscalPending: false,
                pendingClose: false,
                pendingClosingCashCents: nil,
                lastClosingZNr: result.zNr,
                suggestedOpeningCashCents: payload.closingCashCents,
                expectedCashCents: nil
            )
            reg.isOpen = false
            reg.sessionId = nil
            reg.pendingClose = false
            reg.pendingClosingCashCents = nil
            reg.fiscalPending = false
            reg.lastClosingZNr = result.zNr
            reg.suggestedOpeningCashCents = payload.closingCashCents
            PosOfflineCaches.saveRegister(reg)
            PosHubState.shared.applyLocalRegister(reg)

        case .voidCash:
            var payload = try decoder.decode(PosSyncVoidCashPayload.self, from: item.payload)
            let paymentId = payload.paymentId
                ?? PosOfflineCaches.loadReceipts().first(where: { $0.localId == payload.localReceiptId })?.paymentId
            guard let paymentId, !paymentId.isEmpty else {
                throw PosCloudError.httpStatus(400, "payment_id_pending")
            }
            payload.paymentId = paymentId
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            _ = try await PosCloudClient.voidCashPayment(
                restaurantId: payload.restaurantId,
                paymentId: paymentId,
                reopenTable: payload.reopenTable,
                voidReasonId: payload.voidReasonId
            )
            PosOfflineCaches.updateReceipt(localId: payload.localReceiptId) { r in
                r.status = "refunded"
                r.canVoidCash = false
                r.fiscalPending = false
            }

        case .issueGiftVoucher:
            let payload = try decoder.decode(PosSyncIssueGiftVoucherPayload.self, from: item.payload)
            let voucher = try await PosCloudClient.issueGiftVoucher(
                restaurantId: payload.restaurantId,
                amountCents: payload.amountCents
            )
            var all = PosOfflineCaches.loadVouchers().filter {
                $0.id != payload.localId && $0.code != payload.localCode
            }
            all.insert(
                PosCachedGiftVoucher(
                    id: voucher.id,
                    code: voucher.code,
                    balanceCents: voucher.balanceCents,
                    initialAmountCents: voucher.initialAmountCents,
                    status: "active",
                    expiresAt: voucher.expiresAt,
                    pendingIssue: false,
                    pendingRedeemCents: 0
                ),
                at: 0
            )
            PosOfflineCaches.saveVouchers(all)

        case .redeemGiftVoucher:
            var payload = try decoder.decode(PosSyncRedeemGiftVoucherPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            payload.allocations = payload.allocations.map {
                PosSyncCashAllocation(
                    orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                    quantity: $0.quantity
                )
            }
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            let result = try await PosCloudClient.collectVoucher(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                giftVoucherId: payload.giftVoucherId,
                allocations: payload.allocations.map { ($0.orderLineId, $0.quantity) },
                tipCents: payload.tipCents
            )
            if var v = PosOfflineCaches.findVoucher(id: payload.giftVoucherId) {
                v.balanceCents = result.remainingVoucherCents
                v.pendingRedeemCents = 0
                if v.balanceCents <= 0 { v.status = "redeemed" }
                PosOfflineCaches.upsertVoucher(v)
            }
            if let localId = payload.localReceiptId {
                PosOfflineCaches.markReceiptSynced(localId: localId, paymentId: result.paymentId)
            }
        }
    }

    private func applyLineMapping(
        sessionId: String,
        localLineIds: [String],
        cloudLines: [PosCloudClient.PosCloudCreateOrderResult.Line],
        working: inout [PosSyncQueueItem],
        afterIndex: Int
    ) {
        let sorted = cloudLines.sorted { $0.position < $1.position }
        var mappings: [String: String] = [:]
        for (local, cloud) in zip(localLineIds, sorted) {
            PosOrderLineIdMap.shared.remember(localLineId: local, cloudLineId: cloud.id)
            mappings[local] = cloud.id
        }
        if !mappings.isEmpty {
            PosHubState.shared.remapOpenLineIds(
                sessionId: sessionId,
                mappings: mappings.map { (localLineId: $0.key, cloudLineId: $0.value) }
            )
        }
        guard afterIndex + 1 < working.count, !mappings.isEmpty else { return }
        for i in (afterIndex + 1) ..< working.count {
            working[i] = remapQueueItemLineIds(working[i], mappings: mappings)
        }
    }

    private func remapQueueItemLineIds(
        _ item: PosSyncQueueItem,
        mappings: [String: String]
    ) -> PosSyncQueueItem {
        guard item.kind == .collectCash,
              var payload = try? decoder.decode(PosSyncCollectCashPayload.self, from: item.payload)
        else { return item }
        var changed = false
        payload.allocations = payload.allocations.map { alloc in
            guard let cloud = mappings[alloc.orderLineId] else { return alloc }
            changed = true
            return PosSyncCashAllocation(orderLineId: cloud, quantity: alloc.quantity)
        }
        guard changed, let data = try? encoder.encode(payload) else { return item }
        var copy = item
        copy.payload = data
        return copy
    }

    private func applySessionMapping(
        localSessionId: String,
        cloudSessionId: String,
        working: inout [PosSyncQueueItem],
        afterIndex: Int
    ) {
        PosSessionIdMap.shared.remember(
            localSessionId: localSessionId,
            cloudSessionId: cloudSessionId
        )
        PosHubState.shared.remapSessionId(from: localSessionId, to: cloudSessionId)

        guard localSessionId != cloudSessionId else { return }

        // Noch nicht verarbeitete Queue-Einträge auf Cloud-ID umschreiben.
        if afterIndex + 1 < working.count {
            for i in (afterIndex + 1) ..< working.count {
                working[i] = remapQueueItem(working[i], from: localSessionId, to: cloudSessionId)
            }
        }
    }

    private func remapQueueItem(
        _ item: PosSyncQueueItem,
        from localSessionId: String,
        to cloudSessionId: String
    ) -> PosSyncQueueItem {
        var copy = item
        switch item.kind {
        case .createOrder:
            guard var payload = try? decoder.decode(PosSyncCreateOrderPayload.self, from: item.payload)
            else { return item }
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .collectCash:
            guard var payload = try? decoder.decode(PosSyncCollectCashPayload.self, from: item.payload)
            else { return item }
            var changed = false
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                changed = true
            }
            if let data = try? encoder.encode(payload), changed {
                copy.payload = data
            }
        case .openSession:
            break
        case .createReservation:
            break
        }
        return copy
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? decoder.decode([PosSyncQueueItem].self, from: data) else {
            items = []
            return
        }
        items = saved
    }

    private func persist() {
        guard let data = try? encoder.encode(items) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
