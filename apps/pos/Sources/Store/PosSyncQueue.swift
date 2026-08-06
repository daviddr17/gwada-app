import Foundation

enum PosSyncQueueItemKind: String, Codable, Sendable {
    case openSession
    case createOrder
    case collectCash
    case fireCourse
    case lineVoided
    case reservationSeated
    case moveSession
    case releaseSession
    case createReservation
    case openRegister
    case closeRegister
}

struct PosSyncQueueItem: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var kind: PosSyncQueueItemKind
    var createdAt: String
    var payload: Data
    var attempts: Int
    var lastError: String?
    /// Gesetzt wenn Item aus der aktiven FIFO-Queue entfernt wurde (Review P1-4).
    var deadLetteredAt: String?
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

    static func make(
        restaurantId: String,
        tableSessionId: String,
        lines: [PosCartLine],
        localOrderId: String = UUID().uuidString,
        localLineIds: [String]? = nil
    ) -> PosSyncCreateOrderPayload {
        PosSyncCreateOrderPayload(
            restaurantId: restaurantId,
            tableSessionId: tableSessionId,
            items: lines.map { line in
                PosSyncOrderItem(
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
            },
            localOrderId: localOrderId,
            localLineIds: localLineIds ?? lines.map(\.id)
        )
    }
}

struct PosSyncOrderItem: Codable, Sendable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: Int?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]?
}

struct PosSyncCollectCashPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var allocations: [PosSyncCashAllocation]
    var tipCents: Int
    var receivedAmountCents: Int?
    /// Stabile Idempotenz (`hub:payment:{id}`) — LAN `paymentAttemptId`.
    var paymentAttemptId: String?
    /// Lokaler Beleg → nach Flush `markReceiptSynced`.
    var receiptLocalId: String?
    /// `cash` | `card` | `paypal` (Default cash).
    var method: String?
    /// Für Nest unbar (`payment.completed` amountCents).
    var amountCents: Int?

    var resolvedMethod: String { method ?? "cash" }
    var resolvedPaymentAttemptId: String? {
        let t = paymentAttemptId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return t.isEmpty ? nil : t
    }
}

struct PosSyncCashAllocation: Codable, Sendable {
    var orderLineId: String
    var quantity: Int
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

struct PosSyncFireCoursePayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var course: Int
    var fireAttemptId: String

    enum CodingKeys: String, CodingKey {
        case restaurantId, tableSessionId, course, fireAttemptId
    }

    init(
        restaurantId: String,
        tableSessionId: String,
        course: Int,
        fireAttemptId: String
    ) {
        self.restaurantId = restaurantId
        self.tableSessionId = tableSessionId
        self.course = course
        self.fireAttemptId = fireAttemptId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        restaurantId = try container.decode(String.self, forKey: .restaurantId)
        tableSessionId = try container.decode(String.self, forKey: .tableSessionId)
        if let course = try? container.decode(Int.self, forKey: .course) {
            self.course = course
        } else {
            course = PosCourse.parse(try container.decode(String.self, forKey: .course))
        }
        fireAttemptId = try container.decode(String.self, forKey: .fireAttemptId)
    }
}

struct PosSyncLineVoidedPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var lineId: String
    var quantity: Int
    var voidReasonId: String
    var note: String?
    var wasFired: Bool
    var waiterProfileId: String?
    var idempotencyKey: String
}

struct PosSyncReservationSeatedPayload: Codable, Sendable {
    var restaurantId: String
    var reservationId: String
    var diningTableId: String
    var coverCount: Int
    var localSessionId: String
    var idempotencyKey: String
}

struct PosSyncMoveSessionPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var toTableId: String
}

struct PosSyncReleaseSessionPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
}

/// FIFO-Queue: lokale Aktionen → Cloud (Nest Outbox oder Next `/api/pos`), sobald online.
/// Offline-Open: lokale Session-ID wird beim Flush gemappt; nachfolgende Orders nutzen die Cloud-ID.
@MainActor
final class PosSyncQueue: ObservableObject {
    static let shared = PosSyncQueue()

    @Published private(set) var items: [PosSyncQueueItem] = []
    /// Permanent fehlgeschlagene Items — blockieren FIFO nicht mehr.
    @Published private(set) var deadLetters: [PosSyncQueueItem] = []
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

