import SwiftUI

/// Reservierungen — Schedule-Timeline (Wochenstreifen + vertikale Tagesachse).
struct ReservationsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var selectedDate = Date()
    @State private var day: PosReservationsDayDto?
    @State private var loading = false
    @State private var showCreate = false
    @State private var errorText = ""
    @State private var expandedReservationId: String?

    @State private var guestLastName = ""
    @State private var guestFirstName = ""
    @State private var guestPhone = ""
    @State private var partySize = 2
    @State private var timeHm = "19:00"
    @State private var tableId: String?
    @State private var notes = ""
    @State private var creating = false
    @State private var showWalkIn = false
    @State private var timelineTick = Date()

    private let hourHeight: CGFloat = 88
    private let timeColumnWidth: CGFloat = 52
    private let defaultStartHour = 17
    private let defaultEndHour = 23

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                headerChrome
                weekStrip
                    .padding(.horizontal, PosDesign.sectionSpacing)
                    .padding(.bottom, 12)

                Divider().opacity(0.35)

                timelineBody
            }

            fabButton
                .padding(.trailing, 20)
                .padding(.bottom, 20)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Reservierungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showWalkIn = true
                } label: {
                    Image(systemName: "person.badge.plus")
                }
                .accessibilityLabel("Walk-in")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task { await reloadFromSource() }
                    } label: {
                        Label("Aktualisieren", systemImage: "arrow.clockwise")
                    }
                    .disabled(loading)
                    Button {
                        selectedDate = Date()
                        syncFromStore()
                    } label: {
                        Label("Heute", systemImage: "calendar")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task { syncFromStore() }
        .onChange(of: selectedDate) { _, _ in
            expandedReservationId = nil
            syncFromStore()
        }
        .sheet(isPresented: $showCreate) {
            createSheet
        }
        .sheet(isPresented: $showWalkIn) {
            WalkInSheet()
                .environmentObject(runtime)
        }
        .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { date in
            timelineTick = date
        }
    }

    // MARK: - Header

    private var headerChrome: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                monthYearMenu
                Spacer()
                if let day {
                    Text(daySummary(day))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                } else if loading {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            if !errorText.isEmpty, day == nil {
                Text(errorText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, PosDesign.sectionSpacing)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private var monthYearMenu: some View {
        Menu {
            DatePicker(
                "Monat",
                selection: $selectedDate,
                displayedComponents: [.date]
            )
            .datePickerStyle(.graphical)
            .labelsHidden()
        } label: {
            HStack(spacing: 6) {
                Text(monthYearLabel)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var monthYearLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateFormat = "LLLL yyyy"
        return f.string(from: selectedDate).capitalized
    }

    // MARK: - Week strip

    private var weekStrip: some View {
        let days = weekDays(around: selectedDate)
        return HStack(spacing: 6) {
            ForEach(days, id: \.self) { date in
                let selected = Calendar.current.isDate(date, inSameDayAs: selectedDate)
                let isToday = Calendar.current.isDateInToday(date)
                Button {
                    selectedDate = date
                } label: {
                    VStack(spacing: 6) {
                        Text(weekdayShort(date))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(selected ? Color.accentColor : .secondary)
                        Text(dayNumber(date))
                            .font(.headline.monospacedDigit().weight(.semibold))
                            .foregroundStyle(selected ? PosDesign.accentForeground : .primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(selected ? Color.accentColor.opacity(0.22) : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(
                                selected
                                    ? Color.accentColor.opacity(0.45)
                                    : (isToday ? Color.accentColor.opacity(0.25) : Color.clear),
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Timeline

    @ViewBuilder
    private var timelineBody: some View {
        if loading && day == nil {
            VStack(spacing: 12) {
                ProgressView()
                Text("Lade Reservierungen …")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            let reservations = day?.reservations ?? []
            if reservations.isEmpty {
                ContentUnavailableView {
                    Label("Keine Reservierungen", systemImage: "calendar")
                } description: {
                    Text("Neue Reservierung anlegen oder Tag aktualisieren.")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                let range = hourRange
                ScrollView {
                    ZStack(alignment: .topLeading) {
                        hourGrid(startHour: range.start, endHour: range.end)
                        reservationCardsLayer(
                            reservations: reservations,
                            startHour: range.start,
                            endHour: range.end
                        )
                        if Calendar.current.isDateInToday(selectedDate) {
                            nowLine(startHour: range.start, endHour: range.end)
                        }
                    }
                    .frame(height: CGFloat(range.end - range.start) * hourHeight + 24)
                    .padding(.horizontal, PosDesign.sectionSpacing)
                    .padding(.top, 12)
                    .padding(.bottom, 96)
                }
            }
        }
    }

    private func hourGrid(startHour: Int, endHour: Int) -> some View {
        VStack(spacing: 0) {
            ForEach(startHour ..< endHour, id: \.self) { hour in
                HStack(alignment: .top, spacing: 10) {
                    Text(hourLabel(hour))
                        .font(.caption.monospacedDigit().weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(width: timeColumnWidth, alignment: .trailing)
                        .offset(y: -7)
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(Color(.separator).opacity(0.45))
                            .frame(height: 1)
                        Spacer(minLength: 0)
                    }
                }
                .frame(height: hourHeight, alignment: .top)
            }
        }
    }

    private func reservationCardsLayer(
        reservations: [PosReservationDto],
        startHour: Int,
        endHour: Int
    ) -> some View {
        let layout = layoutReservations(reservations, startHour: startHour, endHour: endHour)
        return GeometryReader { geo in
            let contentWidth = max(0, geo.size.width - timeColumnWidth - 10)
            ForEach(layout) { item in
                let width = (contentWidth - CGFloat(max(0, item.laneCount - 1)) * 6)
                    / CGFloat(max(1, item.laneCount))
                let x = timeColumnWidth + 10 + CGFloat(item.lane) * (width + 6)
                ReservationTimelineCard(
                    reservation: item.reservation,
                    timeRangeLabel: timeRangeLabel(item.reservation),
                    expanded: expandedReservationId == item.reservation.id,
                    conflictSoon: conflictUnder60(item.reservation)
                ) {
                    withAnimation(.snappy(duration: 0.22)) {
                        if expandedReservationId == item.reservation.id {
                            expandedReservationId = nil
                        } else {
                            expandedReservationId = item.reservation.id
                        }
                    }
                }
                .frame(width: width, height: max(64, item.height), alignment: .top)
                .offset(x: x, y: item.y)
            }
        }
    }

    @ViewBuilder
    private func nowLine(startHour: Int, endHour: Int) -> some View {
        let minutes = minutesFromMidnight(timelineTick)
        let startMin = startHour * 60
        let endMin = endHour * 60
        if minutes >= startMin, minutes <= endMin {
            let y = CGFloat(minutes - startMin) / 60.0 * hourHeight
            HStack(spacing: 0) {
                Spacer().frame(width: timeColumnWidth + 4)
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 8, height: 8)
                Rectangle()
                    .fill(Color.accentColor)
                    .frame(height: 2)
            }
            .offset(y: y - 4)
            .allowsHitTesting(false)
        }
    }

    private var fabButton: some View {
        Button {
            prepareCreateDefaults()
            showCreate = true
        } label: {
            Image(systemName: "plus")
                .font(.title3.weight(.bold))
                .foregroundStyle(PosDesign.accentForeground)
                .frame(width: 56, height: 56)
                .background(Color.accentColor, in: Circle())
                .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        }
        .accessibilityLabel("Neue Reservierung")
    }

    // MARK: - Layout math

    private var hourRange: (start: Int, end: Int) {
        var start = defaultStartHour
        var end = defaultEndHour
        for r in day?.reservations ?? [] {
            guard let s = Self.parseDate(r.startsAt), let e = Self.parseDate(r.endsAt) else { continue }
            start = min(start, Calendar.current.component(.hour, from: s))
            let endHour = Calendar.current.component(.hour, from: e)
            let endMinute = Calendar.current.component(.minute, from: e)
            end = max(end, endMinute > 0 ? endHour + 1 : max(endHour, endHour + (endHour == start ? 1 : 0)))
        }
        start = max(0, min(start, 22))
        end = max(start + 1, min(end, 24))
        return (start, end)
    }

    private struct LaidOutReservation: Identifiable {
        var id: String { reservation.id }
        var reservation: PosReservationDto
        var y: CGFloat
        var height: CGFloat
        var lane: Int
        var laneCount: Int
        var startMin: Int
        var endMin: Int
    }

    private func layoutReservations(
        _ reservations: [PosReservationDto],
        startHour: Int,
        endHour: Int
    ) -> [LaidOutReservation] {
        let windowStart = startHour * 60
        let windowEnd = endHour * 60
        var items: [(PosReservationDto, Int, Int)] = []
        for r in reservations {
            guard let start = Self.parseDate(r.startsAt) else { continue }
            let end = Self.parseDate(r.endsAt) ?? start.addingTimeInterval(TimeInterval((day?.defaultDwellMinutes ?? 120) * 60))
            var sMin = minutesFromMidnight(start)
            var eMin = minutesFromMidnight(end)
            if eMin <= sMin { eMin = sMin + 60 }
            sMin = max(sMin, windowStart)
            eMin = min(eMin, windowEnd)
            guard eMin > sMin else { continue }
            items.append((r, sMin, eMin))
        }
        items.sort { $0.1 < $1.1 || ($0.1 == $1.1 && $0.2 < $1.2) }

        var laneEnds: [Int] = []
        var provisional: [(PosReservationDto, Int, Int, Int)] = []
        for item in items {
            var lane = 0
            while lane < laneEnds.count, laneEnds[lane] > item.1 {
                lane += 1
            }
            if lane == laneEnds.count {
                laneEnds.append(item.2)
            } else {
                laneEnds[lane] = item.2
            }
            provisional.append((item.0, item.1, item.2, lane))
        }

        let maxLane = (provisional.map(\.3).max() ?? 0) + 1
        // Cluster overlapping groups so laneCount is local, not global.
        return assignClusterLaneCounts(provisional, maxLaneHint: maxLane, windowStart: windowStart)
    }

    private func assignClusterLaneCounts(
        _ provisional: [(PosReservationDto, Int, Int, Int)],
        maxLaneHint _: Int,
        windowStart: Int
    ) -> [LaidOutReservation] {
        guard !provisional.isEmpty else { return [] }

        var result: [LaidOutReservation] = []
        var cluster: [(PosReservationDto, Int, Int, Int)] = []
        var clusterEnd = 0

        func flush() {
            guard !cluster.isEmpty else { return }
            let laneCount = (cluster.map(\.3).max() ?? 0) + 1
            for item in cluster {
                let y = CGFloat(item.1 - windowStart) / 60.0 * hourHeight
                let height = CGFloat(item.2 - item.1) / 60.0 * hourHeight
                result.append(
                    LaidOutReservation(
                        reservation: item.0,
                        y: y,
                        height: height,
                        lane: item.3,
                        laneCount: laneCount,
                        startMin: item.1,
                        endMin: item.2
                    )
                )
            }
            cluster.removeAll()
        }

        for item in provisional.sorted(by: { $0.1 < $1.1 }) {
            if cluster.isEmpty {
                cluster = [item]
                clusterEnd = item.2
            } else if item.1 < clusterEnd {
                cluster.append(item)
                clusterEnd = max(clusterEnd, item.2)
            } else {
                flush()
                cluster = [item]
                clusterEnd = item.2
            }
        }
        flush()
        return result
    }

    private func minutesFromMidnight(_ date: Date) -> Int {
        let cal = Calendar.current
        return cal.component(.hour, from: date) * 60 + cal.component(.minute, from: date)
    }

    private func hourLabel(_ hour: Int) -> String {
        String(format: "%02d:00", hour)
    }

    private func timeRangeLabel(_ r: PosReservationDto) -> String {
        "\(Self.formatTime(r.startsAt)) – \(Self.formatTime(r.endsAt))"
    }

    private func conflictUnder60(_ r: PosReservationDto) -> Bool {
        guard Calendar.current.isDateInToday(selectedDate),
              let d = Self.parseDate(r.startsAt)
        else { return false }
        let delta = d.timeIntervalSince(timelineTick)
        return delta > 0 && delta < 3600
    }

    // MARK: - Week helpers

    private func weekDays(around date: Date) -> [Date] {
        var cal = Calendar.current
        cal.firstWeekday = 2 // Montag
        let weekday = cal.component(.weekday, from: date)
        let daysFromMonday = (weekday + 5) % 7
        guard let monday = cal.date(byAdding: .day, value: -daysFromMonday, to: cal.startOfDay(for: date))
        else { return [date] }
        return (0 ..< 7).compactMap { cal.date(byAdding: .day, value: $0, to: monday) }
    }

    private func weekdayShort(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateFormat = "EE"
        return f.string(from: date)
    }

    private func dayNumber(_ date: Date) -> String {
        String(Calendar.current.component(.day, from: date))
    }

    private func daySummary(_ day: PosReservationsDayDto) -> String {
        let guests = day.reservations.reduce(0) { $0 + $1.partySize }
        return "\(day.reservations.count) Res. · \(guests) Gäste"
    }

    // MARK: - Create sheet (unchanged flow)

    private var createSheet: some View {
        NavigationStack {
            Form {
                Section("Gast") {
                    TextField("Nachname", text: $guestLastName)
                        .textInputAutocapitalization(.words)
                    TextField("Vorname", text: $guestFirstName)
                        .textInputAutocapitalization(.words)
                    TextField("Telefon", text: $guestPhone)
                        .keyboardType(.phonePad)
                    Stepper("Personen: \(partySize)", value: $partySize, in: 1 ... 50)
                }
                Section("Termin") {
                    DatePicker("Tag", selection: $selectedDate, displayedComponents: .date)
                    TextField("Uhrzeit (HH:mm)", text: $timeHm)
                        .keyboardType(.numbersAndPunctuation)
                        .textInputAutocapitalization(.never)
                }
                if let tables = day?.tables, !tables.isEmpty {
                    Section("Tisch") {
                        Picker("Tisch", selection: $tableId) {
                            Text("Kein Tisch").tag(String?.none)
                            ForEach(tables) { t in
                                Text(tableLabel(t)).tag(Optional(t.id))
                            }
                        }
                    }
                }
                Section("Notiz") {
                    TextField("Optional", text: $notes, axis: .vertical)
                        .lineLimit(2 ... 4)
                }
                if !errorText.isEmpty {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Neue Reservierung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { showCreate = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Anlegen") {
                        Task { await create() }
                    }
                    .disabled(creating || guestLastName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func tableLabel(_ t: PosReservationTableDto) -> String {
        if let name = t.tableName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return "\(name) (\(t.capacity))"
        }
        return "Tisch \(t.tableNumber) (\(t.capacity))"
    }

    private func prepareCreateDefaults() {
        errorText = ""
        if timeHm.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            timeHm = "19:00"
        }
    }

    private func syncFromStore() {
        let ymd = Self.ymd(from: selectedDate)
        runtime.selectReservationsDay(ymd)
        day = PosReservationsStore.shared.cachedDay(ymd)
        errorText = ""
    }

    private func reloadFromSource() async {
        loading = true
        errorText = ""
        defer { loading = false }
        let ymd = Self.ymd(from: selectedDate)
        runtime.selectReservationsDay(ymd)
        await runtime.pullReservationsDay(ymd)
        day = PosReservationsStore.shared.cachedDay(ymd)
        if day == nil {
            errorText = "Tag noch nicht geladen."
        }
    }

    private func create() async {
        errorText = ""
        let last = guestLastName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !last.isEmpty else {
            errorText = "Nachname erforderlich."
            return
        }
        guard let hm = normalizeHm(timeHm) else {
            errorText = "Uhrzeit als HH:mm eingeben."
            return
        }
        let ymd = Self.ymd(from: selectedDate)
        let dwell = day?.defaultDwellMinutes ?? 120
        let tz = day?.timezone ?? TimeZone.current.identifier
        guard let startsAt = Self.isoStart(ymd: ymd, hm: hm, timeZoneId: tz),
              let endsAt = Self.isoEnd(startIso: startsAt, dwellMinutes: dwell)
        else {
            errorText = "Termin ungültig."
            return
        }

        creating = true
        defer { creating = false }

        let payload = PosCreateReservationPayload(
            restaurantId: PosHubState.shared.restaurantId,
            guestFirstName: guestFirstName.trimmingCharacters(in: .whitespacesAndNewlines),
            guestLastName: last,
            guestPhone: guestPhone.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            guestEmail: nil,
            partySize: partySize,
            startsAt: startsAt,
            endsAt: endsAt,
            statusId: day?.statuses.first(where: { $0.code == "confirmed" })?.id,
            diningTableId: tableId,
            dwellMinutes: dwell,
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            notifyEmail: false,
            notifyWhatsapp: false,
            localId: UUID().uuidString
        )

        let ok = await runtime.createReservation(payload)
        if ok {
            showCreate = false
            guestLastName = ""
            guestFirstName = ""
            guestPhone = ""
            notes = ""
            partySize = 2
            syncFromStore()
        } else {
            errorText = runtime.statusMessage
        }
    }

    private func normalizeHm(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = trimmed.split(separator: ":")
        guard parts.count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]),
              (0 ... 23).contains(h), (0 ... 59).contains(m)
        else { return nil }
        return String(format: "%02d:%02d", h, m)
    }

    private static func ymd(from date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let p = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", p.year ?? 1970, p.month ?? 1, p.day ?? 1)
    }

    private static func formatTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return String(iso.dropFirst(11).prefix(5)) }
        let out = DateFormatter()
        out.locale = Locale(identifier: "de_DE")
        out.dateFormat = "HH:mm"
        return out.string(from: date)
    }

    private static func parseDate(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    private static func isoStart(ymd: String, hm: String, timeZoneId: String) -> String? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: timeZoneId) ?? .current
        let parts = ymd.split(separator: "-").compactMap { Int($0) }
        let time = hm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 3, time.count == 2 else { return nil }
        var comps = DateComponents()
        comps.year = parts[0]
        comps.month = parts[1]
        comps.day = parts[2]
        comps.hour = time[0]
        comps.minute = time[1]
        comps.second = 0
        guard let date = cal.date(from: comps) else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f.string(from: date)
    }

    private static func isoEnd(startIso: String, dwellMinutes: Int) -> String? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: startIso) ?? ISO8601DateFormatter().date(from: startIso)
        guard let date else { return nil }
        let end = date.addingTimeInterval(TimeInterval(dwellMinutes * 60))
        let out = ISO8601DateFormatter()
        out.formatOptions = [.withInternetDateTime]
        out.timeZone = TimeZone(secondsFromGMT: 0)
        return out.string(from: end)
    }
}

// MARK: - Timeline card

private struct ReservationTimelineCard: View {
    let reservation: PosReservationDto
    let timeRangeLabel: String
    let expanded: Bool
    let conflictSoon: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                Text(reservation.guestLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(expanded ? 2 : 1)

                Text(statusLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 0)

                if expanded, let notes = reservation.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(.tertiarySystemFill))
                        )
                }

                HStack(alignment: .center, spacing: 8) {
                    partyAvatars
                    Spacer(minLength: 4)
                    Label(timeRangeLabel, systemImage: "clock")
                        .font(.caption2.monospacedDigit().weight(.medium))
                        .foregroundStyle(.secondary)
                        .labelStyle(.titleAndIcon)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
                    .shadow(color: .black.opacity(0.06), radius: 8, y: 3)
            )
            .overlay(
                RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: conflictSoon || expanded ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var statusLine: String {
        var parts: [String] = []
        if let status = reservation.status?.name, !status.isEmpty {
            parts.append(status)
        }
        parts.append("\(reservation.partySize) Pers.")
        parts.append(reservation.tableLabel)
        if conflictSoon {
            parts.append("bald")
        }
        return parts.joined(separator: " · ")
    }

    private var borderColor: Color {
        if conflictSoon { return PosDesign.statusConflict.opacity(0.55) }
        if let hex = reservation.status?.colorHex {
            return PosDesign.color(hex: hex).opacity(expanded ? 0.55 : 0.28)
        }
        return Color(.separator).opacity(0.35)
    }

    private var partyAvatars: some View {
        let count = min(max(reservation.partySize, 1), 4)
        return HStack(spacing: -6) {
            ForEach(0 ..< count, id: \.self) { index in
                Circle()
                    .fill(avatarColor(index))
                    .frame(width: 22, height: 22)
                    .overlay {
                        Text(avatarInitial(index))
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .overlay(Circle().strokeBorder(Color(.secondarySystemGroupedBackground), lineWidth: 1.5))
            }
            if reservation.partySize > 4 {
                Text("+\(reservation.partySize - 4)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.leading, 8)
            }
        }
    }

    private func avatarInitial(_ index: Int) -> String {
        let name = reservation.guestLabel
        let parts = name.split(separator: " ")
        if index == 0, let first = parts.first?.first {
            return String(first).uppercased()
        }
        if index == 1, parts.count > 1, let second = parts.last?.first {
            return String(second).uppercased()
        }
        return "\(min(reservation.partySize, index + 1))"
    }

    private func avatarColor(_ index: Int) -> Color {
        let palette: [Color] = [
            Color.accentColor.opacity(0.85),
            Color.orange.opacity(0.8),
            Color.teal.opacity(0.8),
            Color.indigo.opacity(0.75),
        ]
        return palette[index % palette.count]
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
