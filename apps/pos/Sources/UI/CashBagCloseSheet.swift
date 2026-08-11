import SwiftUI

/// Schicht / Börse schließen: Soll anzeigen, Ist zählen, Manager-PIN bei großer Diff.
struct CashBagCloseSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    @State private var countEuro = ""
    @State private var managerPin = ""
    @State private var busy = false
    @State private var errorText = ""

    private var expectedCents: Int {
        runtime.openCashBagExpectedCents ?? 0
    }

    private var countCents: Int? {
        Self.parseEuroToCents(countEuro)
    }

    private var differenceCents: Int? {
        guard let count = countCents else { return nil }
        return count - expectedCents
    }

    private var needsManagerPin: Bool {
        guard let diff = differenceCents else { return false }
        return abs(diff) >= PosHubState.defaultCashBagDiffThresholdCents
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Soll") {
                    LabeledContent("Erwartet", value: PosMoney.format(expectedCents))
                    if let bagId = runtime.openCashBagId {
                        Text("Börse \(bagId.prefix(8))…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Ist (gezählt)") {
                    TextField("Gezählter Betrag (€)", text: $countEuro)
                        .keyboardType(.decimalPad)
                    if let diff = differenceCents {
                        LabeledContent("Differenz", value: PosMoney.format(diff))
                            .foregroundStyle(diff == 0 ? PosDesign.green : .orange)
                    }
                }

                if needsManagerPin {
                    Section {
                        SecureField("Manager-PIN", text: $managerPin)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                        Text("Differenz ≥ \(PosMoney.format(PosHubState.defaultCashBagDiffThresholdCents)) — Manager-PIN erforderlich.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } header: {
                        Text("Manager-Freigabe")
                    }
                }

                if !errorText.isEmpty {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Schicht beenden")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Schicht beenden") {
                        Task { await close() }
                    }
                    .disabled(busy || runtime.openCashBagId == nil || countCents == nil)
                    .accessibilityIdentifier("pos.cashBag.closeConfirm")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("pos.cashBag.closeSheet")
        .onAppear {
            if countEuro.isEmpty {
                countEuro = Self.formatEuroInput(expectedCents)
            }
        }
    }

    @MainActor
    private func close() async {
        errorText = ""
        guard let bagId = runtime.openCashBagId else {
            errorText = "Keine offene Börse gefunden."
            return
        }
        guard let cents = countCents else {
            errorText = "Ungültiger Zählbetrag."
            return
        }
        if needsManagerPin, managerPin.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errorText = "Manager-PIN für Differenz erforderlich."
            return
        }
        busy = true
        defer { busy = false }
        let pin = needsManagerPin ? managerPin : nil
        let ok = await runtime.closeCashBag(bagId: bagId, closingCountCents: cents, managerPin: pin)
        if ok {
            dismiss()
        } else {
            errorText = runtime.statusMessage.isEmpty
                ? "Schichtende fehlgeschlagen."
                : runtime.statusMessage
        }
    }

    private static func parseEuroToCents(_ raw: String) -> Int? {
        let normalized = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "€", with: "")
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        guard let euros = Double(normalized), euros >= 0 else { return nil }
        return Int((euros * 100).rounded())
    }

    private static func formatEuroInput(_ cents: Int) -> String {
        String(format: "%.2f", Double(cents) / 100.0).replacingOccurrences(of: ".", with: ",")
    }
}
