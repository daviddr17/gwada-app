import Foundation

/// Persistenter Cache bezahlter Session-Positionen (Ableitung aus Belegen).
enum PosPaidHistoryStore {
    private static let lock = NSLock()
    private static var cache: [String: [PaidHistoryLine]]?

    private static func loadMapLocked() -> [String: [PaidHistoryLine]] {
        if let cache { return cache }
        let loaded = PosLocalStore.loadPaidHistory() ?? [:]
        cache = loaded
        return loaded
    }

    private static func persistLocked(_ map: [String: [PaidHistoryLine]]) {
        cache = map
        PosLocalStore.savePaidHistory(map)
    }

    static func lines(sessionId: String) -> [PaidHistoryLine] {
        let sid = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sid.isEmpty, !sid.hasPrefix("pending-") else { return [] }
        lock.lock()
        defer { lock.unlock() }
        return loadMapLocked()[sid] ?? []
    }

    /// Rebuild aus Session-Belegen und Cache speichern.
    @discardableResult
    static func rebuild(sessionId: String, receipts: [PosLocalReceipt]) -> [PaidHistoryLine] {
        let sid = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sid.isEmpty, !sid.hasPrefix("pending-") else { return [] }
        let sessionReceipts = receipts.filter { $0.tableSessionId == sid }
        let built = PosSessionPaidHistory.rebuild(from: sessionReceipts)
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        if built.isEmpty {
            map.removeValue(forKey: sid)
        } else {
            map[sid] = built
        }
        persistLocked(map)
        return built
    }

    static func clear(sessionId: String) {
        let sid = sessionId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sid.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        map.removeValue(forKey: sid)
        persistLocked(map)
    }

    static func pruneMissingSessions(openSessionIds: Set<String>) {
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        let before = map.count
        map = map.filter { openSessionIds.contains($0.key) }
        if map.count != before {
            persistLocked(map)
        }
    }

    static func resetCacheForTests() {
        lock.lock()
        defer { lock.unlock() }
        cache = nil
    }
}
