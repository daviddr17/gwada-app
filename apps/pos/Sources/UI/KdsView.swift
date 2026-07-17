import SwiftUI

/// Küchen-Display — Cloud-Tickets; Tippen wechselt zum nächsten konfigurierten Status.
/// Statuswechsel ist sofort optisch (optimistic), damit niemand doppelt tippt.
struct KdsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var tickets: [KdsTicket] = []
    @State private var statuses: [PosCloudKdsStatus] = []
    @State private var status = "Lädt …"
    @State private var dense = false
    /// Pro Ticket: Tap gesperrt bis Advance fertig (verhindert Doppel-Advance).
    @State private var advancingIds: Set<String> = []

    var body: some View {
        VStack(spacing: 0) {
            settingsBar
            Divider()
            if tickets.isEmpty {
                ContentUnavailableView {
                    Label("Keine Tickets", systemImage: "flame")
                } description: {
                    Text(status)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: dense ? 160 : 220), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(tickets) { ticket in
                            ticketCard(ticket)
                                .opacity(advancingIds.contains(ticket.orderId) ? 0.72 : 1)
                                .scaleEffect(advancingIds.contains(ticket.orderId) ? 0.985 : 1)
                                .animation(.easeOut(duration: 0.12), value: advancingIds.contains(ticket.orderId))
                                .animation(.easeOut(duration: 0.12), value: ticket.statusId)
                                .onTapGesture {
                                    handleTap(ticket)
                                }
                        }
                    }
                    .padding(16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("KDS")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .refreshable { await reload() }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: advancingIds.count)
    }

    private var settingsBar: some View {
        HStack(spacing: 12) {
            Toggle("Kompakt", isOn: $dense).toggleStyle(.button)
            Text("Tippen = nächster Status")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Button { Task { await reload() } } label: {
                Image(systemName: "arrow.clockwise")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func ticketCard(_ ticket: KdsTicket) -> some View {
        let color = Color(hex: ticket.statusColor) ?? .accentColor
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(ticket.orderNumber)")
                    .font(.title3.weight(.bold).monospacedDigit())
                Spacer()
                Text(ticket.statusName.uppercased())
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(color.opacity(0.18))
                    .foregroundStyle(color)
                    .clipShape(Capsule())
            }
            ForEach(ticket.lines) { line in
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(line.quantity)× \(line.name)")
                        .font(dense ? .subheadline.weight(.semibold) : .body.weight(.semibold))
                    if !line.detail.isEmpty {
                        Text(line.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer(minLength: 0)
            Text(advancingIds.contains(ticket.orderId) ? "Wird gespeichert …" : "Tippen → weiter")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .frame(minHeight: dense ? 120 : 160, alignment: .topLeading)
        .background(Color(.secondarySystemGroupedBackground))
        .overlay(
            RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous)
                .strokeBorder(color.opacity(0.45), lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous))
    }

    /// Synchron vor dem Netzwerk: UI sofort, Tap für dieses Ticket sperren.
    private func handleTap(_ ticket: KdsTicket) {
        guard !advancingIds.contains(ticket.orderId) else { return }
        advancingIds.insert(ticket.orderId)

        let snapshot = ticket
        applyOptimisticAdvance(for: ticket.orderId)

        Task {
            await persistAdvance(snapshot)
            advancingIds.remove(ticket.orderId)
        }
    }

    private func applyOptimisticAdvance(for orderId: String) {
        guard let idx = tickets.firstIndex(where: { $0.orderId == orderId }) else { return }
        let current = tickets[idx]
        let list = resolvedStatuses()
        guard !list.isEmpty else {
            // Keine Statusliste → Ticket kurz markieren, Server entscheidet
            return
        }

        let currentIndex: Int = {
            if let id = current.statusId, let i = list.firstIndex(where: { $0.id == id }) {
                return i
            }
            if let i = list.firstIndex(where: {
                $0.name.caseInsensitiveCompare(current.statusName) == .orderedSame
            }) {
                return i
            }
            return -1
        }()

        let nextIndex = currentIndex + 1
        if nextIndex >= list.count {
            withAnimation(.easeOut(duration: 0.15)) {
                tickets.remove(at: idx)
            }
            status = tickets.isEmpty ? "Keine Küchen-Tickets." : "\(tickets.count) Tickets · Tippen = weiter"
            return
        }

        let next = list[nextIndex]
        withAnimation(.easeOut(duration: 0.12)) {
            tickets[idx].statusId = next.id
            tickets[idx].statusName = next.name
            tickets[idx].statusColor = next.color
        }
    }

    private func resolvedStatuses() -> [PosCloudKdsStatus] {
        if !statuses.isEmpty { return statuses }
        return PosHubState.shared.kitchen?.activeKdsStatuses ?? []
    }

    private func persistAdvance(_ ticket: KdsTicket) async {
        guard runtime.isSignedIn, let restaurantId = PosCloudConfig.restaurantId else {
            status = "KDS: Kasse anmelden"
            await reload()
            return
        }
        do {
            let res = try await PosCloudClient.advanceKdsTicket(
                restaurantId: restaurantId,
                orderId: ticket.orderId
            )
            if res.printRequested == true {
                let lines: [[String: Any]] = (res.lines ?? []).map { line in
                    [
                        "id": line.id,
                        "name": line.name,
                        "quantity": line.quantity,
                        "detail": line.detail ?? "",
                        "course": line.course ?? "",
                        "categoryId": "",
                    ]
                }
                PosHubState.shared.enqueueKitchenPrintFromCloud(
                    orderNumber: res.orderNumber ?? ticket.orderNumber,
                    printerIds: res.printerIds ?? [],
                    lines: lines
                )
            }

            if res.done == true {
                withAnimation(.easeOut(duration: 0.12)) {
                    tickets.removeAll { $0.orderId == ticket.orderId }
                }
                status = tickets.isEmpty ? "Keine Küchen-Tickets." : "\(tickets.count) Tickets · Tippen = weiter"
            } else if let next = res.ticket {
                if let idx = tickets.firstIndex(where: { $0.orderId == ticket.orderId }) {
                    tickets[idx].statusId = next.statusId ?? tickets[idx].statusId
                    tickets[idx].statusName = next.statusName ?? next.status ?? tickets[idx].statusName
                    tickets[idx].statusColor = next.statusColor ?? tickets[idx].statusColor
                }
            }
            // Leichter Abgleich ohne sichtbares Flackern — nur wenn nötig
            if tickets.isEmpty {
                await reload()
            }
        } catch {
            status = error.localizedDescription
            await reload()
        }
    }

    private func reload() async {
        status = "Aktualisiere …"
        guard runtime.isSignedIn, let restaurantId = PosCloudConfig.restaurantId else {
            tickets = []
            status = "KDS: Kasse anmelden. Lokal: http://<Kassen-IP>:8787/v1/kds"
            return
        }
        do {
            let res = try await PosCloudClient.fetchKdsTickets(restaurantId: restaurantId)
            if let remoteStatuses = res.statuses, !remoteStatuses.isEmpty {
                statuses = remoteStatuses.filter(\.isActive).sorted { $0.sortOrder < $1.sortOrder }
            } else if let hub = PosHubState.shared.kitchen?.activeKdsStatuses, !hub.isEmpty {
                statuses = hub
            }
            tickets = res.tickets.map { t in
                KdsTicket(
                    orderId: t.orderId,
                    orderNumber: t.orderNumber,
                    statusId: t.statusId,
                    statusName: t.statusName ?? t.status,
                    statusColor: t.statusColor ?? "#3b82f6",
                    lines: t.lines.map { l in
                        var parts: [String] = []
                        if let c = l.course, let course = PosCourse(rawValue: c) {
                            parts.append(course.label)
                        }
                        if let mods = l.modifiers {
                            parts.append(contentsOf: mods.compactMap(\.label))
                        }
                        if let n = l.notes, !n.isEmpty { parts.append(n) }
                        return KdsTicketLine(
                            id: l.id,
                            name: l.name,
                            quantity: l.quantity,
                            detail: parts.joined(separator: " · ")
                        )
                    }
                )
            }
            status = tickets.isEmpty ? "Keine Küchen-Tickets." : "\(tickets.count) Tickets · Tippen = weiter"
        } catch {
            tickets = []
            status = error.localizedDescription
        }
    }
}

struct KdsTicket: Identifiable, Equatable {
    var id: String { orderId }
    var orderId: String
    var orderNumber: Int
    var statusId: String?
    var statusName: String
    var statusColor: String
    var lines: [KdsTicketLine]
}

struct KdsTicketLine: Identifiable, Equatable {
    var id: String
    var name: String
    var quantity: Int
    var detail: String
}

private extension Color {
    init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt64(h, radix: 16) else { return nil }
        let r = Double((v >> 16) & 0xFF) / 255
        let g = Double((v >> 8) & 0xFF) / 255
        let b = Double(v & 0xFF) / 255
        self = Color(red: r, green: g, blue: b)
    }
}
