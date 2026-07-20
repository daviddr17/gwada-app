import SwiftUI

/// Split-Rechnung: Positionen + Bar/Gutschein + Trinkgeld + Bestätigung.
struct SplitPayView: View {
    let lines: [SessionOpenLine]
    var onPay: (
        _ selected: [SessionOpenLine],
        _ method: PosPaymentMethodKind,
        _ tipCents: Int,
        _ receivedAmountCents: Int?,
        _ giftVoucherId: String?,
        _ customPaymentMethodId: String?
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

    @EnvironmentObject private var runtime: PosRuntime
    @State private var selected: Set<String> = []
    @State private var method: PosPaymentMethodKind = .cash
    @State private var selectedMethodId: String?
    @State private var payMethods: [PosCloudClient.PaymentMethodDto] = []
    @State private var tipMode: TipMode = .none
    @State private var tipPercent: Int = 10
    @State private var tipAmountCents: Int = 0
    @State private var tenderedCents: Int = 0
    @State private var keypadTarget: KeypadTarget = .tendered
    @State private var payPulse = false

    @State private var voucherCodeInput = ""
    @State private var lookedUpVoucher: PosCloudClient.GiftVoucherLookupDto?
    @State private var voucherLookupBusy = false
    @State private var voucherLookupError: String?
    @State private var showScanner = false
    @State private var showVoucherConfirm = false
    @State private var splitState: PosSplitBillState?
    @State private var evenN = 2

    private let percentOptions = [5, 10, 15, 20]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Positionen wählen — bei Gutschein scannen oder Code eingeben und bestätigen.")
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
                    ForEach(payMethods) { m in
                        let kind = mapKind(m.kind)
                        let selectedRow = selectedMethodId == m.id
                        Button {
                            guard m.collectable else { return }
                            selectedMethodId = m.id
                            method = kind
                        } label: {
                            HStack {
                                PosChip(title: m.label, selected: selectedRow)
                                if !m.collectable {
                                    Text(m.kind == "unbar" ? "folgt" : "inaktiv")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }
                        .disabled(!m.collectable)
                        .buttonStyle(.plain)
                    }
                    // Prototyp: Mollie Karte/PayPal immer sichtbar (Nest simulate)
                    HStack(spacing: 8) {
                        Button {
                            method = .card
                            selectedMethodId = nil
                        } label: {
                            PosChip(title: "Karte", selected: method == .card)
                        }
                        .buttonStyle(.plain)
                        Button {
                            method = .paypal
                            selectedMethodId = nil
                        } label: {
                            PosChip(title: "PayPal", selected: method == .paypal)
                        }
                        .buttonStyle(.plain)
                    }
                    if method == .card || method == .paypal {
                        Text("Mollie über Nest (Simulate ohne Key). Zahlung braucht Netz.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Gleich teilen") {
                    Stepper("Anteile: \(evenN)", value: $evenN, in: 2 ... 12)
                    let share = PosSplitBillState.shareCents(openCents: selectionTotal, evenN: evenN)
                    LabeledContent("Anteil", value: PosMoney.format(share))
                    if let state = splitState, !state.canPayPerson {
                        Text("Person-Modus gesperrt (nach Anteil).")
                            .font(.caption)
                            .foregroundStyle(PosDesign.statusConflict)
                    }
                    Button("Einen Anteil kassieren (\(PosMoney.format(share)))") {
                        applyShareThenPay(shareCents: share)
                    }
                    .disabled(selectionTotal <= 0 || method == .voucher)
                }

                if method == .voucher {
                    Section("Gutschein") {
                        HStack {
                            TextField("Code oder QR-Inhalt", text: $voucherCodeInput)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                            Button("Prüfen") {
                                Task { await lookupVoucher() }
                            }
                            .disabled(voucherCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || voucherLookupBusy)
                        }
                        Button {
                            showScanner = true
                        } label: {
                            Label("QR scannen", systemImage: "qrcode.viewfinder")
                        }
                        if voucherLookupBusy {
                            ProgressView("Gutschein wird geprüft…")
                        }
                        if let err = voucherLookupError {
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                        if let v = lookedUpVoucher {
                            LabeledContent("Code", value: v.code)
                            LabeledContent("Guthaben", value: PosMoney.format(v.balanceCents))
                            LabeledContent("Zu belasten", value: PosMoney.format(grandTotal))
                            if grandTotal > v.balanceCents {
                                Text("Guthaben zu niedrig — weniger Positionen wählen, Rest danach bar zahlen.")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            } else if v.balanceCents > grandTotal {
                                Text("Restguthaben bleibt auf dem Gutschein — Nachdruck möglich.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if method == .cash {
                    Section("Trinkgeld") {
                        tipControls
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

                if method == .voucher || method == .other || method == .card || method == .paypal {
                    Section("Betrag") {
                        LabeledContent("Summe", value: PosMoney.format(selectionTotal))
                        tipControls
                        LabeledContent("Gesamt", value: PosMoney.format(grandTotal))
                            .font(.body.weight(.semibold))
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
                    payPulse.toggle()
                    if method == .voucher {
                        showVoucherConfirm = true
                    } else {
                        let picked = lines.filter { selected.contains($0.id) }
                        let received = method == .cash ? effectiveTendered : nil
                        let customId = method == .other ? selectedMethodId : nil
                        onPay(picked, method, tipCents, received, nil, customId)
                    }
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
                Task { await loadPayMethods() }
            }
            .onChange(of: tipMode) { _, mode in
                if mode != .amount && keypadTarget == .tip {
                    keypadTarget = .tendered
                }
            }
            .onChange(of: method) { _, _ in
                lookedUpVoucher = nil
                voucherLookupError = nil
            }
            .sheet(isPresented: $showScanner) {
                PosGiftVoucherScannerView(
                    onCode: { code in
                        showScanner = false
                        voucherCodeInput = code
                        Task { await lookupVoucher() }
                    },
                    onCancel: { showScanner = false }
                )
            }
            .confirmationDialog(
                "Gutschein belasten?",
                isPresented: $showVoucherConfirm,
                titleVisibility: .visible
            ) {
                Button("Jetzt mit Gutschein bezahlen") {
                    guard let voucher = lookedUpVoucher else { return }
                    let picked = lines.filter { selected.contains($0.id) }
                    onPay(picked, .voucher, tipCents, nil, voucher.id, nil)
                }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                if let v = lookedUpVoucher {
                    let charge = min(grandTotal, v.balanceCents)
                    Text(
                        "\(v.code): \(PosMoney.format(charge)) vom Guthaben (\(PosMoney.format(v.balanceCents))) abbuchen. TSE verbucht die Speisenumsätze mit MwSt."
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var tipControls: some View {
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
            if method == .voucher {
                PosCashKeypad(cents: $tipAmountCents)
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
        guard !selected.isEmpty else { return false }
        if method == .cash { return changeCents >= 0 }
        if method == .voucher {
            guard let v = lookedUpVoucher else { return false }
            return v.balanceCents >= grandTotal && grandTotal > 0
        }
        if method == .other {
            return selectedMethodId != nil && grandTotal > 0
        }
        if method == .card || method == .paypal {
            return grandTotal > 0
        }
        return false
    }

    private var payButtonTitle: String {
        if method == .voucher {
            if let v = lookedUpVoucher {
                return "Gutschein · \(PosMoney.format(min(grandTotal, v.balanceCents)))"
            }
            return "Gutschein prüfen"
        }
        if method == .other {
            let label = payMethods.first(where: { $0.id == selectedMethodId })?.label ?? "Zahlung"
            return "\(label) · \(PosMoney.format(grandTotal))"
        }
        if method == .card {
            return "Karte · \(PosMoney.format(grandTotal))"
        }
        if method == .paypal {
            return "PayPal · \(PosMoney.format(grandTotal))"
        }
        if method != .cash {
            return "Zahlen"
        }
        let change = changeCents
        if tenderedCents == 0 {
            return "Bar kassieren · \(PosMoney.format(grandTotal))"
        }
        return "Bar · \(PosMoney.format(effectiveTendered)) · Rückgeld \(PosMoney.format(change))"
    }

    private func applyShareThenPay(shareCents: Int) {
        var state = splitState ?? PosSplitBillState.create(openCents: selectionTotal, evenN: evenN)
        state.evenN = evenN
        switch state.applySharePayment() {
        case .success:
            splitState = state
            // Anteil proportional aus Auswahl — hier: alle gewählten Positionen mitgeben; Betrag via tip=0.
            // Für Prototyp: Bar-Zahlung über onPay mit Tip 0; Betrag steckt in Lines (Server-Allocations).
            // Wenn Share < selectionTotal: Nutzer sollte Positionen reduzieren — Hinweis reicht.
            payPulse.toggle()
            let picked = lines.filter { selected.contains($0.id) }
            let received = method == .cash ? shareCents + tipCents : nil
            onPay(picked, method == .voucher ? .cash : method, tipCents, received, nil, nil)
        case .failure(let err):
            runtime.announce("Gleich teilen: \(err.rawValue)")
        }
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

    @MainActor
    private func lookupVoucher() async {
        let code = voucherCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        voucherLookupBusy = true
        voucherLookupError = nil
        lookedUpVoucher = nil
        defer { voucherLookupBusy = false }
        do {
            let voucher = try await PosCloudClient.lookupGiftVoucher(
                restaurantId: PosHubState.shared.restaurantId,
                code: code
            )
            lookedUpVoucher = voucher
        } catch {
            voucherLookupError = error.localizedDescription
        }
    }

    @MainActor
    private func loadPayMethods() async {
        do {
            let methods = try await PosCloudClient.fetchPaymentMethods(
                restaurantId: PosHubState.shared.restaurantId
            )
            payMethods = methods
            if selectedMethodId == nil,
               let cash = methods.first(where: { $0.kind == "cash" && $0.collectable })
            {
                selectedMethodId = cash.id
                method = .cash
            }
        } catch {
            // Fallback: Bar + Gutschein lokal
            payMethods = []
            method = .cash
        }
    }

    private func mapKind(_ kind: String) -> PosPaymentMethodKind {
        switch kind {
        case "cash": return .cash
        case "voucher": return .voucher
        case "unbar": return .card
        default: return .other
        }
    }
}
