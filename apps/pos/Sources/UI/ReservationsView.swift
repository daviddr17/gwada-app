import SwiftUI

/// Reservierungen an Kasse / Handheld — Cache nach Start, Reload nur bei Aktualisieren.
struct ReservationsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var selectedDate = Date()
    @State private var day: PosReservationsDayDto?
    @State private var loading = false
    @State private var showCreate = false
    @State private var errorText = ""

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

    private let timelineHours = Array(17 ... 23)

    var body: some View {
        List {
            Section {
                DatePicker(
                    "Tag",
                    selection: $selectedDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
                if let day {
                    Text(daySummary(day))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else if !errorText.isEmpty {
                    Text(errorText)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Cache für diesen Tag leer — Aktualisieren lädt von Kasse/Cloud.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if let day, Self.isSameDay(selectedDate, as: Date()) {
                Section("Timeline") {
                    timelineStrip(day)
                    if let soon = demnaechst(day) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Demnächst")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text("\(Self.formatTime(soon.startsAt)) · \(soon.guestLabel) · \(soon.partySize) Pers.")
                                .font(.subheadline.weight(.semibold))
                            if conflictUnder60(soon) {
                                Text("Konflikt < 60 min — Platz prüfen")
                                    .font(.caption)
                                    .foregroundStyle(PosDesign.statusConflict)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            if loading && day == nil {
                Section {
                    HStack {
                        ProgressView()
                        Text("Lade …")
                            .foregroundStyle(.secondary)
                    }
                }
            } else if let day, !day.reservations.isEmpty {
                Section("Reservierungen") {
                    ForEach(day.reservations) { reservation in
                        reservationRow(reservation)
                    }
                }
            } else {
                Section {
                    ContentUnavailableView {
                        Label("Keine Reservierungen", systemImage: "calendar")
                    } description: {
                        Text("Neue Reservierung anlegen oder Tag aktualisieren.")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Reservierungen")
        .navigationBarTitleDisplayMode(.large)
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
                Button {
                    Task { await reloadFromSource() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(loading)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    prepareCreateDefaults()
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task { syncFromStore() }
        .onChange(of: selectedDate) { _, _ in
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

    private func timelineStrip(_ day: PosReservationsDayDto) -> some View {
        let now = timelineTick
        let cal = Calendar.current
        let currentHour = cal.component(.hour, from: now)
        let currentMinute = cal.component(.minute, from: now)

        return VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(timelineHours, id: \.self) { hour in
                        let count = countReservations(day, hour: hour)
                        VStack(spacing: 6) {
                            Text(String(format: "%02d", hour))
                                .font(.caption2.monospacedDigit().weight(.semibold))
                                .foregroundStyle(hour == currentHour ? Color.accentColor : .secondary)
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(count > 0 ? Color.accentColor.opacity(0.2 + 0.15 * Double(min(count, 4))) : Color(.tertiarySystemFill))
                                .frame(width: 44, height: 36)
                                .overlay {
                                    if count > 0 {
                                        Text("\(count)")
                                            .font(.caption.weight(.bold).monospacedDigit())
                                    }
                                }
                            if hour == currentHour {
                                // Jetzt-Marker
                                Capsule()
                                    .fill(Color.accentColor)
                                    .frame(width: 2, height: 10)
                                    .offset(x: CGFloat(currentMinute) / 60.0 * 22 - 11)
                            } else {
                                Color.clear.frame(height: 10)
                            }
                        }
                        .frame(width: 52)
                    }
                }
                .padding(.vertical, 4)
            }
            Text("17–23 Uhr · Marker = jetzt")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func countReservations(_ day: PosReservationsDayDto, hour: Int) -> Int {
        day.reservations.filter { hourOf($0.startsAt) == hour }.count
    }

    private func hourOf(_ iso: String) -> Int? {
        guard let date = Self.parseDate(iso) else { return nil }
        return Calendar.current.component(.hour, from: date)
    }

    private func demnaechst(_ day: PosReservationsDayDto) -> PosReservationDto? {
        let now = timelineTick
        return day.reservations
            .compactMap { r -> (PosReservationDto, Date)? in
                guard let d = Self.parseDate(r.startsAt), d >= now else { return nil }
                return (r, d)
            }
            .sorted { $0.1 < $1.1 }
            .first?
            .0
    }

    private func conflictUnder60(_ r: PosReservationDto) -> Bool {
        guard let d = Self.parseDate(r.startsAt) else { return false }
        let delta = d.timeIntervalSince(timelineTick)
        return delta > 0 && delta < 3600
    }

    private static func isSameDay(_ a: Date, as b: Date) -> Bool {
        Calendar.current.isDate(a, inSameDayAs: b)
    }

    private static func parseDate(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    private func daySummary(_ day: PosReservationsDayDto) -> String {
        let guests = day.reservations.reduce(0) { $0 + $1.partySize }
        return "\(day.reservations.count) Reservierungen · \(guests) Gäste"
    }

    private func reservationRow(_ r: PosReservationDto) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(Self.formatTime(r.startsAt))
                    .font(.headline.monospacedDigit())
                Text("·")
                    .foregroundStyle(.secondary)
                Text(r.guestLabel)
                    .font(.headline)
                Spacer()
                if let status = r.status {
                    PosStatusBadge(
                        title: status.name,
                        emphasized: status.code == "confirmed" || status.code == "seated",
                        tint: PosDesign.color(hex: status.colorHex)
                    )
                }
            }
            HStack {
                Text("\(r.partySize) Pers.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("·")
                    .foregroundStyle(.secondary)
                Text(r.tableLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if r.reservationNumber > 0 {
                    Spacer()
                    Text("#\(r.reservationNumber)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.tertiary)
                }
            }
            if let phone = r.guestPhone, !phone.isEmpty {
                Text(phone)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let notes = r.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

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

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
