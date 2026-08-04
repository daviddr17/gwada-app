import SwiftUI

/// PaymentSheet: Aufrunden per Betragschips + Bar „Stimmt so“, optional 5 %.
struct PosPaymentSheetView: View {
    @EnvironmentObject private var runtime: PosRuntime

    let amountCents: Int
    let label: String
    let tableName: String
    var onComplete: (
        _ method: PosPaymentMethodKind,
        _ tipCents: Int,
        _ receivedAmountCents: Int?
    ) -> Void
    var onClose: () -> Void

    private enum Stage {
        case select
        case processing
        case done
    }

    /// Zielbetrag inkl. Tip (`nil` = kein Tip / Aufrunden).
    @State private var roundUpToCents: Int?
    @State private var percentTip: Int = 0
    @State private var method: PosPaymentMethodKind?
    @State private var givenCents: Int?
    @State private var stimmtSo = false
    @State private var stage: Stage = .select

    /// Gekoppeltes Handgerät: nur Bar (Karte/PayPal werden serverseitig abgelehnt).
    private var selectableMethods: [PosPaymentMethodKind] {
        if runtime.role == .handheld,
           PosEnrollmentStore.shared.isHandheldPaired,
           !runtime.isSoloMode
        {
            return [.cash]
        }
        return [.cash, .card, .paypal]
    }

    private var tipFromRoundUp: Int {
        guard let target = roundUpToCents, target > amountCents else { return 0 }
        return target - amountCents
    }

    private var tipCents: Int {
        if stimmtSo, let given = givenCents, given > amountCents {
            return given - amountCents
        }
        if tipFromRoundUp > 0 { return tipFromRoundUp }
        return percentTip
    }

    private var totalCents: Int { amountCents + tipCents }

    private var roundUpTargets: [Int] {
        var values: [Int] = []
        let nextEuro = Int((Double(amountCents) / 100.0).rounded(.up)) * 100
        if nextEuro > amountCents { values.append(nextEuro) }
        for step in [500, 1000, 2000, 5000, 10_000] {
            let rounded = Int((Double(amountCents) / Double(step)).rounded(.up)) * step
            if rounded > amountCents { values.append(rounded) }
        }
        return Array(Set(values)).sorted().prefix(5).map { $0 }
    }

    private var tenders: [Int] {
        var values = [totalCents]
        for step in [500, 1000, 2000, 5000, 10_000] {
            let rounded = Int((Double(totalCents) / Double(step)).rounded(.up)) * step
            if rounded >= totalCents, !values.contains(rounded) {
                values.append(rounded)
            }
        }
        // Häufige Scheine
        for bill in [5_000, 10_000, 20_000, 50_000] where bill >= totalCents {
            if !values.contains(bill) { values.append(bill) }
        }
        return Array(values.sorted().prefix(6))
    }

