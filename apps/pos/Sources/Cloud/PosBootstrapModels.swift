import Foundation

struct PosCloudRegisterStatus: Codable, Equatable, Sendable {
    var isOpen: Bool
    var sessionId: String?
    var openedAt: String?
}

struct PosCloudMenuCategory: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var sortOrder: Int
}

struct PosCloudMenuChoice: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var priceDelta: Double
    var active: Bool?

    enum CodingKeys: String, CodingKey { case id, name, priceDelta, active }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        priceDelta = try c.decode(PosJSONNumber.self, forKey: .priceDelta).doubleValue
        active = try c.decodeIfPresent(Bool.self, forKey: .active)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(priceDelta, forKey: .priceDelta)
        try c.encodeIfPresent(active, forKey: .active)
    }
}

struct PosCloudMenuOptionGroup: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var active: Bool?
    var minSelect: Int
    var maxSelect: Int?
    var choices: [PosCloudMenuChoice]
}

struct PosCloudRecipeIngredient: Codable, Equatable, Identifiable, Sendable {
    var ingredientId: String
    var name: String
    var amount: Double

    var id: String { ingredientId }

    enum CodingKeys: String, CodingKey { case ingredientId, name, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        ingredientId = try c.decode(String.self, forKey: .ingredientId)
        name = try c.decode(String.self, forKey: .name)
        amount = try c.decode(PosJSONNumber.self, forKey: .amount).doubleValue
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(ingredientId, forKey: .ingredientId)
        try c.encode(name, forKey: .name)
        try c.encode(amount, forKey: .amount)
    }
}

struct PosCloudMenuItem: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var description: String
    var priceCents: Int
    var vatRate: Double
    var categoryId: String
    var listNumber: Int?
    var optionGroupIds: [String]
    var recipe: [PosCloudRecipeIngredient]?
    var active: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, description, priceCents, vatRate, categoryId, listNumber, optionGroupIds, recipe, active
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        priceCents = try c.decode(PosJSONNumber.self, forKey: .priceCents).intValue
        vatRate = try c.decode(PosJSONNumber.self, forKey: .vatRate).doubleValue
        categoryId = try c.decode(String.self, forKey: .categoryId)
        listNumber = try c.decodeIfPresent(PosJSONNumber.self, forKey: .listNumber)?.intValue
        optionGroupIds = try c.decodeIfPresent([String].self, forKey: .optionGroupIds) ?? []
        recipe = try c.decodeIfPresent([PosCloudRecipeIngredient].self, forKey: .recipe)
        active = try c.decodeIfPresent(Bool.self, forKey: .active) ?? true
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(description, forKey: .description)
        try c.encode(priceCents, forKey: .priceCents)
        try c.encode(vatRate, forKey: .vatRate)
        try c.encode(categoryId, forKey: .categoryId)
        try c.encodeIfPresent(listNumber, forKey: .listNumber)
        try c.encode(optionGroupIds, forKey: .optionGroupIds)
        try c.encodeIfPresent(recipe, forKey: .recipe)
        try c.encode(active, forKey: .active)
    }
}

struct PosCloudMenuCatalog: Codable, Equatable, Sendable {
    var categories: [PosCloudMenuCategory]
    var items: [PosCloudMenuItem]
    var optionGroups: [PosCloudMenuOptionGroup]
}

struct PosCloudKdsDevice: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var menuCategoryIds: [String]
    var courses: [String]
    var isActive: Bool
}

struct PosCloudPrinter: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var connectionType: String
    var isActive: Bool
    /// Flache Felder aus Web-Bootstrap und/oder connectionConfig.
    var host: String?
    var port: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, connectionType, isActive, host, port, connectionConfig
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        connectionType = try c.decodeIfPresent(String.self, forKey: .connectionType) ?? "virtual"
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        host = try c.decodeIfPresent(String.self, forKey: .host)
        port = try c.decodeIfPresent(Int.self, forKey: .port)
        if host == nil || port == nil,
           let cfg = try? c.decodeIfPresent(ConfigBox.self, forKey: .connectionConfig)
        {
            if host == nil { host = cfg.host }
            if port == nil { port = cfg.resolvedPort }
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(connectionType, forKey: .connectionType)
        try c.encode(isActive, forKey: .isActive)
        try c.encodeIfPresent(host, forKey: .host)
        try c.encodeIfPresent(port, forKey: .port)
        try c.encode(
            ConfigBox(host: host, port: port.map(ConfigBox.PortValue.int)),
            forKey: .connectionConfig
        )
    }

    private struct ConfigBox: Codable {
        var host: String?
        var port: PortValue?

        var resolvedPort: Int? {
            switch port {
            case .int(let v): return v
            case .double(let v): return Int(v)
            case .string(let s): return Int(s)
            case .none: return nil
            }
        }

        enum PortValue: Codable {
            case int(Int)
            case double(Double)
            case string(String)

            init(from decoder: Decoder) throws {
                let c = try decoder.singleValueContainer()
                if let i = try? c.decode(Int.self) { self = .int(i); return }
                if let d = try? c.decode(Double.self) { self = .double(d); return }
                if let s = try? c.decode(String.self) { self = .string(s); return }
                self = .int(9100)
            }

            func encode(to encoder: Encoder) throws {
                var c = encoder.singleValueContainer()
                switch self {
                case .int(let v): try c.encode(v)
                case .double(let v): try c.encode(v)
                case .string(let v): try c.encode(v)
                }
            }
        }
    }

    var resolvedHost: String {
        (host ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var resolvedPort: UInt16 {
        let p = port ?? 9100
        return UInt16(clamping: max(1, p))
    }
}

struct PosCloudCategoryRoute: Codable, Equatable, Identifiable, Sendable {
    var menuCategoryId: String
    var destination: String
    var kdsDeviceIds: [String]
    var printerIds: [String]

    var id: String { menuCategoryId }
}

struct PosCloudKdsStatus: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var color: String
    var sortOrder: Int
    var printOnEnter: Bool
    var printerIds: [String]
    var isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, color, sortOrder, printOnEnter, printerIds, isActive
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "#3b82f6"
        sortOrder = try c.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
        printOnEnter = try c.decodeIfPresent(Bool.self, forKey: .printOnEnter) ?? false
        printerIds = try c.decodeIfPresent([String].self, forKey: .printerIds) ?? []
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
    }
}

struct PosCloudKitchenConfig: Codable, Equatable, Sendable {
    var kdsDevices: [PosCloudKdsDevice]
    var kdsStatuses: [PosCloudKdsStatus]?
    var printers: [PosCloudPrinter]
    var categoryRoutes: [PosCloudCategoryRoute]

    var activeKdsStatuses: [PosCloudKdsStatus] {
        (kdsStatuses ?? []).filter(\.isActive).sorted { $0.sortOrder < $1.sortOrder }
    }
}

struct PosCloudBootstrap: Codable, Equatable, Sendable {
    var restaurantId: String
    var restaurantName: String
    /// Restaurant-Akzent (`restaurants.brand_accent_hex`), Fallback Gwada-Gold.
    var brandAccentHex: String?
    var generatedAt: String
    var register: PosCloudRegisterStatus
    var floor: PosLanFloorSnapshot
    var menu: PosCloudMenuCatalog
    /// Optional für ältere Caches / Server.
    var kitchen: PosCloudKitchenConfig?

    var resolvedAccentHex: String {
        PosDesign.resolveAccentHex(brandAccentHex)
    }
}
