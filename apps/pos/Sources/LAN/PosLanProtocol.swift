import Foundation

enum PosLanProtocol {
    static let version = 1
    static let hubPort: UInt16 = 8787
    /// Bonjour type ohne führenden Unterstrich / Transport — NetService nutzt `_gwada-pos._tcp.`
    static let bonjourType = "_gwada-pos._tcp."
    static let bonjourDomain = "local."
    static let healthPath = "/v1/health"
    static let snapshotPath = "/v1/snapshot"
    static let openSessionPath = "/v1/sessions"
    static let createOrderPath = "/v1/orders"
    static let collectPath = "/v1/collect"
    static let fireCoursePath = "/v1/fire"
    static let voidLinePath = "/v1/lines/void"
    static let releaseSessionPath = "/v1/sessions/release"
    static let reservationsPath = "/v1/reservations"
    static let kdsPath = "/v1/kds"
    static let kdsTicketsPath = "/v1/kds/tickets"
    static let kdsAdvancePath = "/v1/kds/tickets/advance"
    static let printJobsPath = "/v1/print-jobs"
    static let pairRequestPath = "/v1/pair/request"
    static let pairStatusPath = "/v1/pair/status"
    /// Kurzer Pair-Token erneuern (P2-1) — braucht aktuellen/grace Token.
    static let pairRefreshPath = "/v1/pair/refresh"
    /// DEBUG-only: alle pending Pairings freigeben (Simulator-Smoke ohne iPad-Tap).
    static let pairDebugApproveAllPath = "/v1/pair/debug-approve-all"
    static let headerProtocol = "X-Gwada-Pos-Lan"
    static let headerRestaurantId = "X-Gwada-Restaurant-Id"
    static let headerPairToken = "X-Gwada-Pair-Token"
    static let headerLanSecret = "X-Gwada-Pos-Lan-Secret"
    /// Staff-Session vom Handgerät (sessionId.sessionToken) — Collect-Authz.
    static let headerStaffSession = "X-Gwada-Staff-Session"
    static let headerStaffId = "X-Gwada-Staff-Id"

    static func bonjourName(restaurantName: String) -> String {
        let base = "Gwada Kasse · \(restaurantName.trimmingCharacters(in: .whitespacesAndNewlines))"
        return String(base.prefix(63))
    }

    static func hubBaseURL(host: String, port: UInt16 = hubPort) -> URL {
        let cleaned = host
            .replacingOccurrences(of: "http://", with: "")
            .replacingOccurrences(of: "https://", with: "")
            .split(separator: "/").first
            .map(String.init) ?? host
        let hostname = cleaned.split(separator: ":").first.map(String.init) ?? cleaned
        return URL(string: "https://\(hostname):\(port)")!
    }

    /// Alte `http://`-Enrollment-URLs auf HTTPS heben.
    static func normalizeHubBaseURLString(_ raw: String) -> String {
        if raw.hasPrefix("https://") { return raw }
        if raw.hasPrefix("http://") {
            return "https://" + raw.dropFirst("http://".count)
        }
        return hubBaseURL(host: raw).absoluteString
    }
}
