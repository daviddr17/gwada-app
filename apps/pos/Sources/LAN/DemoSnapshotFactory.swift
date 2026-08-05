import Foundation

enum DemoSnapshotFactory {
    static let restaurantId = "00000000-0000-4000-8000-000000000001"
    static let restaurantName = "Demo Restaurant"

    private static let areaId = "area-1"
    private static let table1 = "table-1"
    private static let table2 = "table-2"
    private static let catVorspeisen = "cat-starter"
    private static let catHaupt = "cat-main"
    private static let catGetranke = "cat-drinks"
    private static let catBeilagen = "cat-sides"

    /// Vollständiger Demo-Bootstrap inkl. Speisekarte (DEBUG lokal ohne Cloud).
    static func makeBootstrap(hubDeviceId: String = "demo-hub") -> PosCloudBootstrap {
        PosCloudBootstrap(
            restaurantId: restaurantId,
            restaurantName: restaurantName,
            brandAccentHex: PosDesign.defaultAccentHex,
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            register: PosCloudRegisterStatus(
                isOpen: true,
                sessionId: "register-1",
                openedAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3600))
            ),
            floor: PosLanFloorSnapshot(
                areas: [
                    PosLanFloorArea(
                        id: areaId,
                        name: "Gastraum",
                        display_number: 1,
                        color_hex: "#0F766E",
                        sort_order: 0
                    ),
                ],
                tables: [
                    PosLanFloorTable(
                        id: table1,
                        area_id: areaId,
                        table_number: 1,
                        table_name: nil,
                        capacity: 4,
                        is_active: true
                    ),
                    PosLanFloorTable(
                        id: table2,
                        area_id: areaId,
                        table_number: 2,
                        table_name: "Fenster",
                        capacity: 2,
                        is_active: true
                    ),
                ],
                openSessions: [],
                orderCountBySessionId: [:],
                sessionMetaBySessionId: [:]
            ),
            menu: makeDemoMenu(),
            kitchen: nil,
            voidReasons: [
                PosCloudClient.PosVoidReasonDto(
                    id: "demo-void-wrong-order",
                    name: "Falsch bestellt",
                    restoreInventory: true,
                    sortOrder: 0,
                    isActive: true
                ),
                PosCloudClient.PosVoidReasonDto(
                    id: "demo-void-guest",
                    name: "Gast storniert",
                    restoreInventory: true,
                    sortOrder: 1,
                    isActive: true
                ),
                PosCloudClient.PosVoidReasonDto(
                    id: "demo-void-served",
                    name: "Bereits ausgegeben",
                    restoreInventory: false,
                    sortOrder: 2,
                    isActive: true
                ),
                PosCloudClient.PosVoidReasonDto(
                    id: "demo-void-test",
                    name: "Test / Fehlbuchung",
                    restoreInventory: true,
                    sortOrder: 3,
                    isActive: true
                ),
            ]
        )
    }

    static func makeDemoMenu() -> PosCloudMenuCatalog {
        PosCloudMenuCatalog(
            categories: [
                PosCloudMenuCategory(id: catVorspeisen, name: "Vorspeisen", sortOrder: 0),
                PosCloudMenuCategory(id: catHaupt, name: "Hauptgerichte", sortOrder: 1),
                PosCloudMenuCategory(id: catBeilagen, name: "Beilagen", sortOrder: 2),
                PosCloudMenuCategory(id: catGetranke, name: "Getränke", sortOrder: 3),
            ],
            items: [
                .demo(id: "item-suppe", name: "Tagessuppe", description: "Mit Brot", priceCents: 650, categoryId: catVorspeisen),
                .demo(id: "item-salat", name: "Haussalat", description: "", priceCents: 890, categoryId: catVorspeisen),
                PosCloudMenuItem(
                    id: "item-schnitzel",
                    name: "Wiener Schnitzel",
                    description: "mit Beilage nach Wahl",
                    priceCents: 1850,
                    sidePriceCents: nil,
                    sides: PosCloudMenuItemSideConfig(required: false, max: 2, includedCount: 1),
                    vatRate: 0.19,
                    categoryId: catHaupt,
                    listNumber: nil,
                    optionGroupIds: [],
                    recipe: [
                        PosCloudRecipeIngredient(ingredientId: "demo-ing-tomato", name: "Tomaten", amount: 1),
                        PosCloudRecipeIngredient(ingredientId: "demo-ing-onion", name: "Zwiebeln", amount: 1),
                    ],
                    active: true
                ),
                .demo(id: "item-pasta", name: "Pasta Arrabbiata", description: "", priceCents: 1490, categoryId: catHaupt),
                PosCloudMenuItem(
                    id: "item-pommes",
                    name: "Pommes",
                    description: "",
                    priceCents: 450,
                    sidePriceCents: 450,
                    sides: nil,
                    vatRate: 0.19,
                    categoryId: catBeilagen,
                    listNumber: 1,
                    optionGroupIds: [],
                    recipe: nil,
                    active: true
                ),
                PosCloudMenuItem(
                    id: "item-kroketten",
                    name: "Kroketten",
                    description: "",
                    priceCents: 490,
                    sidePriceCents: 490,
                    sides: nil,
                    vatRate: 0.19,
                    categoryId: catBeilagen,
                    listNumber: 2,
                    optionGroupIds: [],
                    recipe: nil,
                    active: true
                ),
                .demo(id: "item-cola", name: "Cola 0,4", description: "", priceCents: 390, categoryId: catGetranke),
                .demo(id: "item-wasser", name: "Mineralwasser", description: "", priceCents: 320, categoryId: catGetranke),
            ],
            optionGroups: []
        )
    }

    static func makeSnapshot(hubDeviceId: String) -> PosLanHubSnapshot {
        let boot = makeBootstrap(hubDeviceId: hubDeviceId)
        return PosLanHubSnapshot(
            protocolVersion: PosLanProtocol.version,
            restaurantId: boot.restaurantId,
            restaurantName: boot.restaurantName,
            brandAccentHex: boot.resolvedAccentHex,
            generatedAt: boot.generatedAt,
            register: PosLanRegisterState(
                isOpen: boot.register.isOpen,
                sessionId: boot.register.sessionId,
                openedAt: boot.register.openedAt
            ),
            floor: boot.floor,
            menu: boot.menu,
            hub: PosLanHubInfo(
                deviceId: hubDeviceId,
                displayName: PosLanProtocol.bonjourName(restaurantName: boot.restaurantName),
                role: "hub"
            ),
            snapshotVersion: 1,
            waiterCaps: nil
        )
    }

    static func makeHealth() -> PosLanHealthResponse {
        PosLanHealthResponse(
            ok: true,
            protocolVersion: PosLanProtocol.version,
            restaurantId: restaurantId,
            restaurantName: restaurantName,
            role: "hub",
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }
}

extension PosCloudMenuItem {
    static func demo(
        id: String,
        name: String,
        description: String,
        priceCents: Int,
        categoryId: String
    ) -> PosCloudMenuItem {
        PosCloudMenuItem(
            id: id,
            name: name,
            description: description,
            priceCents: priceCents,
            sidePriceCents: nil,
            sides: nil,
            vatRate: 0.19,
            categoryId: categoryId,
            listNumber: nil,
            optionGroupIds: [],
            recipe: nil,
            active: true
        )
    }

    init(
        id: String,
        name: String,
        description: String,
        priceCents: Int,
        sidePriceCents: Int?,
        sides: PosCloudMenuItemSideConfig?,
        vatRate: Double,
        categoryId: String,
        listNumber: Int?,
        optionGroupIds: [String],
        recipe: [PosCloudRecipeIngredient]?,
        active: Bool
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.priceCents = priceCents
        self.sidePriceCents = sidePriceCents
        self.sides = sides
        self.vatRate = vatRate
        self.categoryId = categoryId
        self.listNumber = listNumber
        self.optionGroupIds = optionGroupIds
        self.recipe = recipe
        self.active = active
    }
}

