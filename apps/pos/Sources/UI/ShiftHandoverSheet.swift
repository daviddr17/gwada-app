import SwiftUI

/// Schichtübergabe: Tische an Empfänger; optional Portemonnaie mitübergeben.
struct ShiftHandoverSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss
    @StateObject private var pinCache = PosWaiterPinCache.shared

    /// Offene Session-IDs, die übergeben werden sollen.
    var sessionIds: [String]

    @State private var selectedProfileId: String?
    @State private var toPin = ""
    @State private var transferCashBag = false
    @State private var busy = false
    @State private var errorText = ""

    private var currentStaffId: String {
        PosAuthStore.shared.pinSession?.staffId
            ?? PosCloudConfig.waiterProfileId
            ?? ""
    }

    private var recipients: [(id: String, name: String)] {
        let me = currentStaffId
        let fromCache = pinCache.waiters
            .filter { $0.profileId != me && !$0.profileId.isEmpty }
            .map { (id: $0.profileId, name: $0.name) }
        if !fromCache.isEmpty {
            return fromCache.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
        }
        return (PosAuthRosterStore.shared.roster?.staff ?? [])
            .filter { $0.id != me && !$0.id.isEmpty }
            .map { (id: $0.id, name: $0.displayName) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Empfänger") {
                    if recipients.isEmpty {
                        Text("Keine Kellner im Cache — einmal mit PIN anmelden oder Roster laden.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Kellner", selection: $selectedProfileId) {
                            Text("Bitte wählen").tag(String?.none)
                            ForEach(recipients, id: \.id) { staff in
                                Text(staff.name).tag(Optional(staff.id))
                            }
                        }
                    }
                    SecureField("PIN des Empfängers", text: $toPin)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                }

                Section {
                    Toggle("Portemonnaie mitübergeben", isOn: $transferCashBag)
                        .accessibilityIdentifier("pos.shift.handoverTransferBag")
                    Text(
                        transferCashBag
                            ? "Börse und Soll gehen an den Empfänger (kein Diff-Zwang)."
                            : "Nur Tisch-Owner wechseln — Börse bleibt bei dir."
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                if !sessionIds.isEmpty {
                    Section {
                        Text("\(sessionIds.count) Tisch(e) werden übergeben.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if !errorText.isEmpty {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Schichtübergabe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Übergeben") {
                        Task { await transfer() }
                    }
                    .disabled(busy || selectedProfileId == nil || toPin.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("pos.shift.handoverConfirm")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("pos.shift.handoverSheet")
        .onAppear {
            if selectedProfileId == nil {
                selectedProfileId = recipients.first?.id
            }
        }
    }

    @MainActor
    private func transfer() async {
        errorText = ""
        guard let toId = selectedProfileId, !toId.isEmpty else {
            errorText = "Empfänger wählen."
            return
        }
        let pin = toPin.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !pin.isEmpty else {
            errorText = "PIN des Empfängers eingeben."
            return
        }
        busy = true
        defer { busy = false }
        let ok = await runtime.transferShift(
            sessionIds: sessionIds,
            toProfileId: toId,
            toPin: pin,
            transferCashBag: transferCashBag
        )
        if ok {
            dismiss()
        } else {
            errorText = runtime.statusMessage.isEmpty
                ? "Übergabe fehlgeschlagen."
                : runtime.statusMessage
        }
    }
}
