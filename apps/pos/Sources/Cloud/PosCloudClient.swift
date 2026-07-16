import Foundation

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
        items: [(menuItemId: String, quantity: Int, notes: String?)]
    ) async throws -> String {
        struct Item: Encodable {
            var menuItemId: String
            var quantity: Int
            var notes: String?
        }
        struct Body: Encodable {
            var restaurantId: String
            var tableSessionId: String
            var items: [Item]
        }
        struct Response: Decodable { var orderId: String }
        let res: Response = try await post(
            "/api/pos/orders",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                items: items.map { Item(menuItemId: $0.menuItemId, quantity: $0.quantity, notes: $0.notes) }
            )
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
        let (_, response) = try await performRaw(request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.invalidResponse
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
