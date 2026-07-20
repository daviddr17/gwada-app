import SwiftUI

/// Wertgutscheine — Cache bei Start, Offline-Ausstellung mit Sync-Queue.
struct GiftVouchersView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @State private var amountEuro = "50"
    @State private var busy = false
    @State private var lastIssued: PosCachedGiftVoucher?
    @State private var cached: [PosCachedGiftVoucher] = []
    @State private var errorText: String?

    private var isOnline: Bool {
        runtime.isSignedIn && !PosAuthStore.shared.isOfflineSession
    }

    var body: some View {
        Form {
            Section {
                Text(
                    isOnline
                        ? "Barzahlung wird kassiert (0 % MwSt). Umsatzsteuer entsteht erst bei Einlösung. Aktive Gutscheine werden am Hub gecacht."
                        : "Offline: Ausstellung lokal möglich — Fiskalisierung/Buchung folgt online (Nachsignierung ausstehend)."
                )
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
                        Text(isOnline ? "Bar kassieren & ausstellen" : "Lokal ausstellen (Sync später)")
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
                    if let exp = v.expiresAt {
                        LabeledContent("Gültig bis", value: formatDate(exp))
                    }
                    if v.pendingIssue {
                        Text("Vorläufig — TSE/Buchung folgt online.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }

            if !cached.isEmpty {
                Section("Cache (\(cached.count))") {
                    ForEach(cached.prefix(20)) { v in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(v.code).font(.body.monospaced())
                                if v.pendingIssue || v.pendingRedeemCents > 0 {
                                    Text("Sync ausstehend")
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                }
                            }
                            Spacer()
                            Text(PosMoney.format(v.balanceCents))
                                .font(.body.monospacedDigit())
                        }
                    }
                }
            }
        }
        .navigationTitle("Gutscheine")
        .task { reloadCache() }
        .refreshable {
            if isOnline {
                await runtime.refresh()
            }
            reloadCache()
        }
    }

    private func reloadCache() {
        cached = PosOfflineCaches.loadVouchers()
            .filter { $0.status == "active" || $0.pendingIssue }
            .sorted { $0.code < $1.code }
    }

    @MainActor
    private func issue() async {
        errorText = nil
        let normalized = amountEuro.replacingOccurrences(of: ",", with: ".")
        guard let euros = Double(normalized), euros >= 1 else {
            errorText = "Mindestbetrag 1,00 €"
            return
        }
        let amountCents = Int((euros * 100).rounded())
        busy = true
        defer { busy = false }
        let restaurantId = PosHubState.shared.restaurantId

        if !isOnline {
            let localId = UUID().uuidString
            let code = Self.makeLocalCode()
            let voucher = PosCachedGiftVoucher(
                id: localId,
                code: code,
                balanceCents: amountCents,
                initialAmountCents: amountCents,
                status: "active",
                expiresAt: nil,
                pendingIssue: true,
                pendingRedeemCents: 0
            )
            PosOfflineCaches.upsertVoucher(voucher)
            PosSyncQueue.shared.enqueueIssueGiftVoucher(PosSyncIssueGiftVoucherPayload(
                restaurantId: restaurantId,
                amountCents: amountCents,
                localId: localId,
                localCode: code,
                note: nil
            ))
            runtime.noteSyncPending()
            lastIssued = voucher
            reloadCache()
            runtime.announce("Gutschein \(code) lokal — Fiskalisierung nicht möglich, Nachsignierung ausstehend.")
            return
        }

        do {
            let voucher = try await PosCloudClient.issueGiftVoucher(
                restaurantId: restaurantId,
                amountCents: amountCents
            )
            let cached = PosCachedGiftVoucher(
                id: voucher.id,
                code: voucher.code,
                balanceCents: voucher.balanceCents,
                initialAmountCents: voucher.initialAmountCents,
                status: "active",
                expiresAt: voucher.expiresAt,
                pendingIssue: false,
                pendingRedeemCents: 0
            )
            PosOfflineCaches.upsertVoucher(cached)
            lastIssued = cached
            reloadCache()
            runtime.statusMessage = "Gutschein \(voucher.code) ausgestellt."
        } catch {
            // Offline-Fallback
            let localId = UUID().uuidString
            let code = Self.makeLocalCode()
            let voucher = PosCachedGiftVoucher(
                id: localId,
                code: code,
                balanceCents: amountCents,
                initialAmountCents: amountCents,
                status: "active",
                expiresAt: nil,
                pendingIssue: true,
                pendingRedeemCents: 0
            )
            PosOfflineCaches.upsertVoucher(voucher)
            PosSyncQueue.shared.enqueueIssueGiftVoucher(PosSyncIssueGiftVoucherPayload(
                restaurantId: restaurantId,
                amountCents: amountCents,
                localId: localId,
                localCode: code,
                note: nil
            ))
            runtime.noteSyncPending()
            lastIssued = voucher
            reloadCache()
            runtime.announce("Gutschein \(code) lokal — Sync folgt online.")
        }
    }

    private static func makeLocalCode() -> String {
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        var chars: [Character] = []
        for _ in 0 ..< 8 {
            chars.append(alphabet.randomElement()!)
        }
        return "L" + String(chars)
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
