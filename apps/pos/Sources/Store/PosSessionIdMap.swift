import Foundation

/// Persistente Zuordnung lokale Tisch-Session → Cloud-Session-ID.
/// Braucht die Sync-Queue nach Offline-Open, damit Orders/Kassierungen
/// nicht mit einer unbekannten lokalen UUID an die DB gehen.
final class PosSessionIdMap: @unchecked Sendable {
    static let shared = PosSessionIdMap()

    private let lock = NSLock()
    private var localToCloud: [String: String] = [:]

    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("session-id-map.json")
    }()

    private init() {
        load()
    }

    /// Speichert Mapping. Identität (local == cloud) ist erlaubt und hilfreich.
    func remember(localSessionId: String, cloudSessionId: String) {
        let local = localSessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        let cloud = cloudSessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !local.isEmpty, !cloud.isEmpty else { return }

        lock.lock()
        localToCloud[local] = cloud
        // Transitiver Fall: frühere Keys, die auf local zeigten → jetzt cloud
        for (key, value) in localToCloud where value == local && key != cloud {
            localToCloud[key] = cloud
        }
        let snapshot = localToCloud
        lock.unlock()
        persist(snapshot)
    }

    /// Liefert Cloud-ID falls gemappt, sonst die Eingabe unverändert.
    func resolve(_ sessionId: String) -> String {
        let trimmed = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return sessionId }
        lock.lock()
        defer { lock.unlock() }
        return localToCloud[trimmed] ?? trimmed
    }

    func cloudId(forLocal localSessionId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return localToCloud[localSessionId]
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? JSONDecoder().decode([String: String].self, from: data)
        else {
            localToCloud = [:]
            return
        }
        localToCloud = saved
    }

    private func persist(_ snapshot: [String: String]) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
