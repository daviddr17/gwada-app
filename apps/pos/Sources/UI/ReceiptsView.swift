import SwiftUI

/// Heutige Quittungen / Bar-Zahlungen — Storno + Tisch wieder öffnen.
struct ReceiptsView: View {
    @EnvironmentObject private var runtime: PosRuntime

    @State private var receipts: [PosCloudClient.PosTodayReceiptDto] = []
    @State private var loading = false
    @State private var errorText = ""
    @State private var voidTarget: PosCloudClient.PosTodayReceiptDto?
    @State private var busyId: String?

    var body: some View {
        Group {
            if loading && receipts.isEmpty {
                ProgressView("Lade Quittungen …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if receipts.isEmpty {
                ContentUnavailableView {
                    Label("Keine Quittungen", systemImage: "doc.text")
                } description: {
                    Text(errorText.isEmpty ? "Heute noch keine Zahlungen." : errorText)
                } actions: {
                    Button("Aktualisieren") { Task { await reload() } }
                }
            } else {
                List {
                    Section {
                        Text("Bar-Zahlungen können storniert werden — Tisch wird wieder geöffnet. PDF/Fiskaly später.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(receipts) { receipt in
                        receiptRow(receipt)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Quittungen")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await reload() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(loading)
            }
        }
        .task { await reload() }
        .refreshable { await reload() }
        .confirmationDialog(
            "Bar-Zahlung stornieren?",
            isPresented: Binding(
                get: { voidTarget != nil },
                set: { if !$0 { voidTarget = nil } }
            ),
            titleVisibility: .visible,
            presenting: voidTarget
        ) { receipt in
            Button("Stornieren & Tisch öffnen", role: .destructive) {
                Task { await voidReceipt(receipt, reopen: true) }
            }
            Button("Nur stornieren") {
                Task { await voidReceipt(receipt, reopen: false) }
            }
            Button("Abbrechen", role: .cancel) { voidTarget = nil }
        } message: { receipt in
            Text("\(receipt.tableLabel) · #\(receipt.orderNumber) · \(PosMoney.format(receipt.amountCents))")
        }
    }

    private func receiptRow(_ receipt: PosCloudClient.PosTodayReceiptDto) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(receipt.tableLabel)
                    .font(.headline)
                Spacer()
                PosStatusBadge(
                    title: statusLabel(receipt),
                    emphasized: receipt.status == "paid",
                    tint: receipt.status == "refunded" ? .secondary : .accentColor
                )
            }
            HStack {
                Text("#\(receipt.orderNumber)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Text("·")
                    .foregroundStyle(.secondary)
                Text(methodLabel(receipt.method))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(PosMoney.format(receipt.amountCents))
                    .font(.body.weight(.semibold).monospacedDigit())
            }
            if receipt.tipCents > 0 {
                Text("inkl. Trinkgeld \(PosMoney.format(receipt.tipCents))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let received = receipt.receivedAmountCents, received > receipt.amountCents {
                Text("Gegeben \(PosMoney.format(received)) · Rückgeld \(PosMoney.format(received - receipt.amountCents))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let paidAt = receipt.paidAt {
                Text(Self.formatTime(paidAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            if receipt.canVoidCash {
                Button {
                    voidTarget = receipt
                } label: {
                    Label(
                        busyId == receipt.paymentId ? "Storniere …" : "Stornieren",
                        systemImage: "arrow.uturn.backward"
                    )
                }
                .disabled(busyId != nil)
            }
        }
        .padding(.vertical, 4)
    }

    private func statusLabel(_ r: PosCloudClient.PosTodayReceiptDto) -> String {
        switch r.status {
        case "paid": return "Bezahlt"
        case "refunded": return "Storniert"
        default: return r.status
        }
    }

    private func methodLabel(_ method: String) -> String {
        switch method {
        case "cash": return "Bar"
        case "card": return "Karte"
        default: return method
        }
    }

    private func reload() async {
        loading = true
        errorText = ""
        defer { loading = false }
        guard runtime.isSignedIn else {
            receipts = []
            errorText = "Bitte anmelden, um Quittungen zu laden."
            return
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            receipts = try await PosCloudClient.fetchTodayReceipts(restaurantId: restaurantId)
        } catch {
            errorText = error.localizedDescription
            receipts = []
        }
    }

    private func voidReceipt(_ receipt: PosCloudClient.PosTodayReceiptDto, reopen: Bool) async {
        busyId = receipt.paymentId
        defer {
            busyId = nil
            voidTarget = nil
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            let result = try await PosCloudClient.voidCashPayment(
                restaurantId: restaurantId,
                paymentId: receipt.paymentId,
                reopenTable: reopen
            )
            runtime.announce(
                result.reopened
                    ? "Storniert — Tisch wieder geöffnet."
                    : "Bar-Zahlung storniert."
            )
            await runtime.refresh()
            await reload()
        } catch {
            errorText = error.localizedDescription
            runtime.announce("Storno fehlgeschlagen: \(error.localizedDescription)")
        }
    }

    private static func formatTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let out = DateFormatter()
        out.locale = Locale(identifier: "de_DE")
        out.dateFormat = "HH:mm"
        return out.string(from: date)
    }
}
