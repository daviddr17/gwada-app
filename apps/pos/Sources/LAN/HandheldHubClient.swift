import Foundation

enum HandheldHubClientError: LocalizedError {
    case unreachable(URL)
    case invalidResponse
    case httpStatus(Int, String?)
    case notSignedIn
    case missingLanSecret
    case hubRequired

    var errorDescription: String? {
        switch self {
        case .unreachable(let url):
            return "Kasse nicht erreichbar (\(url.absoluteString)). Gleiches WLAN?"
        case .invalidResponse:
            return "Ungültige Antwort von der Kasse."
        case .httpStatus(let code, let body):
            return "Kasse HTTP \(code)\(body.map { ": \($0.prefix(80))" } ?? "")."
        case .notSignedIn:
            return "Bitte mit Display-PIN anmelden."
        case .missingLanSecret:
            return "LAN-Kopplung unvollständig — Gerät erneut koppeln."
        case .hubRequired:
            return "Handgerät nur mit erreichbarer iPad-Kasse nutzbar."
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

    @MainActor
    private static func applyAuth(to request: inout URLRequest, requireStaff: Bool) throws {
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        guard let secret = PosAuthStore.shared.lanSharedSecret, !secret.isEmpty else {
            throw HandheldHubClientError.missingLanSecret
        }
        request.setValue(secret, forHTTPHeaderField: PosLanProtocol.headerLanSecret)
        if let restaurantId = PosAuthStore.shared.restaurantId {
            request.setValue(restaurantId, forHTTPHeaderField: PosLanProtocol.headerRestaurantId)
        }
        if requireStaff {
            guard let staff = PosAuthStore.shared.pinSession else {
                throw HandheldHubClientError.notSignedIn
            }
            request.setValue(staff.staffId, forHTTPHeaderField: PosLanProtocol.headerStaffId)
            request.setValue(staff.staffName, forHTTPHeaderField: PosLanProtocol.headerStaffName)
        }
    }

    static func fetchHealth(baseURL: URL) async throws -> PosLanHealthResponse {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.healthPath))
        try await MainActor.run { try applyAuth(to: &request, requireStaff: false) }
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return try decoder.decode(PosLanHealthResponse.self, from: data)
    }

    static func fetchSnapshot(baseURL: URL) async throws -> PosLanHubSnapshot {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.snapshotPath))
        try await MainActor.run { try applyAuth(to: &request, requireStaff: false) }
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
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
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        request.httpBody = try encoder.encode(Body(diningTableId: diningTableId, coverCount: coverCount))
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return try decoder.decode(Response.self, from: data).sessionId
    }

    static func createOrder(
        baseURL: URL,
        diningTableId: String,
        coverCount: Int,
        items: [PosLanOrderItem]
    ) async throws {
        struct Body: Encodable {
            var diningTableId: String
            var coverCount: Int
            var items: [PosLanOrderItem]
        }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.createOrderPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        request.httpBody = try encoder.encode(Body(
            diningTableId: diningTableId,
            coverCount: coverCount,
            items: items
        ))
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
    }

    static func fetchSessionSummary(
        baseURL: URL,
        sessionId: String
    ) async throws -> [SessionOpenLine] {
        struct Response: Decodable { var lines: [PosLanOpenLineDto] }
        var components = URLComponents(
            url: url(baseURL, path: PosLanProtocol.sessionSummaryPath),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "sessionId", value: sessionId)]
        guard let target = components?.url else { throw HandheldHubClientError.invalidResponse }
        var request = URLRequest(url: target)
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        let res = try decoder.decode(Response.self, from: data)
        return res.lines.map {
            SessionOpenLine(
                id: $0.id,
                orderLineId: $0.orderLineId,
                name: $0.name,
                openQuantity: $0.openQuantity,
                openCents: $0.openCents,
                detail: $0.detail ?? ""
            )
        }
    }

    static func collectCash(
        baseURL: URL,
        sessionId: String,
        allocations: [(orderLineId: String, quantity: Int)],
        tipCents: Int,
        receivedAmountCents: Int?
    ) async throws -> PosLanCashResult {
        struct Allocation: Encodable {
            var orderLineId: String
            var quantity: Int
        }
        struct Body: Encodable {
            var sessionId: String
            var allocations: [Allocation]
            var tipCents: Int
            var receivedAmountCents: Int?
        }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.collectCashPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        request.httpBody = try encoder.encode(Body(
            sessionId: sessionId,
            allocations: allocations.map { Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity) },
            tipCents: tipCents,
            receivedAmountCents: receivedAmountCents
        ))
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return try decoder.decode(PosLanCashResult.self, from: data)
    }

    static func fetchReservationsDay(
        baseURL: URL,
        dayYmd: String
    ) async throws -> PosReservationsDayDto {
        var components = URLComponents(
            url: url(baseURL, path: PosLanProtocol.reservationsPath),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "day", value: dayYmd)]
        guard let target = components?.url else { throw HandheldHubClientError.invalidResponse }
        var request = URLRequest(url: target)
        try await MainActor.run { try applyAuth(to: &request, requireStaff: false) }
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return try decoder.decode(PosReservationsDayDto.self, from: data)
    }

    static func createReservation(
        baseURL: URL,
        payload: PosCreateReservationPayload
    ) async throws -> PosCreateReservationResponse {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.reservationsPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        request.httpBody = try encoder.encode(payload)
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return try decoder.decode(PosCreateReservationResponse.self, from: data)
    }

    static func fetchKdsTickets(baseURL: URL, deviceId: String?) async throws -> Data {
        var components = URLComponents(
            url: url(baseURL, path: PosLanProtocol.kdsTicketsPath),
            resolvingAgainstBaseURL: false
        )
        if let deviceId, !deviceId.isEmpty {
            components?.queryItems = [URLQueryItem(name: "deviceId", value: deviceId)]
        }
        guard let target = components?.url else { throw HandheldHubClientError.invalidResponse }
        var request = URLRequest(url: target)
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return data
    }

    static func advanceKdsTicket(baseURL: URL, orderId: String) async throws -> Data {
        struct Body: Encodable { var orderId: String }
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.kdsAdvancePath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await MainActor.run { try applyAuth(to: &request, requireStaff: true) }
        request.httpBody = try encoder.encode(Body(orderId: orderId))
        let (data, response) = try await perform(request)
        try throwIfNeeded(response, data: data)
        return data
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

    private static func throwIfNeeded(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw HandheldHubClientError.invalidResponse
        }
        guard (200 ... 299).contains(http.statusCode) else {
            throw HandheldHubClientError.httpStatus(
                http.statusCode,
                String(data: data, encoding: .utf8)
            )
        }
    }
}

struct PosLanOrderItem: Codable, Sendable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: String?
    var name: String?
    var unitPriceCents: Int?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]?
}

struct PosLanOpenLineDto: Codable, Sendable {
    var id: String
    var orderLineId: String
    var name: String
    var openQuantity: Int
    var openCents: Int
    var detail: String?
}

struct PosLanCashResult: Codable, Sendable {
    var ok: Bool
    var fiscalPending: Bool
    var message: String?
}
