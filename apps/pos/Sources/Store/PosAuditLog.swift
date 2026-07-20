import Foundation

/// Append-only lokales Audit-Log (PIN, Zahlung, Fire, Release, Transfer).
struct PosAuditEvent: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var ts: String
    var action: String
    var detail: String
    var restaurantId: String?
    var sessionId: String?
    var waiterProfileId: String?
    var deviceId: String
}

@MainActor
final class PosAuditLog: ObservableObject {
    static let shared = PosAuditLog()

    @Published private(set) var events: [PosAuditEvent] = []

    private let maxEvents = 500
    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("audit-log.json")
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        load()
    }

    func record(
        _ action: String,
        detail: String = "",
        sessionId: String? = nil,
        restaurantId: String? = nil
    ) {
        let event = PosAuditEvent(
            id: UUID().uuidString,
            ts: ISO8601DateFormatter().string(from: Date()),
            action: action,
            detail: detail,
            restaurantId: restaurantId ?? PosCloudConfig.restaurantId,
            sessionId: sessionId,
            waiterProfileId: PosCloudConfig.waiterProfileId ?? PosAuthStore.shared.session?.userId,
            deviceId: PosDeviceIdentity.id
        )
        events.insert(event, at: 0)
        if events.count > maxEvents {
            events = Array(events.prefix(maxEvents))
        }
        persist()
    }

    func exportText() -> String {
        events.map { e in
            "\(e.ts)\t\(e.action)\t\(e.detail)\tsession=\(e.sessionId ?? "-")\tdevice=\(e.deviceId.prefix(8))"
        }.joined(separator: "\n")
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? decoder.decode([PosAuditEvent].self, from: data)
        else {
            events = []
            return
        }
        events = saved
    }

    private func persist() {
        guard let data = try? encoder.encode(events) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
