import Foundation

/// NestJS POS-API Client (Phase 2+/3) — Hub-Outbox → `POST /v1/sync/events`.
enum PosNestClient {
    struct SyncResultItem: Decodable, Sendable {
        var idempotencyKey: String
        var status: String
        var result: NestJSONValue?
        var error: String?
    }

    struct SyncResponse: Decodable, Sendable {
        var results: [SyncResultItem]
    }

    /// JSON-Wert ohne externe Dependency (Nest result payload).
    enum NestJSONValue: Decodable, Sendable {
        case string(String)
        case number(Double)
        case bool(Bool)
        case object([String: NestJSONValue])
        case array([NestJSONValue])
        case null

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if c.decodeNil() { self = .null; return }
            if let b = try? c.decode(Bool.self) { self = .bool(b); return }
            if let n = try? c.decode(Double.self) { self = .number(n); return }
            if let s = try? c.decode(String.self) { self = .string(s); return }
            if let o = try? c.decode([String: NestJSONValue].self) { self = .object(o); return }
            if let a = try? c.decode([NestJSONValue].self) { self = .array(a); return }
            self = .null
        }

        var stringValue: String? {
            if case .string(let s) = self { return s }
            return nil
        }

        subscript(key: String) -> NestJSONValue? {
            if case .object(let o) = self { return o[key] }
            return nil
        }
    }

    static func postEvents(_ events: [[String: Any]]) async throws -> SyncResponse {
        guard PosCloudConfig.nestSyncEnabled else {
            throw PosCloudError.missingConfig("Nest API-Basis")
        }
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            throw PosCloudError.missingRestaurant
        }

        let waiterId: String
        if let configured = PosCloudConfig.waiterProfileId, !configured.isEmpty {
            waiterId = configured
        } else if let fromAuth = await MainActor.run(body: { PosAuthStore.shared.session?.userId }),
                  !fromAuth.isEmpty
        {
            waiterId = fromAuth
        } else {
            throw PosCloudError.missingConfig("Waiter Profile-ID")
        }

        let url = PosCloudConfig.nestApiBaseURL!
            .appendingPathComponent("v1")
            .appendingPathComponent("sync")
            .appendingPathComponent("events")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(restaurantId, forHTTPHeaderField: "X-Restaurant-Id")
        request.setValue(waiterId, forHTTPHeaderField: "X-Waiter-Profile-Id")
        request.setValue(PosDeviceIdentity.id, forHTTPHeaderField: "X-Device-Id")

        let body: [String: Any] = ["events": events]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw PosCloudError.offline
        }

        guard let http = response as? HTTPURLResponse else {
            throw PosCloudError.invalidResponse
        }
        guard (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.httpStatus(http.statusCode, String(data: data, encoding: .utf8))
        }

        return try JSONDecoder().decode(SyncResponse.self, from: data)
    }

    static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    static func eventEnvelope(
        type: String,
        idempotencyKey: String,
        sessionId: String? = nil,
        payload: [String: Any]
    ) -> [String: Any] {
        var ev: [String: Any] = [
            "eventId": UUID().uuidString,
            "idempotencyKey": idempotencyKey,
            "type": type,
            "ts": isoNow(),
            "schemaVersion": 1,
            "payload": payload,
        ]
        if let sessionId, !sessionId.isEmpty {
            ev["sessionId"] = sessionId
        }
        return ev
    }
}
