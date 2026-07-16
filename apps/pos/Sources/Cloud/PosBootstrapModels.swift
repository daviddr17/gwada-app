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
}

struct PosCloudCategoryRoute: Codable, Equatable, Identifiable, Sendable {
    var menuCategoryId: String
    var destination: String
    var kdsDeviceIds: [String]
    var printerIds: [String]

    var id: String { menuCategoryId }
}

struct PosCloudKitchenConfig: Codable, Equatable, Sendable {
    var kdsDevices: [PosCloudKdsDevice]
    var printers: [PosCloudPrinter]
    var categoryRoutes: [PosCloudCategoryRoute]
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
