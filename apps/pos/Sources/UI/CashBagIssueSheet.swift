import SwiftUI

/// Hub/Solo: Wechselgeld (Float) an einen Kellner ausgeben.
struct CashBagIssueSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    @State private var selectedStaffId: String?
    @State private var amountEuro = "100,00"
    @State private var busy = false
    @State private var errorText = ""

    private var staffOptions: [PosAuthRosterStaff] {
        (PosAuthRosterStore.shared.roster?.staff ?? [])
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Kellner") {
                    if staffOptions.isEmpty {
                        Text("Kein Roster geladen — Kellner-PIN einmal eingeben.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Kellner", selection: $selectedStaffId) {
                            Text("Bitte wählen").tag(String?.none)
                            ForEach(staffOptions) { staff in
                                Text(staff.displayName).tag(Optional(staff.id))
                            }
                        }
                    }
                }

                Section("Betrag") {
                    TextField("Wechselgeld (€)", text: $amountEuro)
                        .keyboardType(.decimalPad)
                    Text("Standard 100,00 €")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !errorText.isEmpty {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Wechselgeld ausgeben")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ausgeben") {
                        Task { await issue() }
                    }
                    .disabled(busy || selectedStaffId == nil)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("pos.cashBag.issueSheet")
        .onAppear {
            if selectedStaffId == nil {
                selectedStaffId = staffOptions.first?.id
            }
        }
    }

    @MainActor
    private func issue() async {
        errorText = ""
        guard let staffId = selectedStaffId, !staffId.isEmpty else {
            errorText = "Kellner wählen."
            return
        }
        guard let cents = Self.parseEuroToCents(amountEuro), cents >= 0 else {
            errorText = "Ungültiger Betrag."
            return
        }
        busy = true
        defer { busy = false }
        let ok = await runtime.issueCashBag(staffProfileId: staffId, openingFloatCents: cents)
        if ok {
            dismiss()
        } else {
            errorText = runtime.statusMessage.isEmpty
                ? "Wechselgeld konnte nicht ausgegeben werden."
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
}
