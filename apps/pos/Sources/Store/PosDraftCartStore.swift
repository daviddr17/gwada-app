import Foundation

/// Persistenter ungeschickter Bon-Entwurf pro Tisch bzw. Session.
enum PosDraftCartStore {
    private static let lock = NSLock()
    private static var cache: [String: [PosCartLine]]?

    private static let tablePrefix = "table:"
    private static let sessionPrefix = "session:"

    static func tableKey(_ diningTableId: String) -> String {
        tablePrefix + diningTableId
    }

    static func sessionKey(_ sessionId: String) -> String {
        sessionPrefix + sessionId
    }

    /// Bevorzugt Session-Key, sonst Tisch-Key (und hängt um, wenn Session neu ist).
    static func resolveKey(diningTableId: String, sessionId: String?) -> String {
        let sid = (sessionId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !sid.isEmpty, !sid.hasPrefix("pending-") {
            return sessionKey(sid)
        }
        return tableKey(diningTableId)
    }

    private static func loadMapLocked() -> [String: [PosCartLine]] {
        if let cache { return cache }
        let loaded = PosLocalStore.loadDraftCarts() ?? [:]
        cache = loaded
        return loaded
    }

    private static func persistLocked(_ map: [String: [PosCartLine]]) {
        cache = map
        PosLocalStore.saveDraftCarts(map)
    }

    static func load(diningTableId: String, sessionId: String?) -> [PosCartLine] {
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        let preferred = resolveKey(diningTableId: diningTableId, sessionId: sessionId)
        if let lines = map[preferred] {
            return lines
        }
        // Session existiert: Tisch-Entwurf übernehmen.
        if preferred.hasPrefix(sessionPrefix) {
            let tKey = tableKey(diningTableId)
            if let legacy = map[tKey], !legacy.isEmpty {
                map[preferred] = legacy
                map.removeValue(forKey: tKey)
                persistLocked(map)
                return legacy
            }
        }
        return []
    }

    static func save(_ lines: [PosCartLine], diningTableId: String, sessionId: String?) {
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        let key = resolveKey(diningTableId: diningTableId, sessionId: sessionId)
        if lines.isEmpty {
            map.removeValue(forKey: key)
            if key.hasPrefix(sessionPrefix) {
                map.removeValue(forKey: tableKey(diningTableId))
            }
        } else {
            map[key] = lines
            if key.hasPrefix(sessionPrefix) {
                map.removeValue(forKey: tableKey(diningTableId))
            }
        }
        persistLocked(map)
    }

    static func clear(diningTableId: String?, sessionId: String?) {
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        if let sid = sessionId?.trimmingCharacters(in: .whitespacesAndNewlines),
           !sid.isEmpty, !sid.hasPrefix("pending-")
        {
            map.removeValue(forKey: sessionKey(sid))
        }
        if let tid = diningTableId?.trimmingCharacters(in: .whitespacesAndNewlines), !tid.isEmpty {
            map.removeValue(forKey: tableKey(tid))
        }
        persistLocked(map)
    }

    /// Entfernt Session-Drafts, deren Session nicht mehr offen ist.
    static func pruneMissingSessions(openSessionIds: Set<String>) {
        lock.lock()
        defer { lock.unlock() }
        var map = loadMapLocked()
        let before = map.count
        map = map.filter { key, _ in
            guard key.hasPrefix(sessionPrefix) else { return true }
            let sid = String(key.dropFirst(sessionPrefix.count))
            return openSessionIds.contains(sid)
        }
        if map.count != before {
            persistLocked(map)
        }
    }

    /// Tests: Cache leeren (Disk bleibt).
    static func resetCacheForTests() {
        lock.lock()
        defer { lock.unlock() }
        cache = nil
    }
}