    private struct PersistBlob: Codable {
        var items: [PosSyncQueueItem]
        var deadLetters: [PosSyncQueueItem]
    }

    private init() {
        load()
    }

    var pendingCount: Int { items.count }
    var deadLetterCount: Int { deadLetters.count }

    /// Factory-Reset: Queue + Dead-Letters leeren.
    func clearAll() {
        items = []
        deadLetters = []
        lastFlushMessage = ""
        isFlushing = false
        try? FileManager.default.removeItem(at: fileURL)
    }

    /// Permanent → Dead-Letter (FIFO geht weiter). Offline/5xx → Kopf behalten, Stop.
    static func shouldDeadLetter(error: Error, attempts: Int) -> Bool {
        if attempts >= maxFlushAttempts { return true }
        guard let cloud = error as? PosCloudError else { return false }
        switch cloud {
        case .missingConfig:
            return true
        case .httpStatus(let code, _):
            // 4xx außer Auth/Rate-Limit: Payload/Config kaputt — nicht ewig blockieren.
            if code == 401 || code == 408 || code == 429 { return false }
            return (400 ... 499).contains(code)
        case .unauthorized, .offline, .invalidResponse, .missingRestaurant, .notModified:
            return false
        }
    }

    func enqueue(_ item: PosSyncQueueItem) {
        items.append(item)
        persist()
    }

    private func makeItem(
        id: String = UUID().uuidString,
        kind: PosSyncQueueItemKind,
        payload: Data
    ) -> PosSyncQueueItem {
        PosSyncQueueItem(
            id: id,
            kind: kind,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: payload,
            attempts: 0,
            lastError: nil,
            deadLetteredAt: nil
        )
    }

    func enqueueOpenSession(_ payload: PosSyncOpenSessionPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(makeItem(kind: .openSession, payload: data))
    }

