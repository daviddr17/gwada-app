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

    /// Liest `profiles.active_restaurant_id` (Fallback: erste aktive Employee-Zeile).
    @MainActor
    static func resolveActiveRestaurantId(userId: String) async throws -> String? {
        struct ProfileRow: Decodable { var active_restaurant_id: String? }
        struct EmployeeRow: Decodable { var restaurant_id: String }

        let anon = PosCloudConfig.supabaseAnonKey
        guard !anon.isEmpty else { throw PosCloudError.missingConfig("Supabase Anon Key") }
        let token = try await PosAuthStore.shared.validAccessToken()
        let base = PosCloudConfig.supabaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        // 1) active_restaurant_id
        if var comps = URLComponents(string: "\(base)/rest/v1/profiles") {
            comps.queryItems = [
                URLQueryItem(name: "select", value: "active_restaurant_id"),
                URLQueryItem(name: "id", value: "eq.\(userId)"),
                URLQueryItem(name: "limit", value: "1"),
            ]
            if let url = comps.url {
                var request = URLRequest(url: url)
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.setValue(anon, forHTTPHeaderField: "apikey")
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                if let rows: [ProfileRow] = try? await perform(request),
                   let rid = rows.first?.active_restaurant_id?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !rid.isEmpty
                {
                    return rid
                }
            }
        }

        // 2) restaurant_employees
        if var comps = URLComponents(string: "\(base)/rest/v1/restaurant_employees") {
            comps.queryItems = [
                URLQueryItem(name: "select", value: "restaurant_id"),
                URLQueryItem(name: "profile_id", value: "eq.\(userId)"),
                URLQueryItem(name: "is_active", value: "eq.true"),
                URLQueryItem(name: "limit", value: "1"),
            ]
            if let url = comps.url {
                var request = URLRequest(url: url)
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.setValue(anon, forHTTPHeaderField: "apikey")
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                if let rows: [EmployeeRow] = try? await perform(request),
                   let rid = rows.first?.restaurant_id.trimmingCharacters(in: .whitespacesAndNewlines),
                   !rid.isEmpty
                {
                    return rid
                }
            }
        }
        return nil
    }

    @MainActor
    static func fetchReservationsDay(
        restaurantId: String,
        dayYmd: String
    ) async throws -> PosReservationsDayDto {
        try await get(
            "/api/pos/reservations",
            restaurantId: restaurantId,
            extraQuery: ["day": dayYmd]
        )
    }

    @MainActor
    static func createReservation(
        payload: PosCreateReservationPayload
    ) async throws -> PosCreateReservationResponse {
        try await post("/api/pos/reservations", body: payload)
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

    struct PaymentMethodDto: Decodable, Identifiable, Sendable {
        var id: String
        var kind: String
        var label: String
        var sort_order: Int
        var is_active: Bool
        var is_system: Bool
        var collectable: Bool
        var fiscalClass: String
    }

    @MainActor
    static func fetchPaymentMethods(restaurantId: String) async throws -> [PaymentMethodDto] {
        struct Res: Decodable { var methods: [PaymentMethodDto] }
        let res: Res = try await get(
            "/api/pos/payment-methods?activeOnly=1",
            restaurantId: restaurantId
        )
        return res.methods.sorted { $0.sort_order < $1.sort_order }
    }

    @MainActor
    static func collectCustomMethod(
        restaurantId: String,
        tableSessionId: String,
        paymentMethodId: String,
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
            var paymentMethodId: String
            var allocations: [Allocation]
            var tipCents: Int
        }
        try await postVoid(
            "/api/pos/payments/collect-custom-allocations",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                paymentMethodId: paymentMethodId,
                allocations: allocations.map {
                    Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity)
                },
                tipCents: tipCents
            )
        )
    }

    @MainActor
    static func collectCash(
        restaurantId: String,
        tableSessionId: String,
        allocations: [(orderLineId: String, quantity: Int)],
        tipCents: Int = 0,
        receivedAmountCents: Int? = nil
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
            var receivedAmountCents: Int?
        }
        try await postVoid(
            "/api/pos/payments/collect-cash-allocations",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                allocations: allocations.map { Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity) },
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            )
        )
    }

    struct GiftVoucherLookupDto: Decodable, Sendable {
        var id: String
        var code: String
        var balanceCents: Int
        var initialAmountCents: Int
        var expiresAt: String
        var status: String
    }

    @MainActor
    static func lookupGiftVoucher(
        restaurantId: String,
        code: String
    ) async throws -> GiftVoucherLookupDto {
        struct Body: Encodable {
            var restaurantId: String
            var code: String
        }
        struct Res: Decodable {
            var voucher: GiftVoucherLookupDto
        }
        let res: Res = try await post(
            "/api/pos/gift-vouchers/lookup",
            body: Body(restaurantId: restaurantId, code: code)
        )
        return res.voucher
    }

    struct CollectVoucherResult: Decodable, Sendable {
        var paymentId: String
        var remainingVoucherCents: Int
        var voucherCode: String
    }

    @MainActor
    static func collectVoucher(
        restaurantId: String,
        tableSessionId: String,
        giftVoucherId: String,
        allocations: [(orderLineId: String, quantity: Int)],
        tipCents: Int = 0
    ) async throws -> CollectVoucherResult {
        struct Allocation: Encodable {
            var orderLineId: String
            var quantity: Int
        }
        struct Body: Encodable {
            var restaurantId: String
            var tableSessionId: String
            var giftVoucherId: String
            var allocations: [Allocation]
            var tipCents: Int
        }
        return try await post(
            "/api/pos/payments/collect-voucher-allocations",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                giftVoucherId: giftVoucherId,
                allocations: allocations.map {
                    Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity)
                },
                tipCents: tipCents
            )
        )
    }

    struct IssuedGiftVoucherDto: Decodable, Sendable {
        var id: String
        var code: String
        var balanceCents: Int
        var initialAmountCents: Int
        var expiresAt: String
    }

    @MainActor
    static func issueGiftVoucher(
        restaurantId: String,
        amountCents: Int
    ) async throws -> IssuedGiftVoucherDto {
        struct Body: Encodable {
            var restaurantId: String
            var amountCents: Int
        }
        struct Res: Decodable {
            var voucher: VoucherBody
            struct VoucherBody: Decodable {
                var id: String
                var code: String
                var balance_cents: Int
                var initial_amount_cents: Int
                var expires_at: String
            }
        }
        let res: Res = try await post(
            "/api/pos/gift-vouchers",
            body: Body(restaurantId: restaurantId, amountCents: amountCents)
        )
        return IssuedGiftVoucherDto(
            id: res.voucher.id,
            code: res.voucher.code,
            balanceCents: res.voucher.balance_cents,
            initialAmountCents: res.voucher.initial_amount_cents,
            expiresAt: res.voucher.expires_at
        )
    }

    struct PosTodayReceiptDto: Decodable, Identifiable, Sendable {
        var paymentId: String
        var orderId: String
        var orderNumber: Int
        var tableSessionId: String
        var tableLabel: String
        var diningTableId: String
        var sessionStatus: String
        var method: String
        var status: String
        var amountCents: Int
        var tipCents: Int
        var receivedAmountCents: Int?
        var paidAt: String?
        var canVoidCash: Bool

        var id: String { paymentId }
    }

    @MainActor
    static func fetchTodayReceipts(restaurantId: String) async throws -> [PosTodayReceiptDto] {
        struct Res: Decodable { var receipts: [PosTodayReceiptDto] }
        let res: Res = try await get("/api/pos/receipts/today", restaurantId: restaurantId)
        return res.receipts
    }

    struct PosVoidReasonDto: Decodable, Identifiable, Sendable, Hashable {
        var id: String
        var name: String
        var restoreInventory: Bool
        var sortOrder: Int
        var isActive: Bool
    }

    @MainActor
    static func fetchVoidReasons(restaurantId: String) async throws -> [PosVoidReasonDto] {
        struct Res: Decodable { var reasons: [PosVoidReasonDto] }
        let res: Res = try await get("/api/pos/void-reasons", restaurantId: restaurantId)
        return res.reasons.filter(\.isActive).sorted { $0.sortOrder < $1.sortOrder }
    }

    @MainActor
    static func voidCashPayment(
        restaurantId: String,
        paymentId: String,
        reopenTable: Bool = true,
        voidReasonId: String? = nil
    ) async throws -> (reopened: Bool, tableSessionId: String, inventoryRestored: Bool) {
        struct Body: Encodable {
            var restaurantId: String
            var reopenTable: Bool
            var voidReasonId: String?
        }
        struct Res: Decodable {
            var reopened: Bool
            var tableSessionId: String
            var inventoryRestored: Bool?
        }
        let res: Res = try await post(
            "/api/pos/payments/\(paymentId)/void-cash",
            body: Body(
                restaurantId: restaurantId,
                reopenTable: reopenTable,
                voidReasonId: voidReasonId
            )
        )
        return (res.reopened, res.tableSessionId, res.inventoryRestored ?? false)
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
        var statuses: [PosCloudKdsStatus]?
        struct KdsTicketDto: Decodable {
            var orderId: String
            var orderNumber: Int
            var status: String
            var statusId: String?
            var statusName: String?
            var statusColor: String?
            var lines: [KdsLineDto]
        }
        struct KdsLineDto: Decodable {
            var id: String
            var name: String
            var quantity: Int
            var course: String?
            var notes: String?
            var modifiers: [PosCloudModifierDecoded]?
            var detail: String?
        }
    }

    struct KdsAdvanceResponse: Decodable {
        var ok: Bool?
        var done: Bool?
        var printRequested: Bool?
        var printerIds: [String]?
        var orderNumber: Int?
        var lines: [KdsAdvanceLine]?
        var ticket: KdsAdvanceTicket?
        struct KdsAdvanceLine: Decodable {
            var id: String
            var name: String
            var quantity: Int
            var course: String?
            var notes: String?
            var detail: String?
        }
        struct KdsAdvanceTicket: Decodable {
            var orderId: String?
            var orderNumber: Int?
            var status: String?
            var statusId: String?
            var statusName: String?
            var statusColor: String?
        }
    }

    @MainActor
    static func fetchKdsTickets(restaurantId: String, deviceId: String? = nil) async throws -> KdsTicketsResponse {
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
    static func advanceKdsTicket(
        restaurantId: String,
        orderId: String,
        deviceId: String? = nil
    ) async throws -> KdsAdvanceResponse {
        struct Body: Encodable {
            var restaurantId: String
            var orderId: String
            var deviceId: String?
        }
        return try await post(
            "/api/pos/kds/tickets/advance",
            body: Body(restaurantId: restaurantId, orderId: orderId, deviceId: deviceId)
        )
    }

    @MainActor
    private static func get<T: Decodable>(
        _ path: String,
        restaurantId: String?,
        extraQuery: [String: String] = [:]
    ) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: restaurantId, extraQuery: extraQuery))
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

    private static func url(
        _ path: String,
        restaurantId: String?,
        extraQuery: [String: String] = [:]
    ) -> URL {
        let base = PosCloudConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var full = "\(base)\(path.hasPrefix("/") ? path : "/\(path)")"
        var parts: [String] = []
        if let restaurantId {
            let enc = restaurantId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurantId
            parts.append("restaurantId=\(enc)")
        }
        for (key, value) in extraQuery {
            let k = key.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? key
            let v = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
            parts.append("\(k)=\(v)")
        }
        if !parts.isEmpty {
            full += (full.contains("?") ? "&" : "?") + parts.joined(separator: "&")
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
