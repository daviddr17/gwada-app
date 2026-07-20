import Foundation

/// Persistente Zuordnung lokale Bestellzeile → Cloud-Zeilen-ID.
/// Braucht die Sync-Queue nach Offline-Order, damit Kassierungen
/// nicht mit unbekannten lokalen UUIDs an die DB gehen.
final class PosOrderLineIdMap: @unchecked Sendable {
    static let shared = PosOrderLineIdMap()

    private let lock = NSLock()
    private var localToCloud: [String: String] = [:]

    private let fileURL: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("order-line-id-map.json")
    }()

    private init() {
        load()
    }

    /// Speichert Mapping. Identität (local == cloud) ist erlaubt und hilfreich.
    func remember(localLineId: String, cloudLineId: String) {
        let local = localLineId.trimmingCharacters(in: .whitespacesAndNewlines)
        let cloud = cloudLineId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !local.isEmpty, !cloud.isEmpty else { return }

        lock.lock()
        localToCloud[local] = cloud
        for (key, value) in localToCloud where value == local && key != cloud {
            localToCloud[key] = cloud
        }
        let snapshot = localToCloud
        lock.unlock()
        persist(snapshot)
    }

    /// Liefert Cloud-ID falls gemappt, sonst die Eingabe unverändert.
    func resolve(_ lineId: String) -> String {
        let trimmed = lineId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return lineId }
        lock.lock()
        defer { lock.unlock() }
        return localToCloud[trimmed] ?? trimmed
    }

    func cloudId(forLocal localLineId: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return localToCloud[localLineId]
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
