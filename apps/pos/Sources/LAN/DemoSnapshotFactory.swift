import Foundation

enum DemoSnapshotFactory {
    static let restaurantId = "00000000-0000-4000-8000-000000000001"
    static let restaurantName = "Demo Restaurant"

    static func makeSnapshot(hubDeviceId: String) -> PosLanHubSnapshot {
        let areaId = "area-1"
        let table1 = "table-1"
        let table2 = "table-2"
        let sessionId = "session-open-1"

        return PosLanHubSnapshot(
            protocolVersion: PosLanProtocol.version,
            restaurantId: restaurantId,
            restaurantName: restaurantName,
            brandAccentHex: PosDesign.defaultAccentHex,
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            register: PosLanRegisterState(
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
                openSessions: [
                    PosLanOpenSession(
                        id: sessionId,
                        dining_table_id: table1,
                        cover_count: 2,
                        opened_at: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-900))
                    ),
                ],
                orderCountBySessionId: [sessionId: 1],
                sessionMetaBySessionId: [
                    sessionId: PosLanSessionFloorMeta(orderCount: 1, openCents: 2450),
                ]
            ),
            menu: nil,
            hub: PosLanHubInfo(
                deviceId: hubDeviceId,
                displayName: PosLanProtocol.bonjourName(restaurantName: restaurantName),
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
