import Foundation

/// Gecachte Kellner-Profile inkl. Capabilities (Offline-PIN-Login vorbereitet).
/// Klartext-PINs werden nicht gespeichert — nur Caps + Metadaten.
struct PosCachedWaiter: Codable, Equatable, Identifiable, Sendable {
    var id: String { profileId }
    var profileId: String
    var name: String
    var roleSlug: String?
    var caps: [String]
    var updatedAt: String
}

@MainActor
final class PosWaiterPinCache: ObservableObject {
    static let shared = PosWaiterPinCache()

    @Published private(set) var waiters: [PosCachedWaiter] = []

    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("waiter-pin-cache.json")
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        load()
    }

    func caps(for profileId: String) -> [String] {
        waiters.first(where: { $0.profileId == profileId })?.caps ?? []
    }

    func upsert(_ waiter: PosCachedWaiter) {
        if let idx = waiters.firstIndex(where: { $0.profileId == waiter.profileId }) {
            waiters[idx] = waiter
        } else {
            waiters.append(waiter)
        }
        persist()
    }

    /// Nach Hub-Login: aktuellen Cloud-User als Kellner-Eintrag merken.
    func rememberSignedInUser(profileId: String, email: String, caps: [String] = ["transfer"]) {
        let name = email.split(separator: "@").first.map(String.init) ?? email
        upsert(PosCachedWaiter(
            profileId: profileId,
            name: name,
            roleSlug: nil,
            caps: caps,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        ))
    }

    func capsByProfileId() -> [String: [String]] {
        Dictionary(uniqueKeysWithValues: waiters.map { ($0.profileId, $0.caps) })
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? decoder.decode([PosCachedWaiter].self, from: data) else {
            waiters = []
            return
        }
        waiters = saved
    }

    private func persist() {
        guard let data = try? encoder.encode(waiters) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
