import Foundation

enum HandheldHubClientError: LocalizedError {
    case unreachable(URL)
    case invalidResponse
    case httpStatus(Int)
    /// Hub hard-reject (session gone / unpaired / invalid) — Outbox-Item droppen.
    case hubRejected(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .unreachable(let url):
            return "Kasse nicht erreichbar (\(url.absoluteString)). Gleiches WLAN?"
        case .invalidResponse:
            return "Ungültige Antwort von der Kasse."
        case .httpStatus(let code):
            return "Kasse antwortete mit HTTP \(code)."
        case .hubRejected(_, let message):
            return message
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

    private static func applyPairToken(_ token: String?, to request: inout URLRequest) {
        if let token, !token.isEmpty {
            request.setValue(token, forHTTPHeaderField: PosLanProtocol.headerPairToken)
        }
    }

    static func fetchHealth(baseURL: URL) async throws -> PosLanHealthResponse {
        let url = url(baseURL, path: PosLanProtocol.healthPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(PosLanHealthResponse.self, from: data)
    }

    static func fetchSnapshot(baseURL: URL, restaurantId: String?, pairToken: String? = nil) async throws -> PosLanHubSnapshot {
        let url = url(baseURL, path: PosLanProtocol.snapshotPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
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
        coverCount: Int,
        pairToken: String? = nil
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
        applyPairToken(pairToken, to: &request)
        request.httpBody = try encoder.encode(Body(diningTableId: diningTableId, coverCount: coverCount))
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(Response.self, from: data).sessionId
    }

    static func fetchReservationsDay(
        baseURL: URL,
        dayYmd: String,
        pairToken: String? = nil
    ) async throws -> PosReservationsDayDto {
        var components = URLComponents(
            url: url(baseURL, path: PosLanProtocol.reservationsPath),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "day", value: dayYmd)]
        guard let target = components?.url else { throw HandheldHubClientError.invalidResponse }
        var request = URLRequest(url: target)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(PosReservationsDayDto.self, from: data)
    }

    static func createReservation(
        baseURL: URL,
        payload: PosCreateReservationPayload,
        pairToken: String? = nil
    ) async throws -> PosCreateReservationResponse {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.reservationsPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
        request.httpBody = try encoder.encode(payload)
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
        return try decoder.decode(PosCreateReservationResponse.self, from: data)
    }

    static func createOrder(
        baseURL: URL,
        diningTableId: String,
        coverCount: Int,
        items: [(menuItemId: String, quantity: Int, notes: String?, course: Int, clientLineId: String)],
        pairToken: String? = nil,
        sessionId: String? = nil,
        eventId: String? = nil,
        requireExistingSession: Bool = false
    ) async throws {
        struct Item: Encodable {
            var menuItemId: String
            var quantity: Int
            var notes: String?
            var course: Int
            var clientLineId: String
        }
        struct Body: Encodable {
            var diningTableId: String
            var coverCount: Int
            var items: [Item]
            var sessionId: String?
            var eventId: String?
            var requireExistingSession: Bool
        }
        struct ErrorBody: Decodable { var error: String? }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.createOrderPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
        request.httpBody = try encoder.encode(Body(
            diningTableId: diningTableId,
            coverCount: coverCount,
            items: items.map {
                Item(
                    menuItemId: $0.menuItemId,
                    quantity: $0.quantity,
                    notes: $0.notes,
                    course: $0.course,
                    clientLineId: $0.clientLineId
                )
            },
            sessionId: sessionId,
            eventId: eventId,
            requireExistingSession: requireExistingSession
        ))
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        if http.statusCode == 200 { return }
        let message = (try? decoder.decode(ErrorBody.self, from: data))?.error
            ?? "HTTP \(http.statusCode)"
        if http.statusCode == 409 || http.statusCode == 422 || http.statusCode == 404 {
            throw HandheldHubClientError.hubRejected(status: http.statusCode, message: message)
        }
        throw HandheldHubClientError.httpStatus(http.statusCode)
    }

    static func collect(
        baseURL: URL,
        sessionId: String,
        lineIds: [String],
        method: String,
        tipCents: Int = 0,
        receivedAmountCents: Int? = nil,
        paymentAttemptId: String? = nil,
        pairToken: String? = nil
    ) async throws {
        struct Body: Encodable {
            var sessionId: String
            var lineIds: [String]
            var method: String
            var tipCents: Int
            var receivedAmountCents: Int?
            var paymentAttemptId: String?
        }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.collectPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
        request.httpBody = try encoder.encode(Body(
            sessionId: sessionId,
            lineIds: lineIds,
            method: method,
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents,
            paymentAttemptId: paymentAttemptId
        ))
        let (_, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 200 else { throw HandheldHubClientError.httpStatus(http.statusCode) }
    }

    static func requestPairing(baseURL: URL, request req: PosLanPairRequest) async throws -> PosLanPairChallenge {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.pairRequestPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        request.httpBody = try encoder.encode(req)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 201 || http.statusCode == 200 else {
            throw HandheldHubClientError.httpStatus(http.statusCode)
        }
        return try decoder.decode(PosLanPairChallenge.self, from: data)
    }

    static func pairingStatus(baseURL: URL, pairId: String) async throws -> PosLanPairStatus {
        let escaped = pairId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? pairId
        let target = URL(string: "\(url(baseURL, path: PosLanProtocol.pairStatusPath).absoluteString)?pairId=\(escaped)")!
        var request = URLRequest(url: target)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw HandheldHubClientError.invalidResponse
        }
        return try decoder.decode(PosLanPairStatus.self, from: data)
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