    private var changeCents: Int {
        guard let given = givenCents else { return 0 }
        if stimmtSo { return 0 }
        return max(0, given - totalCents)
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
        .presentationDetents([.large])
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
                    .foregroundStyle(PosDesign.muted)

                VStack(spacing: 8) {
                    HStack {
                        Text("Rechnung")
                            .foregroundStyle(PosDesign.muted)
                        Spacer()
                        Text(PosMoney.format(amountCents))
                            .font(.title3.weight(.semibold).monospacedDigit())
                    }
                    HStack {
                        Text("Zu zahlen")
                            .foregroundStyle(PosDesign.muted)
                        Spacer()
                        Text(PosMoney.format(totalCents))
                            .font(.title2.weight(.semibold).monospacedDigit())
                    }
                    if tipCents > 0 {
                        Text("davon \(PosMoney.format(tipCents)) Trinkgeld / Aufrunden")
                            .font(.caption)
                            .foregroundStyle(PosDesign.muted)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
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
                        title: stimmtSo ? "Bar · stimmt so" : "Barzahlung abschließen",
                        kind: .primary,
                        enabled: givenCents != nil && (givenCents ?? 0) >= (stimmtSo ? amountCents : totalCents)
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
                        .foregroundStyle(PosDesign.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
        }
    }

    private var tipSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Aufrunden / Trinkgeld")
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
            Text("Betrag antippen — oder bei Bar „Stimmt so“.")
                .font(.caption2)
                .foregroundStyle(PosDesign.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    tipChip(
                        title: "Kein",
                        selected: roundUpToCents == nil && percentTip == 0 && !stimmtSo
                    ) {
                        roundUpToCents = nil
                        percentTip = 0
                        stimmtSo = false
                        givenCents = nil
                    }
                    ForEach(roundUpTargets, id: \.self) { target in
                        tipChip(
                            title: cashChipLabel(target),
                            selected: roundUpToCents == target && !stimmtSo
                        ) {
                            roundUpToCents = target
                            percentTip = 0
                            stimmtSo = false
                            givenCents = nil
                        }
                    }
                    let five = Int((Double(amountCents) * 0.05).rounded())
                    tipChip(
                        title: "5 %",
                        selected: percentTip == five && five > 0 && roundUpToCents == nil
                    ) {
                        percentTip = five
                        roundUpToCents = nil
                        stimmtSo = false
                        givenCents = nil
                    }
                }
            }
        }
    }

    private func tipChip(title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            PosChip(title: title, selected: selected)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var methodSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Zahlungsart")
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
            HStack(spacing: 8) {
                ForEach(selectableMethods) { kind in
                    switch kind {
                    case .cash:
                        methodButton(.cash, title: "Bar", sub: "Rückgeld")
                    case .card:
                        methodButton(.card, title: "Karte", sub: "EC / NFC")
                    case .paypal:
                        methodButton(.paypal, title: "PayPal", sub: "QR")
                    case .voucher, .other:
                        EmptyView()
                    }
                }
            }
        }
    }

    private func methodButton(_ kind: PosPaymentMethodKind, title: String, sub: String) -> some View {
        let active = method == kind
        return Button {
            method = kind
            givenCents = nil
            if kind != .cash { stimmtSo = false }
        } label: {
            VStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                Text(sub)
                    .font(.caption2)
                    .foregroundStyle(PosDesign.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: PosLayout.amountButtonMin - 4)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(active ? PosDesign.brandActionFill : PosDesign.surface)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(active ? PosDesign.brandActionBorder : PosDesign.line, lineWidth: active ? 1.5 : 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityIdentifier("pos.pay.method.\(kind.rawValue)")
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    /// Runde Euro-Beträge kompakt („30 €“), sonst volle Formatierung.
    private func cashChipLabel(_ cents: Int) -> String {
        if cents % 100 == 0 {
            return "\(cents / 100) €"
        }
        return PosMoney.format(cents)
    }

    private var tenderSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Gegeben")
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tenders, id: \.self) { value in
                        let title = value == totalCents ? "Passend" : cashChipLabel(value)
                        Button {
                            givenCents = value
                            if value == totalCents { stimmtSo = false }
                        } label: {
                            PosChip(title: title, selected: givenCents == value)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(title)
                        .accessibilityIdentifier(
                            value == totalCents ? "pos.pay.tender.exact" : "pos.pay.tender.\(value)"
                        )
                    }
                }
            }

            if let given = givenCents, given > amountCents {
                Toggle(isOn: $stimmtSo) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Stimmt so")
                            .font(.subheadline.weight(.semibold))
                        Text("Kein Rückgeld — Differenz als Trinkgeld")
                            .font(.caption2)
                            .foregroundStyle(PosDesign.muted)
                    }
                }
                .tint(PosDesign.brandAccent)
                .accessibilityIdentifier("pos.pay.stimmtSo")
                .onChange(of: stimmtSo) { _, on in
                    if on {
                        roundUpToCents = nil
                        percentTip = 0
                    }
                }
            }

            if let given = givenCents {
                HStack {
                    Text(stimmtSo ? "Trinkgeld (stimmt so)" : "Rückgeld")
                        .foregroundStyle(PosDesign.muted)
                    Spacer()
                    Text(PosMoney.format(stimmtSo ? tipCents : changeCents))
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .foregroundStyle(PosDesign.green)
                }
                .padding(14)
                .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                Text("Gegeben \(PosMoney.format(given))")
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
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
                .foregroundStyle(PosDesign.ink)
            Text(method == .paypal
                ? "Gast scannt den Code (Demo)."
                : "Gast kann Karte oder Smartphone auflegen (Demo).")
                .font(.subheadline)
                .foregroundStyle(PosDesign.muted)
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
                .foregroundStyle(PosDesign.muted)
            if tipCents > 0 {
                Text("davon \(PosMoney.format(tipCents)) Trinkgeld")
                    .font(.subheadline)
                    .foregroundStyle(PosDesign.muted)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var methodLabel: String {
        switch method {
        case .cash: return stimmtSo ? "Bar · stimmt so" : "Bar"
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
