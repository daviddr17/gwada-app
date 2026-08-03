import Foundation

/// Handheld → Hub Outbox (Phase 3). Überlebt App-Kill; kein Auto-Drop nach Zeit.
@MainActor
final class PosHandheldOutbox: ObservableObject {
    static let shared = PosHandheldOutbox()

    enum Kind: String, Codable, Sendable {
        case createOrder
    }

    struct Item: Codable, Identifiable, Equatable, Sendable {
        var id: String
        var kind: Kind
        var createdAt: String
        var payload: Data
        var attempts: Int
        var lastError: String?
    }

    struct CreateOrderPayload: Codable, Sendable {
        var eventId: String
        var diningTableId: String
        var sessionId: String
        var coverCount: Int
        var items: [OrderItem]

        struct OrderItem: Codable, Sendable {
            var menuItemId: String
            var quantity: Int
            var notes: String?
            var course: Int
            var clientLineId: String
            var name: String
            var unitPriceCents: Int
        }

        static func make(
            eventId: String = UUID().uuidString,
            diningTableId: String,
            sessionId: String,
            coverCount: Int,
            lines: [PosCartLine]
        ) -> CreateOrderPayload {
            CreateOrderPayload(
                eventId: eventId,
                diningTableId: diningTableId,
                sessionId: sessionId,
                coverCount: coverCount,
                items: lines.map {
                    OrderItem(
                        menuItemId: $0.menuItemId,
                        quantity: $0.quantity,
                        notes: $0.notes.isEmpty ? nil : $0.notes,
                        course: $0.course,
                        clientLineId: $0.id,
                        name: $0.name,
                        unitPriceCents: $0.unitPriceCents
                    )
                }
            )
        }

        var cartLines: [PosCartLine] {
            items.map { item in
                var line = PosCartLine(
                    menuItemId: item.menuItemId,
                    name: item.name,
                    unitPriceCents: item.unitPriceCents,
                    quantity: item.quantity,
                    course: item.course,
                    notes: item.notes ?? "",
                    modifiers: []
                )
                line.id = item.clientLineId
                return line
            }
        }
    }

    enum FlushOutcome: Equatable {
        case flushed(Int)
        case hardReject(eventId: String, error: String)
        case softFail(String)
        case empty
        case noHub
    }

    @Published private(set) var items: [Item] = []

    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("handheld-outbox.json")
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var isFlushing = false

    private init() {
        load()
    }

    var pendingCount: Int { items.count }

    var oldestCreatedAt: Date? {
        items.compactMap { ISO8601DateFormatter().date(from: $0.createdAt) }.min()
    }

    @discardableResult
    func enqueueCreateOrder(_ payload: CreateOrderPayload) -> String {
        let data = (try? encoder.encode(payload)) ?? Data()
        let item = Item(
            id: payload.eventId,
            kind: .createOrder,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            payload: data,
            attempts: 0,
            lastError: nil
        )
        // Idempotent: same eventId replaces prior stub.
        if let idx = items.firstIndex(where: { $0.id == payload.eventId }) {
            items[idx] = item
        } else {
            items.append(item)
        }
        persist()
        return payload.eventId
    }

    func clear() {
        items = []
        persist()
    }

    /// FIFO flush against live Hub. Stops on soft network error; hard reject removes item.
    func flushIfPossible(
        baseURL: URL,
        pairToken: String?,
        onHardReject: (_ eventId: String, _ error: String, _ payload: CreateOrderPayload) -> Void
    ) async -> FlushOutcome {
        guard !isFlushing else { return .softFail("flush_busy") }
        guard !items.isEmpty else { return .empty }
        isFlushing = true
        defer { isFlushing = false }

        var flushed = 0
        while !items.isEmpty {
            var item = items[0]
            switch item.kind {
            case .createOrder:
                guard let payload = try? decoder.decode(CreateOrderPayload.self, from: item.payload) else {
                    items.removeFirst()
                    persist()
                    continue
                }
                do {
                    try await HandheldHubClient.createOrder(
                        baseURL: baseURL,
                        diningTableId: payload.diningTableId,
                        coverCount: payload.coverCount,
                        items: payload.items.map {
                            (
                                menuItemId: $0.menuItemId,
                                quantity: $0.quantity,
                                notes: $0.notes,
                                course: $0.course,
                                clientLineId: $0.clientLineId
                            )
                        },
                        pairToken: pairToken,
                        sessionId: payload.sessionId,
                        eventId: payload.eventId,
                        requireExistingSession: true
                    )
                    items.removeFirst()
                    persist()
                    flushed += 1
                } catch let HandheldHubClientError.hubRejected(code, message) {
                    items.removeFirst()
                    persist()
                    onHardReject(payload.eventId, "\(code):\(message)", payload)
                    return .hardReject(eventId: payload.eventId, error: message)
                } catch {
                    item.attempts += 1
                    item.lastError = error.localizedDescription
                    items[0] = item
                    persist()
                    return .softFail(error.localizedDescription)
                }
            }
        }
        return flushed > 0 ? .flushed(flushed) : .empty
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? decoder.decode([Item].self, from: data)
        else {
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
