import SwiftUI

/// Split-Rechnung: Positionen + Bar + Trinkgeld (%/Betrag) + gegeben → Rückgeld.
struct SplitPayView: View {
    let lines: [SessionOpenLine]
    var onPay: (
        _ selected: [SessionOpenLine],
        _ method: PosPaymentMethodKind,
        _ tipCents: Int,
        _ receivedAmountCents: Int?
    ) -> Void
    var onCancel: () -> Void

    enum TipMode: String, CaseIterable, Identifiable {
        case none, percent, amount
        var id: String { rawValue }
        var label: String {
            switch self {
            case .none: return "Kein"
            case .percent: return "%"
            case .amount: return "€"
            }
        }
    }

    enum KeypadTarget: String, CaseIterable, Identifiable {
        case tip, tendered
        var id: String { rawValue }
        var label: String {
            switch self {
            case .tip: return "Trinkgeld"
            case .tendered: return "Gegeben"
            }
        }
    }

    @State private var selected: Set<String> = []
    @State private var method: PosPaymentMethodKind = .cash
    @State private var tipMode: TipMode = .none
    @State private var tipPercent: Int = 10
    @State private var tipAmountCents: Int = 0
    @State private var tenderedCents: Int = 0
    @State private var keypadTarget: KeypadTarget = .tendered
    @State private var payPulse = false

    private let percentOptions = [5, 10, 15, 20]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Positionen wählen — Trinkgeld und gegebenes Bargeld darunter.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Positionen") {
                    ForEach(lines) { line in
                        Button {
                            toggle(line.id)
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: selected.contains(line.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected.contains(line.id) ? Color.accentColor : .secondary)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(line.openQuantity)× \(line.name)")
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(.primary)
                                    if !line.detail.isEmpty {
                                        Text(line.detail)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text(PosMoney.format(line.openCents))
                                    .font(.body.monospacedDigit())
                                    .foregroundStyle(.primary)
                            }
                        }
                    }
                    Button(selected.count == lines.count ? "Auswahl leeren" : "Alle wählen") {
                        if selected.count == lines.count { selected.removeAll() }
                        else { selected = Set(lines.map(\.id)) }
                    }
                }

                Section("Zahlungsart") {
                    ForEach(PosPaymentMethodKind.allCases) { m in
                        Button {
                            if m.available { method = m }
                        } label: {
                            HStack {
                                PosChip(title: m.label, selected: method == m)
                                if !m.available {
                                    Text("folgt")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }
                        .disabled(!m.available)
                        .buttonStyle(.plain)
                    }
                }

                if method == .cash {
                    Section("Trinkgeld") {
                        HStack(spacing: 8) {
                            ForEach(TipMode.allCases) { mode in
                                Button {
                                    tipMode = mode
                                    if mode == .amount { keypadTarget = .tip }
                                } label: {
                                    PosChip(title: mode.label, selected: tipMode == mode)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        if tipMode == .percent {
                            HStack(spacing: 8) {
                                ForEach(percentOptions, id: \.self) { p in
                                    Button {
                                        tipPercent = p
                                    } label: {
                                        PosChip(title: "\(p) %", selected: tipPercent == p)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        if tipMode == .amount {
                            LabeledContent("Betrag", value: PosMoney.format(tipAmountCents))
                        }
                    }

                    Section("Bargeld") {
                        LabeledContent("Summe", value: PosMoney.format(selectionTotal))
                        LabeledContent("Trinkgeld", value: PosMoney.format(tipCents))
                        LabeledContent("Gesamt", value: PosMoney.format(grandTotal))
                            .font(.body.weight(.semibold))
                        LabeledContent("Gegeben", value: PosMoney.format(effectiveTendered))
                        LabeledContent("Rückgeld", value: PosMoney.format(changeCents))
                            .foregroundStyle(changeCents >= 0 ? Color.primary : Color.red)

                        Picker("Eingabe", selection: $keypadTarget) {
                            ForEach(KeypadTarget.allCases) { t in
                                Text(t.label).tag(t)
                            }
                        }
                        .pickerStyle(.segmented)
                        .disabled(tipMode != .amount && keypadTarget == .tip)

                        PosCashKeypad(cents: keypadBinding)
                    }
                }
            }
            .navigationTitle("Rechnung splitten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    let picked = lines.filter { selected.contains($0.id) }
                    payPulse.toggle()
                    let received = method == .cash ? effectiveTendered : nil
                    onPay(picked, method, tipCents, received)
                } label: {
                    Text(payButtonTitle)
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(!canPay)
                .padding()
                .background(.ultraThinMaterial)
            }
            .sensoryFeedback(.success, trigger: payPulse)
            .onAppear {
                if selected.isEmpty { selected = Set(lines.map(\.id)) }
            }
            .onChange(of: tipMode) { _, mode in
                if mode != .amount && keypadTarget == .tip {
                    keypadTarget = .tendered
                }
            }
        }
    }

    private var selectionTotal: Int {
        lines.filter { selected.contains($0.id) }.reduce(0) { $0 + $1.openCents }
    }

    private var tipCents: Int {
        switch tipMode {
        case .none: return 0
        case .percent:
            return Int((Double(selectionTotal) * Double(tipPercent) / 100.0).rounded())
        case .amount:
            return max(0, tipAmountCents)
        }
    }

    private var grandTotal: Int { selectionTotal + tipCents }

    private var effectiveTendered: Int {
        tenderedCents > 0 ? tenderedCents : grandTotal
    }

    private var changeCents: Int { effectiveTendered - grandTotal }

    private var canPay: Bool {
        !selected.isEmpty && method.available && changeCents >= 0
    }

    private var payButtonTitle: String {
        if method != .cash {
            return "Zahlen"
        }
        let change = changeCents
        if tenderedCents == 0 {
            return "Bar kassieren · \(PosMoney.format(grandTotal))"
        }
        return "Bar · \(PosMoney.format(effectiveTendered)) · Rückgeld \(PosMoney.format(change))"
    }

    private var keypadBinding: Binding<Int> {
        Binding(
            get: {
                keypadTarget == .tip ? tipAmountCents : tenderedCents
            },
            set: { value in
                if keypadTarget == .tip {
                    tipAmountCents = value
                    tipMode = .amount
                } else {
                    tenderedCents = value
                }
            }
        )
    }

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) }
        else { selected.insert(id) }
    }
}

struct SessionOpenLine: Identifiable, Equatable {
    var id: String
    var orderLineId: String
    var name: String
    var openQuantity: Int
    var openCents: Int
    var detail: String
}
