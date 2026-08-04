import Foundation

/// Persistenter Kassieren-Modus pro Session (kein Mischbetrieb Positions ↔ Anteile).
struct PosKassierenLockState: Codable, Equatable, Sendable {
    var mode: String
    var evenN: Int
    var evenPlanN: Int?
    var evenSharesCompleted: Int
    var settledShareCents: Int

    static let modePositions = "positions"
    static let modeEven = "even"
}

/// Persistenter Cache für Bootstrap (Floor + Speisekarte) auf dem Kassen-iPad.
/// Encode + Disk-I/O laufen auf einer Serial-Queue — Aufrufer (auch unter `PosHubState`-Lock) blockieren nicht.
enum PosLocalStore {
    private static let ioQueue = DispatchQueue(label: "app.gwada.pos.local-store", qos: .utility)

    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("GwadaPOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static var bootstrapURL: URL {
        directory.appendingPathComponent("bootstrap.json")
    }

    static func saveBootstrap(_ bootstrap: PosCloudBootstrap) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(bootstrap) else { return }
            try? data.write(to: bootstrapURL, options: [.atomic])
        }
    }

    static func loadBootstrap() -> PosCloudBootstrap? {
        guard let data = try? Data(contentsOf: bootstrapURL) else { return nil }
        return try? JSONDecoder().decode(PosCloudBootstrap.self, from: data)
    }

    private static var openLinesURL: URL {
        directory.appendingPathComponent("local-open-lines.json")
    }

    static func saveOpenLines(_ linesBySession: [String: [SessionOpenLine]]) {
        ioQueue.async {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            guard let data = try? encoder.encode(linesBySession) else { return }
            try? data.write(to: openLinesURL, options: [.atomic])
        }
    }

    static func loadOpenLines() -> [String: [SessionOpenLine]]? {
        guard let data = try? Data(contentsOf: openLinesURL) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode([String: [SessionOpenLine]].self, from: data)
    }

    private static var reservationsURL: URL {
        directory.appendingPathComponent("reservations-cache.json")
    }

    static func saveReservationsCache(_ cache: [String: PosReservationsDayDto]) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(cache) else { return }
            try? data.write(to: reservationsURL, options: [.atomic])
        }
    }

    static func loadReservationsCache() -> [String: PosReservationsDayDto]? {
        guard let data = try? Data(contentsOf: reservationsURL) else { return nil }
        return try? JSONDecoder().decode([String: PosReservationsDayDto].self, from: data)
    }

    private static var kassierenLocksURL: URL {
        directory.appendingPathComponent("kassieren-mode-locks.json")
    }

    static func saveKassierenLocks(_ locks: [String: PosKassierenLockState]) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(locks) else { return }
            try? data.write(to: kassierenLocksURL, options: [.atomic])
        }
    }

    static func loadKassierenLocks() -> [String: PosKassierenLockState]? {
        guard let data = try? Data(contentsOf: kassierenLocksURL) else { return nil }
        return try? JSONDecoder().decode([String: PosKassierenLockState].self, from: data)
    }

    private static var draftCartsURL: URL {
        directory.appendingPathComponent("draft-carts.json")
    }

    static func saveDraftCarts(_ cartsByKey: [String: [PosCartLine]]) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(cartsByKey) else { return }
            try? data.write(to: draftCartsURL, options: [.atomic])
        }
    }

    static func loadDraftCarts() -> [String: [PosCartLine]]? {
        guard let data = try? Data(contentsOf: draftCartsURL) else { return nil }
        return try? JSONDecoder().decode([String: [PosCartLine]].self, from: data)
    }

    private static var paidHistoryURL: URL {
        directory.appendingPathComponent("paid-history.json")
    }

    static func savePaidHistory(_ linesBySession: [String: [PaidHistoryLine]]) {
        ioQueue.async {
            let encoder = JSONEncoder()
            guard let data = try? encoder.encode(linesBySession) else { return }
            try? data.write(to: paidHistoryURL, options: [.atomic])
        }
    }

    static func loadPaidHistory() -> [String: [PaidHistoryLine]]? {
        guard let data = try? Data(contentsOf: paidHistoryURL) else { return nil }
        return try? JSONDecoder().decode([String: [PaidHistoryLine]].self, from: data)
    }

    /// Tests: wartet auf ausstehende Writes.
    static func flushForTests() {
        ioQueue.sync {}
    }
}
