import Foundation

enum PosSyncQueueItemKind: String, Codable, Sendable {
    case openSession
    case createOrder
    case collectCash
    case fireCourse
    case moveSession
    case releaseSession
    case createReservation
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
}

struct PosSyncOrderItem: Codable, Sendable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
}

struct PosSyncCollectCashPayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var allocations: [PosSyncCashAllocation]
    var tipCents: Int
    var receivedAmountCents: Int?
}

struct PosSyncCashAllocation: Codable, Sendable {
    var orderLineId: String
    var quantity: Int
}

struct PosSyncFireCoursePayload: Codable, Sendable {
    var restaurantId: String
    var tableSessionId: String
    var course: String
    var fireAttemptId: String
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

    func enqueueFireCourse(_ payload: PosSyncFireCoursePayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .fireCourse,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueMoveSession(_ payload: PosSyncMoveSessionPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .moveSession,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        ))
    }

    func enqueueReleaseSession(_ payload: PosSyncReleaseSessionPayload) {
        var resolved = payload
        resolved.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
        let data = (try? encoder.encode(resolved)) ?? Data()
        enqueue(PosSyncQueueItem(
            id: UUID().uuidString,
            kind: .releaseSession,
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

    func flushIfPossible() async {
        guard !isFlushing, !items.isEmpty else { return }
        guard PosAuthStore.shared.isSignedIn else {
            lastFlushMessage = "Sync wartet auf Login."
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
            ? "\(synced) Vorgang(e) synchronisiert\(PosCloudConfig.nestSyncEnabled ? " (Nest)" : "")."
            : (remaining.isEmpty ? "Queue leer." : "Sync ausstehend (\(remaining.count)).")
    }

    private func process(
        _ item: inout PosSyncQueueItem,
        working: inout [PosSyncQueueItem],
        index: Int
    ) async throws {
        switch item.kind {
        case .openSession, .createOrder, .collectCash, .fireCourse, .moveSession, .releaseSession:
            if PosCloudConfig.nestSyncEnabled {
                try await processViaNest(&item, working: &working, index: index)
            } else {
                try await processViaNext(&item, working: &working, index: index)
            }
        case .createReservation:
            let payload = try decoder.decode(PosCreateReservationPayload.self, from: item.payload)
            _ = try await PosCloudClient.createReservation(payload: payload)
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
                if let notes = item.notes, !notes.isEmpty { row["notes"] = notes }
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
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            var body: [String: Any] = [
                "sessionId": payload.tableSessionId,
                "method": "cash",
                "tipCents": payload.tipCents,
                "settlementMode": "item",
                "allocations": payload.allocations.map {
                    ["orderLineId": $0.orderLineId, "quantity": $0.quantity]
                },
            ]
            if let received = payload.receivedAmountCents {
                body["receivedAmountCents"] = received
            }
            envelope = PosNestClient.eventEnvelope(
                type: "payment.completed",
                idempotencyKey: "hub:payment:\(item.id)",
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

        case .createReservation:
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
        case "rejected":
            throw PosCloudError.httpStatus(
                422,
                result.error ?? "nest_rejected:\(result.idempotencyKey)"
            )
        default:
            throw PosCloudError.httpStatus(500, "nest_status:\(result.status)")
        }
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
            _ = try await PosCloudClient.createOrder(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                items: payload.items.map {
                    PosCloudOrderItem(
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes
                    )
                }
            )

        case .collectCash:
            var payload = try decoder.decode(PosSyncCollectCashPayload.self, from: item.payload)
            payload.tableSessionId = PosSessionIdMap.shared.resolve(payload.tableSessionId)
            item.payload = (try? encoder.encode(payload)) ?? item.payload
            try await PosCloudClient.collectCash(
                restaurantId: payload.restaurantId,
                tableSessionId: payload.tableSessionId,
                allocations: payload.allocations.map { ($0.orderLineId, $0.quantity) },
                tipCents: payload.tipCents,
                receivedAmountCents: payload.receivedAmountCents
            )

        case .fireCourse, .moveSession, .releaseSession:
            throw PosCloudError.missingConfig(
                "Nest-URL (für \(item.kind.rawValue); Next-Fallback fehlt)"
            )

        case .createReservation:
            break
        }
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
        case .openSession, .createReservation:
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
