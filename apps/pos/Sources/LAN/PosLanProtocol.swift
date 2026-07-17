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
    static let kdsPath = "/v1/kds"
    static let kdsTicketsPath = "/v1/kds/tickets"
    static let kdsAdvancePath = "/v1/kds/tickets/advance"
    static let printJobsPath = "/v1/print-jobs"
    static let headerProtocol = "X-Gwada-Pos-Lan"
    static let headerRestaurantId = "X-Gwada-Restaurant-Id"

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
        return URL(string: "http://\(hostname):\(port)")!
    }
}
