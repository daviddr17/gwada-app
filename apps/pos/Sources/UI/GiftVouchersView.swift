import SwiftUI

/// Wertgutscheine an der Kasse / am Handheld ausstellen.
struct GiftVouchersView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var amountEuro = "50"
    @State private var busy = false
    @State private var lastIssued: PosCloudClient.IssuedGiftVoucherDto?
    @State private var errorText: String?

    var body: some View {
        Form {
            Section {
                Text("Barzahlung wird kassiert (0 % MwSt). Umsatzsteuer entsteht erst bei Einlösung.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Neu ausstellen") {
                TextField("Betrag (€)", text: $amountEuro)
                    .keyboardType(.decimalPad)
                Button {
                    Task { await issue() }
                } label: {
                    if busy {
                        ProgressView()
                    } else {
                        Text("Bar kassieren & ausstellen")
                    }
                }
                .disabled(busy || !runtime.isSignedIn)
            }

            if let err = errorText {
                Section {
                    Text(err).foregroundStyle(.red)
                }
            }

            if let v = lastIssued {
                Section("Zuletzt ausgestellt") {
                    LabeledContent("Code", value: v.code)
                    LabeledContent("Wert", value: PosMoney.format(v.balanceCents))
                    LabeledContent("Gültig bis", value: formatDate(v.expiresAt))
                    Text("PDF-Druck im Dashboard unter POS → Gutscheine, oder A4/Bon dort nachdrucken.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Gutscheine")
    }

    @MainActor
    private func issue() async {
        errorText = nil
        let normalized = amountEuro.replacingOccurrences(of: ",", with: ".")
        guard let euros = Double(normalized), euros >= 1 else {
            errorText = "Mindestbetrag 1,00 €"
            return
        }
        busy = true
        defer { busy = false }
        do {
            let voucher = try await PosCloudClient.issueGiftVoucher(
                restaurantId: PosHubState.shared.restaurantId,
                amountCents: Int((euros * 100).rounded())
            )
            lastIssued = voucher
            runtime.announce("Gutschein \(voucher.code) ausgestellt.")
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
