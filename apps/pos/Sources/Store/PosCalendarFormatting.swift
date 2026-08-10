import Foundation

/// Deutsche Kalender-Helfer (Wochentag, ISO-KW) — timezone-stabil für die Datumsleiste.
enum PosCalendarFormatting {
    static var germanGregorian: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.locale = Locale(identifier: "de_DE")
        cal.timeZone = .current
        cal.firstWeekday = 2 // Montag
        cal.minimumDaysInFirstWeek = 4 // ISO-KW
        return cal
    }

    /// Kurzer Wochentag inkl. Punkt, z. B. „Di.“ — aus Kalender-Komponente (kein DateFormatter-EE).
    static func weekdayShort(_ date: Date) -> String {
        // Calendar.weekday: 1 = Sonntag … 7 = Samstag
        let weekday = germanGregorian.component(.weekday, from: date)
        let names = ["", "So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."]
        guard weekday >= 1, weekday <= 7 else { return "?" }
        return names[weekday]
    }

    static func dayNumber(_ date: Date) -> String {
        String(germanGregorian.component(.day, from: date))
    }

    static func monthYear(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.calendar = germanGregorian
        f.timeZone = .current
        f.dateFormat = "LLLL yyyy"
        return f.string(from: date).capitalized
    }

    /// ISO-ähnliche KW (Montag-Woche) für `date`.
    static func isoWeekOfYear(_ date: Date) -> Int {
        germanGregorian.component(.weekOfYear, from: date)
    }

    static func yearForWeekOfYear(_ date: Date) -> Int {
        germanGregorian.component(.yearForWeekOfYear, from: date)
    }

    static func headerLabel(_ date: Date) -> String {
        "\(monthYear(date)) · KW \(isoWeekOfYear(date))"
    }

    /// Montag der ISO-KW `week` im Jahr `yearForWeek`.
    static func mondayOfIsoWeek(week: Int, yearForWeek: Int) -> Date? {
        var comps = DateComponents()
        comps.weekOfYear = week
        comps.yearForWeekOfYear = yearForWeek
        comps.weekday = 2 // Montag (Sonntag=1)
        return germanGregorian.date(from: comps).map { germanGregorian.startOfDay(for: $0) }
    }

    static func startOfDay(_ date: Date) -> Date {
        germanGregorian.startOfDay(for: date)
    }
}
