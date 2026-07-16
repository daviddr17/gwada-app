import SwiftUI

/// Einfaches Küchen-Display — Tickets vom Cloud-API (Kasse online) / Hinweis auf Hub-IP.
struct KdsView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var tickets: [KdsTicket] = []
    @State private var status = "Lädt …"
    @State private var dense = false
    @State private var showReady = true

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
    }

    private var settingsBar: some View {
        HStack(spacing: 12) {
            Toggle("Kompakt", isOn: $dense).toggleStyle(.button)
            Toggle("Ready zeigen", isOn: $showReady).toggleStyle(.button)
            Spacer()
            Button { Task { await reload() } } label: {
                Image(systemName: "arrow.clockwise")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func ticketCard(_ ticket: KdsTicket) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(ticket.orderNumber)")
                    .font(.title3.weight(.bold).monospacedDigit())
                Spacer()
                Text(ticket.status.uppercased())
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor(ticket.status).opacity(0.18))
                    .foregroundStyle(statusColor(ticket.status))
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
        }
        .padding(14)
        .frame(minHeight: dense ? 120 : 160, alignment: .topLeading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: PosDesign.cardRadius, style: .continuous))
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "preparing": return .orange
        case "ready": return .green
        default: return .accentColor
        }
    }

    private func reload() async {
        status = "Aktualisiere …"
        guard runtime.isSignedIn, let restaurantId = PosCloudConfig.restaurantId else {
            tickets = []
            status = "KDS: Kasse anmelden. Lokal später: http://<Kassen-IP>:8787/v1/kds"
            return
        }
        do {
            let res = try await PosCloudClient.fetchKdsTickets(restaurantId: restaurantId)
            tickets = res.tickets
                .filter { showReady || $0.status != "ready" }
                .map { t in
                    KdsTicket(
                        orderId: t.orderId,
                        orderNumber: t.orderNumber,
                        status: t.status,
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
            status = tickets.isEmpty ? "Keine Küchen-Tickets." : "\(tickets.count) Tickets"
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
    var status: String
    var lines: [KdsTicketLine]
}

struct KdsTicketLine: Identifiable, Equatable {
    var id: String
    var name: String
    var quantity: Int
    var detail: String
}
