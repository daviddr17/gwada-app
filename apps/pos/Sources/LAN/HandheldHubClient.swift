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
        config.timeoutIntervalForRequest = 6
        config.timeoutIntervalForResource = 8
        return URLSession(configuration: config)
    }()

    static func fetchHealth(baseURL: URL) async throws -> PosLanHealthResponse {
        let url = url(baseURL, path: PosLanProtocol.healthPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try JSONDecoder().decode(PosLanHealthResponse.self, from: data)
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
        return try JSONDecoder().decode(PosLanHubSnapshot.self, from: data)
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
