import SwiftUI

/// Split-Rechnung: Mehrfachauswahl offener Positionen + Zahlungsart (Bar aktiv).
struct SplitPayView: View {
    let lines: [SessionOpenLine]
    var onPay: (_ selected: [SessionOpenLine], _ method: PosPaymentMethodKind, _ tipCents: Int) -> Void
    var onCancel: () -> Void

    @State private var selected: Set<String> = []
    @State private var method: PosPaymentMethodKind = .cash
    @State private var tipEuro = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Wähle Positionen für diesen Teil der Rechnung.")
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

                Section("Trinkgeld (optional)") {
                    TextField("0,00", text: $tipEuro)
                        .keyboardType(.decimalPad)
                }

                Section {
                    LabeledContent("Teilbetrag", value: PosMoney.format(selectionTotal))
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
                    onPay(picked, method, tipCents)
                } label: {
                    Text(method == .cash ? "Bar kassieren · \(PosMoney.format(selectionTotal + tipCents))" : "Zahlen")
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(selected.isEmpty || !method.available)
                .padding()
                .background(.ultraThinMaterial)
            }
        }
    }

    private var selectionTotal: Int {
        lines.filter { selected.contains($0.id) }.reduce(0) { $0 + $1.openCents }
    }

    private var tipCents: Int {
        let normalized = tipEuro.replacingOccurrences(of: ",", with: ".")
        guard let value = Double(normalized), value >= 0 else { return 0 }
        return Int((value * 100).rounded())
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
