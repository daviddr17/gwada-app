import SwiftUI

/// Prototyp PaymentSheet: Tip → Zahlart → Bar-Rückgeld / Karte·PayPal Demo.
struct PosPaymentSheetView: View {
    let amountCents: Int
    let label: String
    let tableName: String
    var onComplete: (
        _ method: PosPaymentMethodKind,
        _ tipCents: Int,
        _ receivedAmountCents: Int?
    ) -> Void
    var onClose: () -> Void

    private enum TipChoice: String, CaseIterable, Identifiable {
        case none, five, ten, round
        var id: String { rawValue }
    }

    private enum Stage {
        case select
        case processing
        case done
    }

    @State private var tipChoice: TipChoice = .none
    @State private var method: PosPaymentMethodKind?
    @State private var givenCents: Int?
    @State private var stage: Stage = .select

    private var tipCents: Int {
        switch tipChoice {
        case .none: return 0
        case .five: return Int((Double(amountCents) * 0.05).rounded())
        case .ten: return Int((Double(amountCents) * 0.10).rounded())
        case .round:
            let rem = amountCents % 100
            return rem == 0 ? 0 : 100 - rem
        }
    }

    private var totalCents: Int { amountCents + tipCents }

    private var tenders: [Int] {
        var values = [totalCents]
        for step in [500, 1000, 5000, 10_000] {
            let rounded = Int(ceil(Double(totalCents) / Double(step))) * step
            if rounded > totalCents, !values.contains(rounded) {
                values.append(rounded)
            }
        }
        return Array(values.sorted().prefix(4))
    }

    var body: some View {
        NavigationStack {
            Group {
                switch stage {
                case .done:
                    doneStage
                case .processing:
                    processingStage
                case .select:
                    selectStage
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(PosDesign.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if stage == .select {
                        Button("Schließen", action: onClose)
                    }
                }
            }
        }
        .presentationDetents([.large, .medium])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("pos.payment.sheet")
    }

    private var selectStage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Kassieren")
                        .font(.title2.weight(.bold))
                    Spacer()
                }
                Text("\(label) · \(tableName)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack {
                    Text("Zu zahlen")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(PosMoney.format(totalCents))
                        .font(.title2.weight(.semibold).monospacedDigit())
                }
                .padding(16)
                .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(PosDesign.line, lineWidth: 1)
                }

                tipSection
                methodSection

                if method == .cash {
                    tenderSection
                    PosButton(
                        title: "Barzahlung abschließen",
                        kind: .primary,
                        enabled: givenCents != nil
                    ) {
                        guard givenCents != nil else { return }
                        finishLocal(method: .cash)
                    }
                    .padding(.top, 4)
                } else if method == .card {
                    PosButton(title: "\(PosMoney.format(totalCents)) an Terminal senden", kind: .primary) {
                        stage = .processing
                        scheduleDone(method: .card)
                    }
                    .padding(.top, 4)
                } else if method == .paypal {
                    PosButton(title: "PayPal · \(PosMoney.format(totalCents))", kind: .primary) {
                        stage = .processing
                        scheduleDone(method: .paypal)
                    }
                    .padding(.top, 4)
                } else {
                    Text("Zahlungsart wählen, um fortzufahren")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
        }
    }

    private var tipSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trinkgeld")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    tipChip(.none, title: "Kein")
                    tipChip(.five, title: "5 % · \(PosMoney.format(Int((Double(amountCents) * 0.05).rounded())))")
                    tipChip(.ten, title: "10 % · \(PosMoney.format(Int((Double(amountCents) * 0.10).rounded())))")
                    let roundTip = amountCents % 100 == 0 ? 0 : 100 - (amountCents % 100)
                    tipChip(.round, title: "Aufrunden · \(PosMoney.format(roundTip))")
                }
            }
        }
    }

    private func tipChip(_ choice: TipChoice, title: String) -> some View {
        Button {
            tipChoice = choice
            givenCents = nil
        } label: {
            PosChip(title: title, selected: tipChoice == choice)
        }
        .buttonStyle(.plain)
    }

    private var methodSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Zahlungsart")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                methodButton(.cash, title: "Bar", sub: "Rückgeld")
                methodButton(.card, title: "Karte", sub: "EC / NFC")
                methodButton(.paypal, title: "PayPal", sub: "QR")
            }
        }
    }

    private func methodButton(_ kind: PosPaymentMethodKind, title: String, sub: String) -> some View {
        let active = method == kind
        return Button {
            method = kind
            givenCents = nil
        } label: {
            VStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                Text(sub)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: PosLayout.amountButtonMin - 4)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(active ? Color.accentColor.opacity(0.12) : PosDesign.surface)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(active ? Color.accentColor : PosDesign.line, lineWidth: active ? 1.5 : 1)
            }
        }
        .buttonStyle(.plain)
    }

    private var tenderSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Gegeben")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                ForEach(tenders, id: \.self) { value in
                    Button {
                        givenCents = value
                    } label: {
                        PosChip(
                            title: value == totalCents ? "Passend" : PosMoney.format(value),
                            selected: givenCents == value
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            if let given = givenCents {
                HStack {
                    Text("Rückgeld")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(PosMoney.format(given - totalCents))
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .foregroundStyle(PosDesign.green)
                }
                .padding(14)
                .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private var processingStage: some View {
        VStack(spacing: 14) {
            ProgressView()
                .scaleEffect(1.3)
                .padding(.top, 40)
            Text(method == .paypal ? "Warte auf PayPal…" : "Warte auf Kartenterminal…")
                .font(.headline)
            Text(PosMoney.format(totalCents))
                .font(.title3.monospacedDigit())
                .foregroundStyle(Color.accentColor)
            Text(method == .paypal
                ? "Gast scannt den Code (Demo)."
                : "Gast kann Karte oder Smartphone auflegen (Demo).")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Abbrechen") {
                stage = .select
            }
            .padding(.top, 12)
        }
        .frame(maxWidth: .infinity)
    }

    private var doneStage: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(PosDesign.green)
                .padding(.top, 36)
            Text("Bezahlt")
                .font(.title2.weight(.bold))
            Text("\(PosMoney.format(totalCents)) · \(methodLabel)")
                .font(.body.monospacedDigit())
                .foregroundStyle(.secondary)
            if tipCents > 0 {
                Text("davon \(PosMoney.format(tipCents)) Trinkgeld")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var methodLabel: String {
        switch method {
        case .cash: return "Bar"
        case .card: return "Karte"
        case .paypal: return "PayPal"
        default: return "—"
        }
    }

    private func scheduleDone(method: PosPaymentMethodKind) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(method == .card ? 900 : 1200))
            guard stage == .processing else { return }
            finishLocal(method: method)
        }
    }

    private func finishLocal(method: PosPaymentMethodKind) {
        stage = .done
        let received = method == .cash ? givenCents : nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(700))
            onComplete(method, tipCents, received)
        }
    }
}
