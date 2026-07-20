import SwiftUI
import Combine

/// Küchen-Display — Tickets lokal von der iPad-Kasse (LAN bzw. Hub-State).
/// Tippen wechselt zum nächsten Status. Sync zur Cloud nur über die Kasse.
struct KdsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var tickets: [KdsTicket] = []
    @State private var statuses: [PosCloudKdsStatus] = []
    @State private var status = "Lädt …"
    @State private var dense = false
    @State private var advancingIds: Set<String> = []
    @State private var hubTicketTimer = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

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
        .onReceive(hubTicketTimer) { _ in
            guard runtime.role == .hub else { return }
            Task { await reload() }
        }
    }

    private var settingsBar: some View {
        HStack {
            Text(status)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Toggle("Kompakt", isOn: $dense)
                .labelsHidden()
            Text("Kompakt")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func ticketCard(_ ticket: KdsTicket) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(ticket.orderNumber)")
                    .font(.headline)
                Spacer()
                Text(ticket.statusName)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background((Color(hex: ticket.statusColor) ?? .accentColor).opacity(0.2))
                    .clipShape(Capsule())
            }
            ForEach(ticket.lines) { line in
                Text("\(line.quantity)× \(line.name)")
                    .font(.subheadline)
                if !line.detail.isEmpty {
                    Text(line.detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func handleTap(_ ticket: KdsTicket) {
        guard !advancingIds.contains(ticket.orderId) else { return }
        advancingIds.insert(ticket.orderId)
        Task {
            await persistAdvance(ticket)
            advancingIds.remove(ticket.orderId)
        }
    }

    private func persistAdvance(_ ticket: KdsTicket) async {
        guard runtime.isSignedIn else {
            status = "KDS: PIN anmelden"
            await reload()
            return
        }
        do {
            if runtime.role == .handheld {
                guard let base = runtime.hubBaseURL else {
                    status = "Keine Kasse verbunden."
                    return
                }
                _ = try await HandheldHubClient.advanceKdsTicket(baseURL: base, orderId: ticket.orderId)
            } else {
                _ = PosHubState.shared.advanceLocalTicket(orderId: ticket.orderId)
                Task { await PosPrintDispatcher.shared.kick() }
            }
            await reload()
        } catch {
            status = error.localizedDescription
            await reload()
        }
    }

    private func reload() async {
        status = "Aktualisiere …"
        guard runtime.isSignedIn else {
            tickets = []
            status = "KDS: mit Display-PIN anmelden."
            return
        }
        do {
            let data: Data
            if runtime.role == .handheld {
                guard let base = runtime.hubBaseURL else {
                    tickets = []
                    status = "Keine Kasse — KDS nur über iPad-Kasse im WLAN."
                    return
                }
                data = try await HandheldHubClient.fetchKdsTickets(baseURL: base, deviceId: nil)
            } else {
                data = PosHubState.shared.kdsTicketsJSON(deviceId: nil)
            }
            let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rawTickets = payload?["tickets"] as? [[String: Any]] ?? []
            let rawStatuses = payload?["statuses"] as? [[String: Any]] ?? []
            if !rawStatuses.isEmpty {
                statuses = rawStatuses.compactMap { s -> PosCloudKdsStatus? in
                    guard let id = s["id"] as? String, let name = s["name"] as? String else { return nil }
                    return PosCloudKdsStatus(
                        id: id,
                        name: name,
                        color: (s["color"] as? String) ?? "#3b82f6",
                        sortOrder: (s["sortOrder"] as? Int) ?? 0,
                        printOnEnter: (s["printOnEnter"] as? Bool) ?? false,
                        printerIds: (s["printerIds"] as? [String]) ?? [],
                        isActive: (s["isActive"] as? Bool) ?? true
                    )
                }.filter(\.isActive).sorted { $0.sortOrder < $1.sortOrder }
            } else if let hub = PosHubState.shared.kitchen?.activeKdsStatuses, !hub.isEmpty {
                statuses = hub
            }
            tickets = rawTickets.compactMap { t -> KdsTicket? in
                guard let orderId = t["orderId"] as? String else { return nil }
                let linesRaw = t["lines"] as? [[String: Any]] ?? []
                return KdsTicket(
                    orderId: orderId,
                    orderNumber: t["orderNumber"] as? Int ?? 0,
                    statusId: t["statusId"] as? String,
                    statusName: (t["statusName"] as? String)
                        ?? (t["status"] as? String)
                        ?? "—",
                    statusColor: (t["statusColor"] as? String) ?? "#3b82f6",
                    lines: linesRaw.compactMap { l in
                        guard let id = l["id"] as? String, let name = l["name"] as? String else { return nil }
                        return KdsTicketLine(
                            id: id,
                            name: name,
                            quantity: l["quantity"] as? Int ?? 1,
                            detail: l["detail"] as? String ?? ""
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