    func enqueueCreateOrder(_ payload: PosSyncCreateOrderPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(kind: .createOrder, payload: data))
    }

    /// Enqueued Zahlung. Gleiche `paymentAttemptId` / Queue-ID → kein Duplikat.
    func enqueueCollectCash(_ payload: PosSyncCollectCashPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        resolved.allocations = payload.allocations.map {
            PosSyncCashAllocation(
                orderLineId: PosOrderLineIdMap.shared.resolve($0.orderLineId),
                quantity: $0.quantity
            )
        }
        let itemId = resolved.resolvedPaymentAttemptId ?? UUID().uuidString
        if items.contains(where: { $0.id == itemId }) { return }
        if resolved.paymentAttemptId == nil {
            resolved.paymentAttemptId = itemId
        }
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(id: itemId, kind: .collectCash, payload: data))
    }

    func enqueueFireCourse(_ payload: PosSyncFireCoursePayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(kind: .fireCourse, payload: data))
    }

    func enqueueLineVoided(_ payload: PosSyncLineVoidedPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        resolved.lineId = PosOrderLineIdMap.shared.resolve(payload.lineId)
        if items.contains(where: { $0.id == resolved.idempotencyKey }) { return }
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(id: resolved.idempotencyKey, kind: .lineVoided, payload: data))
    }

    /// Enqueues seat sync once per `idempotencyKey` (LAN / Hub replay-safe).
    func enqueueReservationSeated(_ payload: PosSyncReservationSeatedPayload) {
        var resolved = payload
        resolved.localSessionId = PosSessionIdMap.shared.resolve(payload.localSessionId)
        if items.contains(where: { $0.id == resolved.idempotencyKey }) { return }
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(id: resolved.idempotencyKey, kind: .reservationSeated, payload: data))
    }

    func enqueueMoveSession(_ payload: PosSyncMoveSessionPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(kind: .moveSession, payload: data))
    }

    func enqueueReleaseSession(_ payload: PosSyncReleaseSessionPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(makeItem(kind: .releaseSession, payload: data))
    }

    func enqueueCreateReservation(_ payload: PosCreateReservationPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(makeItem(kind: .createReservation, payload: data))
    }

    func enqueueOpenRegister(_ payload: PosSyncOpenRegisterPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(makeItem(kind: .openRegister, payload: data))
    }

    func enqueueCloseRegister(_ payload: PosSyncCloseRegisterPayload) {
        let data = (try? encoder.encode(payload)) ?? Data()
        enqueue(makeItem(kind: .closeRegister, payload: data))
    }

    /// Max. Versuche bevor Item in Dead-Letter wandert (FIFO geht weiter).
    static let maxFlushAttempts = 25
    /// Soft-Warnung wenn Queue wächst (kein Hard-Drop).
    static let pendingWarnThreshold = 80

    /// Anzahl erfolgreich synchronisierter Items in diesem Lauf (0 = nichts / geblockt).
    @discardableResult
    func flushIfPossible() async -> Int {
        guard !isFlushing, !items.isEmpty else { return 0 }
        guard PosAuthStore.shared.isSignedIn else {
            lastFlushMessage = "Sync wartet auf Login."
            return 0
        }
        isFlushing = true
        defer { isFlushing = false }

        // Arbeitskopie: nach openSession werden noch ausstehende Items umgeschrieben.
        var working = items
        var remaining: [PosSyncQueueItem] = []
        var synced = 0
        var deadLetteredThisRun = 0
        var stopped = false
        var index = 0

        while index < working.count {
            if stopped {
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
                if Self.shouldDeadLetter(error: error, attempts: item.attempts) {
                    item.deadLetteredAt = ISO8601DateFormatter().string(from: Date())
                    deadLetters.append(item)
                    deadLetteredThisRun += 1
                    index += 1
                    continue
                }
                remaining.append(item)
                // Temporär (Offline/5xx/Auth): FIFO hart — Queue nicht überspringen.
                stopped = true
                if index + 1 < working.count {
                    remaining.append(contentsOf: working[(index + 1)...])
                }
                break
            }
            index += 1
        }

        items = remaining
        persist()
        if synced > 0 {
            lastFlushMessage = "\(synced) Vorgang(e) synchronisiert\(PosCloudConfig.nestSyncEnabled ? " (Nest)" : "")."
        } else if remaining.isEmpty, deadLetteredThisRun > 0 {
            lastFlushMessage = "\(deadLetteredThisRun) Vorgang(e) in Dead-Letter (nicht erneut)."
        } else if remaining.isEmpty {
            lastFlushMessage = "Queue leer."
        } else if let head = remaining.first, head.attempts >= Self.maxFlushAttempts {
            lastFlushMessage =
                "Sync blockiert (\(remaining.count) offen): \(head.lastError ?? "Fehler") — \(head.attempts)× versucht."
        } else if deadLetterCount > 0, remaining.count > 0 {
            lastFlushMessage =
                "Sync ausstehend (\(remaining.count)) · Dead-Letter \(deadLetterCount)."
        } else if remaining.count >= Self.pendingWarnThreshold {
            lastFlushMessage = "Sync-Queue groß (\(remaining.count) offen)."
        } else {
            lastFlushMessage = "Sync ausstehend (\(remaining.count))."
        }
        return synced
    }

    private func process(
        _ item: inout PosSyncQueueItem,
        working: inout [PosSyncQueueItem],
        index: Int
    ) async throws {
        switch item.kind {
        case .openSession, .createOrder, .collectCash, .fireCourse, .lineVoided, .reservationSeated, .moveSession, .releaseSession:
            if PosCloudConfig.nestSyncEnabled {
                try await processViaNest(&item, working: &working, index: index)
            } else {
                try await processViaNext(&item, working: &working, index: index)
            }
        case .createReservation:
            let payload = try decoder.decode(PosCreateReservationPayload.self, from: item.payload)
            _ = try await PosCloudClient.createReservation(payload: payload)
        case .openRegister:
            let payload = try decoder.decode(PosSyncOpenRegisterPayload.self, from: item.payload)
            _ = try await PosCloudClient.openRegister(openingCashCents: payload.openingCashCents)
        case .closeRegister:
            let payload = try decoder.decode(PosSyncCloseRegisterPayload.self, from: item.payload)
            _ = try await PosCloudClient.closeRegister(closingCashCents: payload.closingCashCents)
        }
    }

    private func processViaNest(
        _ item: inout PosSyncQueueItem,
        working: inout [PosSyncQueueItem],
        index: Int
    ) async throws {
        let envelope: [String: Any]
        switch item.kind {
        case .openSession:
            let payload = try decoder.decode(PosSyncOpenSessionPayload.self, from: item.payload)
            envelope = PosNestClient.eventEnvelope(
                type: "session.opened",
                idempotencyKey: "hub:session.open:\(payload.localSessionId)",
                sessionId: nil,
                payload: [
                    "tableId": payload.diningTableId,
                    "diningTableId": payload.diningTableId,
                    "coverCount": payload.coverCount,
                    "localSessionId": payload.localSessionId,
                ]
            )

        case .createOrder:
            var payload = try decoder.decode(PosSyncCreateOrderPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            let itemsPayload: [[String: Any]] = payload.items.map { item in
                var row: [String: Any] = [
                    "menuItemId": item.menuItemId,
                    "quantity": item.quantity,
                ]
                if let course = item.course { row["course"] = course }
                if let notes = item.notes, !notes.isEmpty { row["notes"] = notes }
                if let ohne = item.ohneIngredientIds, !ohne.isEmpty {
                    row["ohneIngredientIds"] = ohne
                }
                if let modifiers = item.modifiers, !modifiers.isEmpty {
                    row["modifiers"] = modifiers.map { modifier -> [String: Any] in
                        var value: [String: Any] = [
                            "type": modifier.type,
                            "label": modifier.label,
                        ]
                        if let ingredientId = modifier.ingredientId {
                            value["ingredientId"] = ingredientId
                        }
                        if let optionChoiceId = modifier.optionChoiceId {
                            value["optionChoiceId"] = optionChoiceId
                        }
                        if let priceDeltaCents = modifier.priceDeltaCents {
                            value["priceDeltaCents"] = priceDeltaCents
                        }
                        return value
                    }
                }
                return row
            }
            envelope = PosNestClient.eventEnvelope(
                type: "order.created",
                idempotencyKey: "hub:line.add:\(payload.localOrderId)",
                sessionId: payload.tableSessionId,
                payload: [
                    "sessionId": payload.tableSessionId,
                    "items": itemsPayload,
                    "localOrderId": payload.localOrderId,
                ]
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
            let method = payload.resolvedMethod
            var body: [String: Any] = [
                "sessionId": payload.tableSessionId,
                "method": method,
                "tipCents": payload.tipCents,
                "settlementMode": "item",
                "allocations": payload.allocations.map {
                    ["orderLineId": $0.orderLineId, "quantity": $0.quantity]
                },
            ]
            if let received = payload.receivedAmountCents {
                body["receivedAmountCents"] = received
            }
            if method == "card" || method == "paypal" {
                let amount = payload.amountCents
                    ?? 0
                body["amountCents"] = amount
            }
            let paymentKey = payload.resolvedPaymentAttemptId ?? item.id
            envelope = PosNestClient.eventEnvelope(
                type: "payment.completed",
                idempotencyKey: "hub:payment:\(paymentKey)",
                sessionId: payload.tableSessionId,
                payload: body
            )

        case .fireCourse:
            var payload = try decoder.decode(PosSyncFireCoursePayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            envelope = PosNestClient.eventEnvelope(
                type: "course.fired",
                idempotencyKey: "hub:course.fire:\(payload.tableSessionId):\(payload.course):\(payload.fireAttemptId)",
                sessionId: payload.tableSessionId,
                payload: [
                    "sessionId": payload.tableSessionId,
                    "course": payload.course,
                ]
            )

        case .lineVoided:
            var payload = try decoder.decode(PosSyncLineVoidedPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            payload.lineId = PosOrderLineIdMap.shared.resolve(payload.lineId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            var body: [String: Any] = [
                "sessionId": payload.tableSessionId,
                "lineId": payload.lineId,
                "quantity": payload.quantity,
                "voidReasonId": payload.voidReasonId,
                "wasFired": payload.wasFired,
            ]
            if let note = payload.note, !note.isEmpty { body["note"] = note }
            if let waiterProfileId = payload.waiterProfileId, !waiterProfileId.isEmpty {
                body["waiterProfileId"] = waiterProfileId
            }
            envelope = PosNestClient.eventEnvelope(
                type: "order.line_voided",
                idempotencyKey: payload.idempotencyKey,
                sessionId: payload.tableSessionId,
                payload: body
            )

        case .reservationSeated:
            var payload = try decoder.decode(PosSyncReservationSeatedPayload.self, from: item.payload)
            payload.localSessionId = PosSessionIdMap.shared.resolve(payload.localSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            envelope = PosNestClient.eventEnvelope(
                type: "reservation.seated",
                idempotencyKey: payload.idempotencyKey,
                sessionId: payload.localSessionId,
                payload: [
                    "reservationId": payload.reservationId,
                    "diningTableId": payload.diningTableId,
                    "tableId": payload.diningTableId,
                    "coverCount": payload.coverCount,
                    "localSessionId": payload.localSessionId,
                ]
            )

        case .moveSession:
            var payload = try decoder.decode(PosSyncMoveSessionPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            envelope = PosNestClient.eventEnvelope(
                type: "table.moved",
                idempotencyKey: "hub:session.move:\(payload.tableSessionId):\(payload.toTableId)",
                sessionId: payload.tableSessionId,
                payload: [
                    "sessionId": payload.tableSessionId,
                    "toTableId": payload.toTableId,
                    "targetDiningTableId": payload.toTableId,
                ]
            )

        case .releaseSession:
            var payload = try decoder.decode(PosSyncReleaseSessionPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            envelope = PosNestClient.eventEnvelope(
                type: "table.released",
                idempotencyKey: "hub:session.release:\(payload.tableSessionId)",
                sessionId: payload.tableSessionId,
                payload: [
                    "sessionId": payload.tableSessionId,
                ]
            )

        case .createReservation, .openRegister, .closeRegister:
            return
        }

        let response = try await PosNestClient.postEvents([envelope])
        guard let result = response.results.first else {
            throw PosCloudError.invalidResponse
        }
        switch result.status {
        case "applied", "duplicate":
            if item.kind == .openSession,
               let payload = try? decoder.decode(PosSyncOpenSessionPayload.self, from: item.payload),
               let remote = result.result?["sessionId"]?.stringValue
            {
                applySessionMapping(
                    localSessionId: payload.localSessionId,
                    cloudSessionId: remote,
                    working: &working,
                    afterIndex: index
                )
            }
            if item.kind == .reservationSeated,
               let payload = try? decoder.decode(PosSyncReservationSeatedPayload.self, from: item.payload),
               let remote = result.result?["sessionId"]?.stringValue
            {
                applySessionMapping(
                    localSessionId: payload.localSessionId,
                    cloudSessionId: remote,
                    working: &working,
                    afterIndex: index
                )
            }
            if item.kind == .createOrder,
               let payload = try? decoder.decode(PosSyncCreateOrderPayload.self, from: item.payload)
            {
                let cloudLines = Self.nestOrderLines(from: result.result)
                if !cloudLines.isEmpty {
                    applyLineMapping(
                        sessionId: payload.tableSessionId,
                        localLineIds: payload.resolvedLocalLineIds,
                        cloudLines: cloudLines,
                        working: &working,
                        afterIndex: index
                    )
                }
            }
            if item.kind == .collectCash,
               let payload = try? decoder.decode(PosSyncCollectCashPayload.self, from: item.payload),
               let receiptId = payload.receiptLocalId, !receiptId.isEmpty
            {
                let paymentId = payload.resolvedPaymentAttemptId
                    ?? result.result?["paymentId"]?.stringValue
                    ?? item.id
                PosOfflineCaches.markReceiptSynced(localId: receiptId, paymentId: paymentId)
            }
        case "rejected":
            throw PosCloudError.httpStatus(
                422,
                result.error ?? "nest_rejected:\(result.idempotencyKey)"
            )
        default:
            throw PosCloudError.httpStatus(500, "nest_status:\(result.status)")
        }
    }

    private static func nestOrderLines(
        from result: PosNestClient.NestJSONValue?
    ) -> [PosCloudClient.PosCloudCreateOrderResult.Line] {
        guard let linesVal = result?["lines"], case .array(let arr) = linesVal else { return [] }
        var out: [PosCloudClient.PosCloudCreateOrderResult.Line] = []
        for (idx, entry) in arr.enumerated() {
            guard case .object(let obj) = entry,
                  let id = obj["id"]?.stringValue, !id.isEmpty
            else { continue }
            let position: Int
            if case .number(let n) = obj["position"] {
                position = Int(n)
            } else {
                position = idx
            }
            let quantity: Int
            if case .number(let n) = obj["quantity"] {
                quantity = max(1, Int(n))
            } else {
                quantity = 1
            }
            out.append(
                PosCloudClient.PosCloudCreateOrderResult.Line(
                    id: id,
                    menuItemId: obj["menuItemId"]?.stringValue,
                    quantity: quantity,
                    position: position
                )
            )
        }
        return out.sorted { $0.position < $1.position }
    }

    private func processViaNext(
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
            try await PosCloudClient.collectCash(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                allocations: payload.allocations.map { ($0.orderLineId, $0.quantity) },
                tipCents: payload.tipCents,
                receivedAmountCents: payload.receivedAmountCents,
                paymentAttemptId: payload.resolvedPaymentAttemptId ?? item.id
            )
            if let receiptId = payload.receiptLocalId, !receiptId.isEmpty {
                let paymentId = payload.resolvedPaymentAttemptId ?? item.id
                PosOfflineCaches.markReceiptSynced(localId: receiptId, paymentId: paymentId)
            }

        case .fireCourse, .moveSession, .releaseSession:
            throw PosCloudError.missingConfig(
                "Nest-URL (für \(item.kind.rawValue); Next-Fallback fehlt)"
            )

        case .lineVoided:
            // V1 has no Next endpoint for line voids. Treat the local audit as the fallback
            // instead of permanently blocking or dead-lettering the FIFO queue.
            break

        case .reservationSeated:
            var payload = try decoder.decode(PosSyncReservationSeatedPayload.self, from: item.payload)
            payload.localSessionId = PosSessionIdMap.shared.resolve(payload.localSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            let cloudSessionId = try await PosCloudClient.seatReservation(
                restaurantId: payload.restaurantId,
                reservationId: payload.reservationId,
                diningTableId: payload.diningTableId,
                coverCount: payload.coverCount,
                localSessionId: payload.localSessionId,
                idempotencyKey: payload.idempotencyKey
            )
            applySessionMapping(
                localSessionId: payload.localSessionId,
                cloudSessionId: cloudSessionId,
                working: &working,
                afterIndex: index
            )

        case .createReservation, .openRegister, .closeRegister:
            break
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
        var copy = item
        switch item.kind {
        case .collectCash:
            guard var payload = try? decoder.decode(PosSyncCollectCashPayload.self, from: item.payload)
            else { return item }
            var changed = false
            payload.allocations = payload.allocations.map { alloc in
                guard let cloud = mappings[alloc.orderLineId] else { return alloc }
                changed = true
                return PosSyncCashAllocation(orderLineId: cloud, quantity: alloc.quantity)
            }
            guard changed, let data = try? encoder.encode(payload) else { return item }
            copy.payload = data
        case .lineVoided:
            guard var payload = try? decoder.decode(PosSyncLineVoidedPayload.self, from: item.payload),
                  let cloud = mappings[payload.lineId]
            else { return item }
            payload.lineId = cloud
            guard let data = try? encoder.encode(payload) else { return item }
            copy.payload = data
        default:
            return item
        }
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
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .fireCourse:
            guard var payload = try? decoder.decode(PosSyncFireCoursePayload.self, from: item.payload)
            else { return item }
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .lineVoided:
            guard var payload = try? decoder.decode(PosSyncLineVoidedPayload.self, from: item.payload)
            else { return item }
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .moveSession:
            guard var payload = try? decoder.decode(PosSyncMoveSessionPayload.self, from: item.payload)
            else { return item }
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .releaseSession:
            guard var payload = try? decoder.decode(PosSyncReleaseSessionPayload.self, from: item.payload)
            else { return item }
            if payload.tableSessionId == localSessionId {
                payload.tableSessionId = cloudSessionId
                if let data = try? encoder.encode(payload) {
                    copy.payload = data
                }
            }
        case .openSession, .createReservation, .openRegister, .closeRegister, .reservationSeated:
            break
        }
        return copy
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else {
            items = []
            deadLetters = []
            return
        }
        if let blob = try? decoder.decode(PersistBlob.self, from: data) {
            items = blob.items.filter { $0.deadLetteredAt == nil }
            deadLetters = blob.deadLetters + blob.items.filter { $0.deadLetteredAt != nil }
            return
        }
        // Legacy: nur Array aktiver Items.
        if let saved = try? decoder.decode([PosSyncQueueItem].self, from: data) {
            items = saved.filter { $0.deadLetteredAt == nil }
            deadLetters = saved.filter { $0.deadLetteredAt != nil }
            return
        }
        items = []
        deadLetters = []
    }

    private func persist() {
        let blob = PersistBlob(items: items, deadLetters: deadLetters)
        guard let data = try? encoder.encode(blob) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
