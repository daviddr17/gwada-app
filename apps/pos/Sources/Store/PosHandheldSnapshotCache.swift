import Foundation

/// Persistenter letzter Hub-Snapshot fürs Handgerät (Floor + Menü).
/// Phase 2: Offline-Service nur aus diesem Cache + lokalen Open-Lines.
enum PosHandheldSnapshotCache {
    private static let ioQueue = DispatchQueue(label: "app.gwada.pos.handheld-snapshot", qos: .utility)

    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("handheld-hub-snapshot.json")
    }

    static func save(_ snapshot: PosLanHubSnapshot) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(snapshot) else { return }
            try? data.write(to: fileURL, options: [.atomic])
        }
    }

    static func load() -> PosLanHubSnapshot? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(PosLanHubSnapshot.self, from: data)
    }

    static func clear() {
        ioQueue.async {
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    static func flushForTests() {
        ioQueue.sync {}
    }
}
