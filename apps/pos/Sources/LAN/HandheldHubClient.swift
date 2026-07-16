import Foundation

enum HandheldHubClientError: LocalizedError {
    case unreachable(URL)
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .unreachable(let url):
            return "Kasse nicht erreichbar (\(url.absoluteString)). Gleiches WLAN?"
        case .invalidResponse:
            return "Ungültige Antwort von der Kasse."
        case .httpStatus(let code):
            return "Kasse antwortete mit HTTP \(code)."
        }
    }
}

enum HandheldHubClient {
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 12
        return URLSession(configuration: config)
    }()

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    static func fetchHealth(baseURL: URL) async throws -> PosLanHealthResponse {
        let url = url(baseURL, path: PosLanProtocol.healthPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(PosLanHealthResponse.self, from: data)
    }

    static func fetchSnapshot(baseURL: URL, restaurantId: String?) async throws -> PosLanHubSnapshot {
        let url = url(baseURL, path: PosLanProtocol.snapshotPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        if let restaurantId {
            request.setValue(restaurantId, forHTTPHeaderField: PosLanProtocol.headerRestaurantId)
        }
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(PosLanHubSnapshot.self, from: data)
    }

    static func openSession(
        baseURL: URL,
        diningTableId: String,
        coverCount: Int
    ) async throws -> String {
        struct Body: Encodable {
            var diningTableId: String
            var coverCount: Int
        }
        struct Response: Decodable { var sessionId: String }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.openSessionPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        request.httpBody = try encoder.encode(Body(diningTableId: diningTableId, coverCount: coverCount))
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(Response.self, from: data).sessionId
    }

    static func createOrder(
        baseURL: URL,
        diningTableId: String,
        coverCount: Int,
        items: [(menuItemId: String, quantity: Int)]
    ) async throws {
        struct Item: Encodable {
            var menuItemId: String
            var quantity: Int
        }
        struct Body: Encodable {
            var diningTableId: String
            var coverCount: Int
            var items: [Item]
        }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.createOrderPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        request.httpBody = try encoder.encode(Body(
            diningTableId: diningTableId,
            coverCount: coverCount,
            items: items.map { Item(menuItemId: $0.menuItemId, quantity: $0.quantity) }
        ))
        let (_, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
    }

    private static func url(_ base: URL, path: String) -> URL {
        URL(string: path, relativeTo: base)?.absoluteURL ?? base.appendingPathComponent(path)
    }

    private static func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw HandheldHubClientError.unreachable(request.url ?? URL(string: "http://invalid")!)
        }
    }
}
