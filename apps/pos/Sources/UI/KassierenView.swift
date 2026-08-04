import SwiftUI

/// Kassieren: Mengen-Stepper → Korb „Diese Zahlung“ (+ Gleich teilen Shortcut).
/// Nach erster Teilzahlung ist der Modus gesperrt (kein Mischbetrieb Positions ↔ Anteile).
struct KassierenView: View {
    let tableLabel: String
    let sessionId: String
    @Binding var lines: [SessionOpenLine]
    var onPaid: () async -> Void
    var onRelease: () async -> Void
    var onClose: () -> Void

    @EnvironmentObject private var runtime: PosRuntime

    private enum Mode: String, CaseIterable, Identifiable, Hashable {
        case positions
        case even
        var id: String { rawValue }
        var title: String {
            switch self {
            case .positions: return "Nach Positionen"
            case .even: return "Gleich teilen"
            }
        }
    }

    private struct PayTarget: Identifiable {
        let id = UUID()
        let allocations: [PosPayAllocation]
        let label: String
        var amountCents: Int { allocations.reduce(0) { $0 + $1.amountCents } }
    }

    @State private var mode: Mode = .positions
    /// Menge im Korb pro offener Zeile (0 = nicht im Korb).
    @State private var basketQty: [String: Int] = [:]
    @State private var evenN = 2
    /// Geplante Anzahl Anteile beim ersten Anteil (für „Anteil 1/3“).
    @State private var evenPlanN: Int?
    @State private var evenSharesCompleted = 0
    @State private var settledShareCents = 0
    /// Nach erster erfolgreicher Teilzahlung dieser Kassieren-Session.
    @State private var modeLocked = false
    @State private var payTarget: PayTarget?
    @State private var shownReceipt: PosLocalReceipt?
    @State private var showTableReceipts = false
    @State private var payError = ""

    private var openTotal: Int { lines.reduce(0) { $0 + $1.openCents } }
    private var allPaid: Bool { lines.isEmpty }
    private var canPay: Bool { runtime.canCollectAtRegister }
    private var shareAmount: Int {
        PosSplitBillState.shareCents(openCents: openTotal, evenN: evenN)
    }

    /// Nur noch Rest (letzter Anteil oder N=1).
    private var evenIsRestOnly: Bool {
        openTotal > 0 && (evenN <= 1 || shareAmount >= openTotal)
    }

    private var evenDisplayPlanN: Int {
        evenPlanN ?? evenN
    }

    private var nextShareIndex: Int {
        evenSharesCompleted + 1
    }

    private var nextShareLabel: String {
        "Anteil \(nextShareIndex)/\(evenDisplayPlanN)"
    }

    private var evenRestLabel: String {
        if evenSharesCompleted > 0, let plan = evenPlanN {
            return "Anteil \(plan)/\(plan) · Rest"
        }
        return "Rest"
    }

    private var basketAllocations: [PosPayAllocation] {
        lines.compactMap { line in
            let qty = basketQty[line.id] ?? 0
            return PosPayAllocation.make(from: line, quantity: qty)
        }
    }

    private var basketTotal: Int {
        basketAllocations.reduce(0) { $0 + $1.amountCents }
    }

