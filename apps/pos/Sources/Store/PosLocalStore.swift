import Foundation

/// Persistenter Cache für Bootstrap (Floor + Speisekarte) auf dem Kassen-iPad.
enum PosLocalStore {
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
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(bootstrap) else { return }
        try? data.write(to: bootstrapURL, options: [.atomic])
    }

    static func loadBootstrap() -> PosCloudBootstrap? {
        guard let data = try? Data(contentsOf: bootstrapURL) else { return nil }
        return try? JSONDecoder().decode(PosCloudBootstrap.self, from: data)
    }

    private static var reservationsURL: URL {
        directory.appendingPathComponent("reservations-cache.json")
    }

    static func saveReservationsCache(_ cache: [String: PosReservationsDayDto]) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(cache) else { return }
        try? data.write(to: reservationsURL, options: [.atomic])
    }

    static func loadReservationsCache() -> [String: PosReservationsDayDto]? {
        guard let data = try? Data(contentsOf: reservationsURL) else { return nil }
        return try? JSONDecoder().decode([String: PosReservationsDayDto].self, from: data)
    }
}
