import Foundation

struct PosCloudOrderItem: Encodable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: String?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]?
}

struct PosCloudModifierPayload: Encodable {
    var type: String
    var label: String
    var ingredientId: String?
    var optionChoiceId: String?
    var priceDeltaCents: Int?
}

struct PosCloudSessionSummaryLine: Decodable, Identifiable {
    var id: String
    var orderId: String
    var name: String
    var quantity: Int
    var paidQuantity: Int
    var openQuantity: Int
    var openAmountCents: Int
    var unitPriceCents: Int
    var notes: String?
    var course: String?
    var modifiers: [PosCloudModifierDecoded]?
    var ohneIngredientIds: [String]?
}

struct PosCloudModifierDecoded: Decodable {
    var type: String?
    var label: String?
}

struct PosCloudSessionSummary: Decodable {
    var lines: [PosCloudSessionSummaryLine]?
    // API wraps as { summary: { lines: ... } } — handle both
}

struct PosCloudSessionSummaryEnvelope: Decodable {
    var summary: Summary
    struct Summary: Decodable {
        var lines: [PosCloudSessionSummaryLine]
    }
}

enum PosCloudClient {
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    @MainActor
    static func fetchBootstrap(restaurantId: String) async throws -> PosCloudBootstrap {
        try await get("/api/pos/bootstrap", restaurantId: restaurantId)
    }

    @MainActor
    static func openTableSession(
        restaurantId: String,
        diningTableId: String,
        coverCount: Int
    ) async throws -> String {
        struct Body: Encodable {
            var restaurantId: String
            var diningTableId: String
            var coverCount: Int
        }
        struct Response: Decodable { var sessionId: String }
        let res: Response = try await post(
            "/api/pos/table-sessions",
            body: Body(restaurantId: restaurantId, diningTableId: diningTableId, coverCount: coverCount)
        )
        return res.sessionId
    }

    @MainActor
    static func createOrder(
        restaurantId: String,
        tableSessionId: String,
        items: [PosCloudOrderItem]
    ) async throws -> String {
        struct Body: Encodable {
            var restaurantId: String
            var tableSessionId: String
            var items: [PosCloudOrderItem]
        }
        struct Response: Decodable { var orderId: String }
        let res: Response = try await post(
            "/api/pos/orders",
            body: Body(restaurantId: restaurantId, tableSessionId: tableSessionId, items: items)
        )
        return res.orderId
    }

    @MainActor
    static func collectCash(
        restaurantId: String,
        tableSessionId: String,
        allocations: [(orderLineId: String, quantity: Int)],
        tipCents: Int = 0
    ) async throws {
        struct Allocation: Encodable {
            var orderLineId: String
            var quantity: Int
        }
        struct Body: Encodable {
            var restaurantId: String
            var tableSessionId: String
            var allocations: [Allocation]
            var tipCents: Int
        }
        try await postVoid(
            "/api/pos/payments/collect-cash-allocations",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                allocations: allocations.map { Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity) },
                tipCents: tipCents
            )
        )
    }

    @MainActor
    static func moveLines(
        restaurantId: String,
        targetTableSessionId: String,
        lineMoves: [(orderLineId: String, quantity: Int)]
    ) async throws {
        struct Move: Encodable {
            var orderLineId: String
            var quantity: Int
        }
        struct Body: Encodable {
            var restaurantId: String
            var targetTableSessionId: String
            var lineMoves: [Move]
        }
        try await postVoid(
            "/api/pos/order-lines/move",
            body: Body(
                restaurantId: restaurantId,
                targetTableSessionId: targetTableSessionId,
                lineMoves: lineMoves.map { Move(orderLineId: $0.orderLineId, quantity: $0.quantity) }
            )
        )
    }

    @MainActor
    static func fetchSessionSummary(
        restaurantId: String,
        sessionId: String
    ) async throws -> [PosCloudSessionSummaryLine] {
        let path = "/api/pos/table-sessions/\(sessionId)/summary"
        let env: PosCloudSessionSummaryEnvelope = try await get(path, restaurantId: restaurantId)
        return env.summary.lines
    }

    struct KdsTicketsResponse: Decodable {
        var tickets: [KdsTicketDto]
        struct KdsTicketDto: Decodable {
            var orderId: String
            var orderNumber: Int
            var status: String
            var lines: [KdsLineDto]
        }
        struct KdsLineDto: Decodable {
            var id: String
            var name: String
            var quantity: Int
            var course: String?
            var notes: String?
            var modifiers: [PosCloudModifierDecoded]?
        }
    }

    @MainActor
    static func fetchKdsTickets(restaurantId: String, deviceId: String? = nil) async throws -> KdsTicketsResponse {
        var path = "/api/pos/kds/tickets"
        if let deviceId, !deviceId.isEmpty {
            path += path.contains("?") ? "&" : "?"
            // restaurantId added in get(); append deviceId manually after
        }
        // Build URL with both query params
        let base = PosCloudConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var full = "\(base)/api/pos/kds/tickets?restaurantId=\(restaurantId)"
        if let deviceId, !deviceId.isEmpty {
            full += "&deviceId=\(deviceId)"
        }
        var request = URLRequest(url: URL(string: full)!)
        request.httpMethod = "GET"
        let token = try await PosAuthStore.shared.validAccessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.invalidResponse
        }
        return try decoder.decode(KdsTicketsResponse.self, from: data)
    }

    @MainActor
    private static func get<T: Decodable>(_ path: String, restaurantId: String?) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: restaurantId))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await PosAuthStore.shared.validAccessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try await perform(request)
    }

    @MainActor
    private static func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await PosAuthStore.shared.validAccessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    @MainActor
    private static func postVoid<B: Encodable>(_ path: String, body: B) async throws {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await PosAuthStore.shared.validAccessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await performRaw(request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.httpStatus(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                String(data: data, encoding: .utf8)
            )
        }
    }

    private static func url(_ path: String, restaurantId: String?) -> URL {
        let base = PosCloudConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var full = "\(base)\(path.hasPrefix("/") ? path : "/\(path)")"
        if let restaurantId {
            full += (full.contains("?") ? "&" : "?") + "restaurantId=\(restaurantId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurantId)"
        }
        return URL(string: full)!
    }

    private static func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await performRaw(request)
        guard let http = response as? HTTPURLResponse else { throw PosCloudError.invalidResponse }
        guard (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.httpStatus(http.statusCode, String(data: data, encoding: .utf8))
        }
        return try decoder.decode(T.self, from: data)
    }

    private static func performRaw(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw PosCloudError.offline
        }
    }
}
