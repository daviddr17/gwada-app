import Foundation

struct PosCloudOrderItem: Encodable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: String?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]?
}

struct PosCloudModifierPayload: Codable, Sendable {
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

    struct RegisterStatusDto: Decodable, Sendable {
        var isOpen: Bool
        var sessionId: String?
        var openedAt: String?
        var openingCashCents: Int?
        var lastClosingZNr: Int?
        var lastClosingAt: String?
        var suggestedOpeningCashCents: Int?
        var aggregate: Aggregate?

        struct Aggregate: Decodable, Sendable {
            var expectedCashCents: Int?
            var cashSalesCents: Int?
            var tipCashCents: Int?
        }
    }

    struct RegisterOpenResult: Decodable, Sendable {
        var ok: Bool?
        var sessionId: String?
        var alreadyOpen: Bool?
    }

    struct RegisterCloseResult: Decodable, Sendable {
        var ok: Bool?
        var sessionId: String?
        var zNr: Int?
    }

    @MainActor
    static func fetchRegisterStatus() async throws -> RegisterStatusDto {
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            throw PosCloudError.httpStatus(400, "restaurant_id_missing")
        }
        return try await get(
            "/api/pos/fiskaly/register/status",
            restaurantId: restaurantId
        )
    }

    @MainActor
    static func openRegister(openingCashCents: Int) async throws -> RegisterOpenResult {
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            throw PosCloudError.httpStatus(400, "restaurant_id_missing")
        }
        struct Body: Encodable {
            var openingCashCents: Int
        }
        return try await post(
            "/api/pos/fiskaly/register/open?restaurantId=\(restaurantId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurantId)",
            body: Body(openingCashCents: openingCashCents)
        )
    }

    @MainActor
    static func closeRegister(closingCashCents: Int) async throws -> RegisterCloseResult {
        guard let restaurantId = PosCloudConfig.restaurantId, !restaurantId.isEmpty else {
            throw PosCloudError.httpStatus(400, "restaurant_id_missing")
        }
        struct Body: Encodable {
            var closingCashCents: Int
        }
        return try await post(
            "/api/pos/fiskaly/register/close?restaurantId=\(restaurantId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurantId)",
            body: Body(closingCashCents: closingCashCents)
        )
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
    ) async throws -> PosCloudCreateOrderResult {
        struct Body: Encodable {
            var restaurantId: String
            var tableSessionId: String
            var items: [PosCloudOrderItem]
        }
        let res: PosCloudCreateOrderResult = try await post(
            "/api/pos/orders",
            body: Body(restaurantId: restaurantId, tableSessionId: tableSessionId, items: items)
        )
        return res
    }

    struct PosCloudCreateOrderResult: Decodable, Sendable {
        var orderId: String
        var orderNumber: Int?
        var order: OrderBody?

        struct OrderBody: Decodable, Sendable {
            var lines: [Line]
        }

        struct Line: Decodable, Sendable {
            var id: String
            var menuItemId: String?
            var quantity: Int
            var position: Int
        }

        var lines: [Line] {
            order?.lines ?? []
        }
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
    ) async throws -> String {
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
        struct Res: Decodable {
            var paymentId: String
        }
        let res: Res = try await post(
            "/api/pos/payments/collect-cash-allocations",
            body: Body(
                restaurantId: restaurantId,
                tableSessionId: tableSessionId,
                allocations: allocations.map { Allocation(orderLineId: $0.orderLineId, quantity: $0.quantity) },
                tipCents: tipCents,
                receivedAmountCents: receivedAmountCents
            )
        )
        return res.paymentId
    }

    struct GiftVoucherListItemDto: Decodable, Identifiable, Sendable {
        var id: String
        var code: String
        var balance_cents: Int
        var initial_amount_cents: Int
        var status: String
        var expires_at: String?
    }

    @MainActor
    static func fetchGiftVouchers(restaurantId: String) async throws -> [GiftVoucherListItemDto] {
        struct Res: Decodable { var vouchers: [GiftVoucherListItemDto] }
        let res: Res = try await get(
            "/api/pos/gift-vouchers",
            restaurantId: restaurantId,
            extraQuery: ["status": "active"]
        )
        return res.vouchers
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

    struct PosVoidReasonDto: Codable, Identifiable, Sendable, Hashable {
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

    struct FormalInvoiceStornoInfo: Decodable, Sendable {
        var mode: String
        var invoiceId: String?
        var invoiceNumber: String?
        var correctionId: String?
        var correctionNumber: String?
        var error: String?
    }

    struct VoidCashResult: Sendable {
        var reopened: Bool
        var tableSessionId: String
        var inventoryRestored: Bool
        var formalInvoiceStorno: FormalInvoiceStornoInfo?
    }

    @MainActor
    static func voidCashPayment(
        restaurantId: String,
        paymentId: String,
        reopenTable: Bool = true,
        voidReasonId: String? = nil
    ) async throws -> VoidCashResult {
        struct Body: Encodable {
            var restaurantId: String
            var reopenTable: Bool
            var voidReasonId: String?
        }
        struct Res: Decodable {
            var reopened: Bool
            var tableSessionId: String
            var inventoryRestored: Bool?
            var formalInvoiceStorno: FormalInvoiceStornoInfo?
        }
        let res: Res = try await post(
            "/api/pos/payments/\(paymentId)/void-cash",
            body: Body(
                restaurantId: restaurantId,
                reopenTable: reopenTable,
                voidReasonId: voidReasonId
            )
        )
        return VoidCashResult(
            reopened: res.reopened,
            tableSessionId: res.tableSessionId,
            inventoryRestored: res.inventoryRestored ?? false,
            formalInvoiceStorno: res.formalInvoiceStorno
        )
    }

    struct FormalInvoiceLineDto: Decodable, Sendable, Identifiable {
        var name: String
        var quantity: Double
        var unitPrice: Double
        var taxRatePercent: Double
        var lineAmount: Double
        var id: String { "\(name)-\(quantity)-\(lineAmount)" }
    }

    struct FormalInvoiceDraftDto: Decodable, Sendable {
        var paymentId: String
        var orderId: String
        var orderNumber: Int
        var paidAt: String?
        var amountCents: Int
        var tipCents: Int
        var alreadyInvoiced: Bool
        var existingInvoiceId: String?
        var existingInvoiceNumber: String?
        var alreadyStornoed: Bool?
        var existingCorrectionId: String?
        var existingCorrectionNumber: String?
        var lineItems: [FormalInvoiceLineDto]

        var isStornoed: Bool { alreadyStornoed == true }
    }

    struct FormalInvoiceCreatedDto: Decodable, Sendable {
        var id: String
        var voucher_number: String?
    }

    @MainActor
    static func fetchFormalInvoiceDraft(
        restaurantId: String,
        paymentId: String
    ) async throws -> FormalInvoiceDraftDto {
        struct Res: Decodable { var draft: FormalInvoiceDraftDto }
        let res: Res = try await get(
            "/api/pos/payments/\(paymentId)/formal-invoice",
            restaurantId: restaurantId
        )
        return res.draft
    }

    @MainActor
    static func createFormalInvoice(
        restaurantId: String,
        paymentId: String,
        companyName: String?,
        personName: String?,
        street: String,
        zip: String,
        city: String,
        email: String?,
        phone: String?,
        voucherDate: String?
    ) async throws -> FormalInvoiceCreatedDto {
        struct Body: Encodable {
            var restaurantId: String
            var companyName: String?
            var personName: String?
            var street: String
            var zip: String
            var city: String
            var countryCode: String
            var email: String?
            var phone: String?
            var voucherDate: String?
        }
        struct Res: Decodable { var invoice: FormalInvoiceCreatedDto }
        let res: Res = try await post(
            "/api/pos/payments/\(paymentId)/formal-invoice",
            body: Body(
                restaurantId: restaurantId,
                companyName: companyName,
                personName: personName,
                street: street,
                zip: zip,
                city: city,
                countryCode: "DE",
                email: email,
                phone: phone,
                voucherDate: voucherDate
            )
        )
        return res.invoice
    }

    @MainActor
    static func stornoFormalInvoice(
        restaurantId: String,
        paymentId: String
    ) async throws -> FormalInvoiceStornoInfo {
        struct Body: Encodable { var restaurantId: String }
        struct Res: Decodable { var storno: FormalInvoiceStornoInfo }
        let res: Res = try await post(
            "/api/pos/payments/\(paymentId)/formal-invoice/storno",
            body: Body(restaurantId: restaurantId)
        )
        return res.storno
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
        try await applySessionAuth(to: &request)
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
    static func unauthenticatedPost<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    @MainActor
    static func deviceAuthenticatedGet<T: Decodable>(_ path: String) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try applyDeviceAuth(to: &request)
        return try await perform(request)
    }

    @MainActor
    static func deviceAuthenticatedPost<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try applyDeviceAuth(to: &request)
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    @MainActor
    static func deviceAuthenticatedDelete(_ path: String) async throws {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "DELETE"
        try applyDeviceAuth(to: &request)
        try applySessionAuthIfPresent(to: &request)
        let (data, response) = try await performRaw(request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.httpStatus(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                String(data: data, encoding: .utf8)
            )
        }
    }

    @MainActor
    static func deviceAuthenticatedPatch(_ path: String) async throws {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "PATCH"
        try await applySessionAuth(to: &request)
        let (data, response) = try await performRaw(request)
        guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw PosCloudError.httpStatus(
                (response as? HTTPURLResponse)?.statusCode ?? 0,
                String(data: data, encoding: .utf8)
            )
        }
    }

    @MainActor
    private static func applyDeviceAuth(to request: inout URLRequest) throws {
        request.setValue(try PosAuthStore.shared.deviceHeaderValue(), forHTTPHeaderField: "X-Gwada-Pos-Device")
    }

    @MainActor
    private static func applySessionAuth(to request: inout URLRequest) async throws {
        try applyDeviceAuth(to: &request)
        request.setValue(try PosAuthStore.shared.sessionHeaderValue(), forHTTPHeaderField: "X-Gwada-Pos-Session")
    }

    @MainActor
    private static func applySessionAuthIfPresent(to request: inout URLRequest) {
        if let value = try? PosAuthStore.shared.sessionHeaderValue() {
            request.setValue(value, forHTTPHeaderField: "X-Gwada-Pos-Session")
        }
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
        try await applySessionAuth(to: &request)
        return try await perform(request)
    }

    @MainActor
    private static func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await applySessionAuth(to: &request)
        request.httpBody = try encoder.encode(body)
        return try await perform(request)
    }

    @MainActor
    private static func postVoid<B: Encodable>(_ path: String, body: B) async throws {
        var request = URLRequest(url: url(path, restaurantId: nil))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await applySessionAuth(to: &request)
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
