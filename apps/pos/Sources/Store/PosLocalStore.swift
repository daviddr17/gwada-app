import Foundation

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

    /// Tests: wartet auf ausstehende Writes.
    static func flushForTests() {
        ioQueue.sync {}
    }
}
