import Foundation
import UIKit

struct PosLanRegisterState: Codable, Equatable, Sendable {
    var isOpen: Bool
    var sessionId: String?
    var openedAt: String?
}

struct PosLanFloorArea: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var display_number: Int
    var color_hex: String
    var sort_order: Int
}

struct PosLanFloorTable: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var area_id: String
    var table_number: Int
    var table_name: String?
    var capacity: Int
    var is_active: Bool

    var label: String {
        let name = table_name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Tisch \(table_number)" : name
    }
}

struct PosLanOpenSession: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var dining_table_id: String
    var cover_count: Int
    var opened_at: String
}

struct PosLanSessionFloorMeta: Codable, Equatable, Sendable {
    var orderCount: Int
    var openCents: Int
}

struct PosLanFloorSnapshot: Codable, Equatable, Sendable {
    var areas: [PosLanFloorArea]
    var tables: [PosLanFloorTable]
    var openSessions: [PosLanOpenSession]
    var orderCountBySessionId: [String: Int]
    var sessionMetaBySessionId: [String: PosLanSessionFloorMeta]
}

struct PosLanHubInfo: Codable, Equatable, Sendable {
    var deviceId: String
    var displayName: String
    var role: String
}

struct PosLanHubSnapshot: Codable, Equatable, Sendable {
    var protocolVersion: Int
    var restaurantId: String
    var restaurantName: String
    /// Optional für ältere Hubs — Handgeräte fallen auf Gwada-Gold zurück.
    var brandAccentHex: String?
    var generatedAt: String
    var register: PosLanRegisterState
    var floor: PosLanFloorSnapshot
    /// Speisekarte für Handgeräte (optional für ältere Hubs).
    var menu: PosCloudMenuCatalog?
    var hub: PosLanHubInfo

    var resolvedAccentHex: String {
        PosDesign.resolveAccentHex(brandAccentHex)
    }
}

struct PosLanHealthResponse: Codable, Equatable, Sendable {
    var ok: Bool
    var protocolVersion: Int
    var restaurantId: String
    var restaurantName: String
    var role: String
    var generatedAt: String
}

enum PosDeviceRole: String, Codable, Sendable {
    case hub
    case handheld

    var title: String {
        switch self {
        case .hub: return "Kasse (Server)"
        case .handheld: return "Handgerät"
        }
    }
}

enum PosDeviceRoleDetector {
    static func detect() -> PosDeviceRole {
        UIDevice.current.userInterfaceIdiom == .pad ? .hub : .handheld
    }

    static var deviceKindLabel: String {
        switch UIDevice.current.userInterfaceIdiom {
        case .pad: return "iPad"
        case .phone: return "iPhone"
        default: return UIDevice.current.model
        }
    }
}
