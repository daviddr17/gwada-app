import SwiftUI

struct LineVoidSheet: View {
    let line: SessionOpenLine
    let reasons: [PosCloudClient.PosVoidReasonDto]
    var canVoidFired: Bool = true
    var reasonsLoading: Bool = false
    var isSubmitting: Bool = false
    var errorMessage: String = ""
    var onConfirm: (_ quantity: Int, _ reasonId: String, _ note: String) -> Void
    var onCancel: () -> Void

    @State private var quantity: Int
    @State private var selectedReasonId: String?
    @State private var note = ""

    init(
        line: SessionOpenLine,
        reasons: [PosCloudClient.PosVoidReasonDto],
        canVoidFired: Bool = true,
        reasonsLoading: Bool = false,
        isSubmitting: Bool = false,
        errorMessage: String = "",
        onConfirm: @escaping (_ quantity: Int, _ reasonId: String, _ note: String) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.line = line
        self.reasons = reasons
        self.canVoidFired = canVoidFired
        self.reasonsLoading = reasonsLoading
        self.isSubmitting = isSubmitting
        self.errorMessage = errorMessage
        self.onConfirm = onConfirm
        self.onCancel = onCancel
        _quantity = State(initialValue: max(1, line.openQuantity))
        _selectedReasonId = State(initialValue: reasons.count == 1 ? reasons.first?.id : nil)
    }

    private var hasVoidPermission: Bool {
        !line.isFired || canVoidFired
    }

    private var canConfirm: Bool {
        hasVoidPermission
            && !reasons.isEmpty
            && selectedReasonId != nil
            && !reasonsLoading
            && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Position", value: line.name)
                    LabeledContent("Offene Menge", value: "\(line.openQuantity)")
                }

                Section("Storno-Menge") {
                    Stepper(
                        value: $quantity,
                        in: 1...max(1, line.openQuantity)
                    ) {
                        Text("\(quantity) von \(line.openQuantity)")
                            .font(.body.monospacedDigit())
                    }
                }

                Section("Storno-Grund") {
                    if reasonsLoading, reasons.isEmpty {
                        Text("Storno-Gründe werden geladen …")
                            .foregroundStyle(PosDesign.muted)
                    } else if reasons.isEmpty {
                        Text("Gründe fehlen — einmal Cloud laden (wie Speisekarte), dann erneut.")
                            .foregroundStyle(.red)
                    } else {
                        ForEach(reasons) { reason in
                            reasonButton(reason)
                        }
                    }
                }

                Section("Notiz (optional)") {
                    TextField("z. B. Gastwunsch", text: $note, axis: .vertical)
                        .lineLimit(2...4)
                        .onChange(of: note) { _, value in
                            if value.count > 80 {
                                note = String(value.prefix(80))
                            }
                        }
                    Text("\(note.count)/80")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(PosDesign.muted)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                if !hasVoidPermission {
                    Section {
                        Label("Nur mit Storno-Recht", systemImage: "lock.fill")
                            .foregroundStyle(.red)
                    }
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(PosDesign.bg)
            .navigationTitle("Position stornieren")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Storniere …" : "Stornieren", role: .destructive) {
                        guard let selectedReasonId else { return }
                        onConfirm(quantity, selectedReasonId, note)
                    }
                    .disabled(!canConfirm)
                }
            }
        }
    }

    private func reasonButton(_ reason: PosCloudClient.PosVoidReasonDto) -> some View {
        let selected = selectedReasonId == reason.id
        return Button {
            selectedReasonId = reason.id
        } label: {
            HStack(spacing: 12) {
                Text(reason.name)
                    .foregroundStyle(PosDesign.ink)
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(PosDesign.brandAccent)
                }
            }
        }
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}