    private var tableReceipts: [PosLocalReceipt] {
        PosOfflineCaches.receipts(forTableLabel: tableLabel)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                if !canPay, !allPaid {
                    Text("Kassieren nur mit erreichbarer Kasse.")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }
                if !payError.isEmpty {
                    Text(payError)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }
                if !allPaid {
                    modePicker
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }
                if mode == .even, !allPaid {
                    evenCard
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }
                if mode == .positions, !allPaid {
                    Text("Mengen wählen → Korb „Diese Zahlung“. Teilmengen möglich (z. B. 1 von 4).")
                        .font(.subheadline)
                        .foregroundStyle(PosDesign.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }

                ScrollView {
                    LazyVStack(spacing: PosLayout.stack) {
                        if mode == .even, !allPaid {
                            Text("Offene Positionen (nur Übersicht)")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(PosDesign.muted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(lines) { line in
                            lineRow(line)
                        }
                        if lines.isEmpty {
                            ContentUnavailableView(
                                "Alles bezahlt",
                                systemImage: "checkmark.circle",
                                description: Text("Tisch freigeben, wenn die Gäste gehen.")
                            )
                            .padding(.top, 40)
                        }
                    }
                    .padding(.horizontal, PosLayout.page)
                    .padding(.bottom, PosLayout.page)
                }
                .opacity(mode == .even && !allPaid ? 0.72 : 1)
                .allowsHitTesting(mode == .positions || allPaid)
            }
            .background(PosDesign.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fertig", action: onClose)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if !tableReceipts.isEmpty {
                        Button {
                            showTableReceipts = true
                        } label: {
                            Label("Belege", systemImage: "doc.text")
                        }
                        .accessibilityLabel("Belege anzeigen (\(tableReceipts.count))")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                dock
            }
            .sheet(item: $payTarget) { target in
                PosPaymentSheetView(
                    amountCents: target.amountCents,
                    label: target.label,
                    tableName: tableLabel,
                    onComplete: { method, tip, received in
                        payTarget = nil
                        Task {
                            payError = ""
                            let receipt = await runtime.collectSplit(
                                sessionId: sessionId,
                                allocations: target.allocations,
                                method: method,
                                tipCents: tip,
                                receivedAmountCents: received,
                                receiptLabel: target.label
                            )
                            guard let receipt else {
                                payError = runtime.statusMessage.isEmpty
                                    ? "Zahlung fehlgeschlagen."
                                    : runtime.statusMessage
                                return
                            }
                            registerSuccessfulCollect(for: target)
                            await onPaid()
                            pruneBasket()
                            shownReceipt = receipt
                        }
                    },
                    onClose: { payTarget = nil }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
            .sheet(item: $shownReceipt) { receipt in
                PosGuestReceiptSheet(receipt: receipt) {
                    shownReceipt = nil
                }
            }
            .sheet(isPresented: $showTableReceipts) {
                NavigationStack {
                    List(tableReceipts) { receipt in
                        Button {
                            showTableReceipts = false
                            shownReceipt = receipt
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Beleg #\(receipt.orderNumber)")
                                        .font(.headline)
                                    Text("\(receipt.label ?? "Zahlung") · \(methodTitle(receipt.method))")
                                        .font(.caption)
                                        .foregroundStyle(PosDesign.muted)
                                }
                                Spacer()
                                Text(PosMoney.format(receipt.paidTotalCents))
                                    .font(.body.monospacedDigit().weight(.semibold))
                            }
                        }
                    }
                    .navigationTitle("Belege · \(tableLabel)")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Schließen") { showTableReceipts = false }
                        }
                    }
                }
                .presentationDetents([.large])
            }
            .onChange(of: lines.map(\.id)) { _, ids in
                let idSet = Set(ids)
                basketQty = basketQty.filter { idSet.contains($0.key) }
                for line in lines {
                    if let q = basketQty[line.id], q > line.openQuantity {
                        basketQty[line.id] = line.openQuantity
                    }
                }
            }
            .onChange(of: mode) { _, newMode in
                guard !modeLocked else { return }
                if newMode == .even {
                    basketQty = [:]
                }
            }
            .onAppear {
                restoreKassierenLockIfNeeded()
            }
            .onChange(of: allPaid) { _, paid in
                if paid {
                    PosHubState.shared.clearKassierenLock(sessionId: sessionId)
                    modeLocked = false
                }
            }
        }
        .accessibilityIdentifier("pos.kassieren")
    }

    private func restoreKassierenLockIfNeeded() {
        guard let lock = PosHubState.shared.kassierenLock(sessionId: sessionId) else { return }
        if lock.mode == PosKassierenLockState.modeEven {
            mode = .even
        } else {
            mode = .positions
        }
        evenN = max(1, lock.evenN)
        evenPlanN = lock.evenPlanN
        evenSharesCompleted = lock.evenSharesCompleted
        settledShareCents = lock.settledShareCents
        modeLocked = true
    }

    private func persistKassierenLock() {
        let state = PosKassierenLockState(
            mode: mode == .even ? PosKassierenLockState.modeEven : PosKassierenLockState.modePositions,
            evenN: evenN,
            evenPlanN: evenPlanN,
            evenSharesCompleted: evenSharesCompleted,
            settledShareCents: settledShareCents
        )
        PosHubState.shared.setKassierenLock(sessionId: sessionId, state: state)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(tableLabel) kassieren")
                    .font(.title2.weight(.bold))
                Text(allPaid ? "✓ Komplett bezahlt" : "Noch offen")
                    .font(.subheadline)
                    .foregroundStyle(allPaid ? PosDesign.green : PosDesign.muted)
            }
            Spacer(minLength: 8)
            Text(PosMoney.format(openTotal))
                .font(.title2.weight(.semibold).monospacedDigit())
                .foregroundStyle(PosDesign.ink)
        }
        .padding(.horizontal, PosLayout.page)
        .padding(.top, 8)
        .padding(.bottom, PosLayout.stack)
    }

    private var modePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            PosSegmentedControl(
                options: Array(Mode.allCases),
                selection: $mode,
                title: { $0.title },
                enabled: !modeLocked
            )
            if modeLocked {
                Text("Modus gesperrt — Rechnung wird so zu Ende kassiert.")
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
                    .accessibilityIdentifier("pos.kassieren.modeLocked")
            }
        }
    }

    private var evenCard: some View {
        VStack(spacing: PosLayout.stack) {
            if evenIsRestOnly {
                HStack {
                    Text(evenSharesCompleted > 0 ? "Offener Rest" : "Gesamtbetrag")
                        .foregroundStyle(PosDesign.muted)
                    Spacer()
                    if let plan = evenPlanN, evenSharesCompleted > 0 {
                        Text("\(evenSharesCompleted)/\(plan) Anteile")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PosDesign.muted)
                    }
                }
                Text(PosMoney.format(openTotal))
                    .font(.largeTitle.weight(.semibold).monospacedDigit())
                    .foregroundStyle(PosDesign.ink)
                Text(
                    evenSharesCompleted > 0
                        ? "Letzter Anteil — Rest als eine Zahlung abschließen."
                        : "Eine Person zahlt den gesamten offenen Betrag."
                )
                .font(.caption)
                .foregroundStyle(PosDesign.muted)
                .multilineTextAlignment(.center)
            } else {
                HStack {
                    Text("Geteilt durch")
                        .foregroundStyle(PosDesign.muted)
                    Spacer()
                    PosStepperControl(
                        value: evenN,
                        range: 2 ... 12,
                        enabled: !modeLocked
                    ) { evenN = $0 }
                }
                Text(PosMoney.format(shareAmount))
                    .font(.largeTitle.weight(.semibold).monospacedDigit())
                    .foregroundStyle(PosDesign.ink)
                Text("pro Anteil · \(nextShareLabel)")
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
                    .multilineTextAlignment(.center)
            }
            if settledShareCents > 0 {
                Text("✓ Bereits über Anteile: \(PosMoney.format(settledShareCents))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(PosDesign.green)
            }
        }
        .padding(PosLayout.page)
        .background(PosDesign.surface, in: RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: PosLayout.cardRadius, style: .continuous)
                .strokeBorder(PosDesign.line, lineWidth: 1)
        }
    }

    private func lineRow(_ line: SessionOpenLine) -> some View {
        let qty = basketQty[line.id] ?? 0
        let sliceCents = PosSettlementMath.sliceAmountCents(
            lineTotalCents: line.settlementLineTotalCents,
            lineQuantity: line.settlementLineQuantity,
            paidQuantityBefore: line.paidQuantity,
            allocQuantity: max(qty, 0)
        )
        return PosCardRow(emphasized: mode == .positions && qty > 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("\(line.openQuantity)× offen")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(PosDesign.muted)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(line.name)
                            .font(.body.weight(.medium))
                            .foregroundStyle(PosDesign.ink)
                            .lineLimit(2)
                        if !line.detail.isEmpty {
                            Text(line.detail)
                                .font(.caption)
                                .foregroundStyle(PosDesign.muted)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 4)
                    Text(PosMoney.format(line.openCents))
                        .font(.body.monospacedDigit())
                        .frame(minWidth: 64, alignment: .trailing)
                }
                if mode == .positions {
                    // Stepper rechts bündig; Slice-Betrag links davon mit fester Breite → keine Verschiebung.
                    HStack(spacing: 10) {
                        Text("Im Korb")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PosDesign.muted)
                        Spacer(minLength: 4)
                        Text(qty > 0 ? PosMoney.format(sliceCents) : " ")
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                            .foregroundStyle(PosDesign.brandAccent)
                            .frame(width: 64, alignment: .trailing)
                            .opacity(qty > 0 ? 1 : 0)
                            .accessibilityHidden(qty == 0)
                        PosQtyStepper(
                            quantity: qty,
                            onDecrement: {
                                basketQty[line.id] = max(0, qty - 1)
                                if basketQty[line.id] == 0 { basketQty[line.id] = nil }
                            },
                            onIncrement: {
                                basketQty[line.id] = min(line.openQuantity, qty + 1)
                            }
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var dock: some View {
        PosThumbDock {
            if allPaid {
                Text("✓ Alles bezahlt — Tisch freigeben, wenn die Gäste gehen.")
                    .font(.subheadline)
                    .foregroundStyle(PosDesign.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                PosButton(title: "\(tableLabel) freigeben", kind: .primary) {
                    Task { await onRelease() }
                }
            } else if mode == .positions {
                if basketTotal > 0 {
                    Text("Diese Zahlung · \(basketAllocations.map { "\($0.quantity)× \($0.name)" }.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundStyle(PosDesign.muted)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                HStack(spacing: PosLayout.dockGap) {
                    PosAmountButton(
                        title: "Diese Zahlung",
                        amountCents: basketTotal,
                        kind: .primary,
                        enabled: canPay && basketTotal > 0
                    ) {
                        openPay(allocations: basketAllocations, label: "Diese Zahlung")
                    }
                    PosAmountButton(
                        title: "Rest / Alles",
                        amountCents: openTotal,
                        kind: .secondary,
                        enabled: canPay && openTotal > 0
                    ) {
                        let all = lines.compactMap { PosPayAllocation.make(from: $0, quantity: $0.openQuantity) }
                        openPay(allocations: all, label: "Rest / Alles")
                    }
                }
            } else if evenIsRestOnly {
                PosAmountButton(
                    title: evenRestLabel,
                    amountCents: openTotal,
                    kind: .primary,
                    enabled: canPay && openTotal > 0
                ) {
                    let all = lines.compactMap { PosPayAllocation.make(from: $0, quantity: $0.openQuantity) }
                    openPay(allocations: all, label: evenRestLabel)
                }
            } else {
                HStack(spacing: PosLayout.dockGap) {
                    PosAmountButton(
                        title: nextShareLabel,
                        amountCents: shareAmount,
                        kind: .primary,
                        enabled: canPay && openTotal > 0
                    ) {
                        openSharePay()
                    }
                    PosAmountButton(
                        title: "Rest",
                        amountCents: openTotal,
                        kind: .secondary,
                        enabled: canPay && openTotal > 0
                    ) {
                        let all = lines.compactMap { PosPayAllocation.make(from: $0, quantity: $0.openQuantity) }
                        openPay(allocations: all, label: "Rest")
                    }
                }
            }
        }
    }

    private func registerSuccessfulCollect(for target: PayTarget) {
        modeLocked = true
        let isShare = mode == .even && target.label.hasPrefix("Anteil") && !target.label.contains("Rest")
        if isShare {
            if evenPlanN == nil {
                evenPlanN = evenN
            }
            evenSharesCompleted += 1
            settledShareCents += target.amountCents
            evenN = max(1, evenN - 1)
        } else if mode == .even, target.label.contains("Rest") {
            settledShareCents += target.amountCents
            evenN = 1
        }
        persistKassierenLock()
    }

    private func openPay(allocations: [PosPayAllocation], label: String) {
        guard canPay, !allocations.isEmpty else { return }
        payError = ""
        payTarget = PayTarget(allocations: allocations, label: label)
    }

    /// Anteil: Einheiten gierig bis Zielsumme (Teilmengen).
    private func openSharePay() {
        guard openTotal > 0 else { return }
        if evenIsRestOnly {
            let all = lines.compactMap { PosPayAllocation.make(from: $0, quantity: $0.openQuantity) }
            openPay(allocations: all, label: evenRestLabel)
            return
        }
        let target = shareAmount
        let label = nextShareLabel
        var picked: [PosPayAllocation] = []
        var sum = 0
        for line in lines {
            if sum >= target { break }
            var take = 0
            let paidBase = line.paidQuantity
            for unit in 1 ... line.openQuantity {
                let delta = PosSettlementMath.unitCents(
                    lineTotalCents: line.settlementLineTotalCents,
                    lineQuantity: line.settlementLineQuantity,
                    unitIndex: paidBase + unit
                )
                if sum + delta > target, take > 0 { break }
                take = unit
                sum += delta
                if sum >= target { break }
            }
            if take > 0, let alloc = PosPayAllocation.make(from: line, quantity: take) {
                picked.append(alloc)
            }
            sum = picked.reduce(0) { $0 + $1.amountCents }
        }
        if picked.isEmpty, let first = lines.first,
           let alloc = PosPayAllocation.make(from: first, quantity: 1)
        {
            picked = [alloc]
        }
        openPay(allocations: picked, label: label)
    }

    private func pruneBasket() {
        let openIds = Set(lines.map(\.id))
        basketQty = basketQty.filter { openIds.contains($0.key) }
        for line in lines {
            if let q = basketQty[line.id] {
                basketQty[line.id] = min(q, line.openQuantity)
                if basketQty[line.id] == 0 { basketQty[line.id] = nil }
            }
        }
    }

    private func methodTitle(_ method: String) -> String {
        switch method {
        case "cash": return "Bar"
        case "card": return "Karte"
        case "paypal": return "PayPal"
        default: return method
        }
    }
}
