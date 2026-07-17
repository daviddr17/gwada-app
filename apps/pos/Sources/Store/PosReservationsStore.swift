import Foundation

/// Tages-Cache für Reservierungen auf der Kasse (offline nach Start/Refresh).
/// Thread-safe wie `PosHubState` — LAN-Handler laufen off-main.
final class PosReservationsStore: @unchecked Sendable {
    static let shared = PosReservationsStore()

    private let lock = NSLock()
    private var selectedDayYmdValue: String
    private var cache: [String: PosReservationsDayDto] = [:]
    private var lastLoadedAtValue: Date?

    private init() {
        selectedDayYmdValue = Self.todayYmd()
        if let disk = PosLocalStore.loadReservationsCache() {
            cache = disk
        }
    }

    static func todayYmd(timeZone: TimeZone = .current) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let parts = cal.dateComponents([.year, .month, .day], from: Date())
        let y = parts.year ?? 1970
        let m = parts.month ?? 1
        let d = parts.day ?? 1
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    var selectedDayYmd: String {
        lock.lock(); defer { lock.unlock() }
        return selectedDayYmdValue
    }

    var currentDay: PosReservationsDayDto? {
        lock.lock(); defer { lock.unlock() }
        return cache[selectedDayYmdValue]
    }

    var lastLoadedAt: Date? {
        lock.lock(); defer { lock.unlock() }
        return lastLoadedAtValue
    }

    func selectDay(_ ymd: String) {
        lock.lock()
        selectedDayYmdValue = ymd
        lock.unlock()
    }

    func applyDay(_ dto: PosReservationsDayDto) {
        lock.lock()
        cache[dto.day] = dto
        lastLoadedAtValue = Date()
        let snapshot = cache
        lock.unlock()
        PosLocalStore.saveReservationsCache(snapshot)
    }

    func cachedDay(_ ymd: String) -> PosReservationsDayDto? {
        lock.lock(); defer { lock.unlock() }
        return cache[ymd]
    }

    /// Optimistic local insert (pending sync).
    func upsertLocalReservation(
        _ reservation: PosReservationDto,
        dayYmd: String,
        replacingLocalId: String? = nil
    ) {
        lock.lock()
        var day = cache[dayYmd] ?? PosReservationsDayDto(
            day: dayYmd,
            timezone: TimeZone.current.identifier,
            defaultDwellMinutes: 120,
            bookingTimeStepMinutes: 15,
            reservations: [],
            statuses: cache[selectedDayYmdValue]?.statuses ?? [],
            tables: cache[selectedDayYmdValue]?.tables ?? []
        )
        if let replacingLocalId {
            day.reservations.removeAll { $0.id == replacingLocalId }
        }
        if let idx = day.reservations.firstIndex(where: { $0.id == reservation.id }) {
            day.reservations[idx] = reservation
        } else {
            day.reservations.append(reservation)
        }
        day.reservations.sort { $0.startsAt < $1.startsAt }
        cache[dayYmd] = day
        lastLoadedAtValue = Date()
        let snapshot = cache
        lock.unlock()
        PosLocalStore.saveReservationsCache(snapshot)
    }
}
