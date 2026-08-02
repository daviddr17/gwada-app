import SwiftUI

/// Prototyp-Kassieren: Nach Positionen / Gleich teilen + Daumen-Dock → PaymentSheet.
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
        let lines: [SessionOpenLine]
        let label: String
    }

    @State private var mode: Mode = .positions
    @State private var selected: Set<String> = []
    @State private var evenN = 2
    @State private var settledShareCents = 0
    @State private var payTarget: PayTarget?
    @State private var shownReceipt: PosLocalReceipt?
    @State private var showTableReceipts = false

    private var openTotal: Int { lines.reduce(0) { $0 + $1.openCents } }
    private var allPaid: Bool { lines.isEmpty }
    private var shareActive: Bool { settledShareCents > 0 }
    private var shareAmount: Int {
        PosSplitBillState.shareCents(openCents: openTotal, evenN: evenN)
    }
    private var selectedLines: [SessionOpenLine] {
        lines.filter { selected.contains($0.id) }
    }
    private var selectedTotal: Int {
        selectedLines.reduce(0) { $0 + $1.openCents }
    }
    private var tableReceipts: [PosLocalReceipt] {
        PosOfflineCaches.receipts(forTableLabel: tableLabel)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
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
                    Text(shareActive
                        ? "Anteil schon bezahlt — weiter über „Gleich teilen“ oder Rest."
                        : "Positionen antippen, dann Auswahl oder Rest kassieren.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, PosLayout.page)
                        .padding(.bottom, PosLayout.stack)
                }

                ScrollView {
                    LazyVStack(spacing: PosLayout.stack) {
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
                    .padding(.bottom, 160)
                }
                .opacity(mode == .even && !allPaid ? 0.55 : 1)
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
                    amountCents: target.lines.reduce(0) { $0 + $1.openCents },
                    label: target.label,
                    tableName: tableLabel,
                    onComplete: { method, tip, received in
                        payTarget = nil
                        Task {
                            let receipt = await runtime.collectSplit(
                                sessionId: sessionId,
                                lines: target.lines,
                                method: method,
                                tipCents: tip,
                                receivedAmountCents: received,
                                receiptLabel: target.label
                            )
                            if mode == .even, target.label.contains("Anteil") {
                                settledShareCents += target.lines.reduce(0) { $0 + $1.openCents }
                                evenN = max(1, evenN - 1)
                            }
                            await onPaid()
                            selected.removeAll()
                            shownReceipt = receipt
                        }
                    },
                    onClose: { payTarget = nil }
                )
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
                                        .foregroundStyle(.secondary)
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
                .presentationDetents([.medium, .large])
            }
            .onAppear {
                if selected.isEmpty {
                    selected = Set(lines.map(\.id))
                }
            }
            .onChange(of: lines.map(\.id)) { _, ids in
                selected = selected.intersection(Set(ids))
            }
        }
        .accessibilityIdentifier("pos.kassieren")
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(tableLabel) kassieren")
                    .font(.title2.weight(.bold))
                Text(allPaid ? "✓ Komplett bezahlt" : "Noch offen")
                    .font(.subheadline)
                    .foregroundStyle(allPaid ? PosDesign.green : .secondary)
            }
            Spacer(minLength: 8)
            Text(PosMoney.format(openTotal))
                .font(.title2.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.accentColor)
        }
        .padding(.horizontal, PosLayout.page)
        .padding(.top, 8)
        .padding(.bottom, PosLayout.stack)
    }

    private var modePicker: some View {
        PosSegmentedControl(options: Array(Mode.allCases), selection: $mode) { $0.title }
    }

    private var evenCard: some View {
        VStack(spacing: PosLayout.stack) {
            HStack {
                Text("Geteilt durch")
                    .foregroundStyle(.secondary)
                Spacer()
                PosStepperControl(value: evenN, range: 1 ... 12) { evenN = $0 }
            }
            Text(PosMoney.format(shareAmount))
                .font(.largeTitle.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.accentColor)
            Text("pro Anteil · letzter Anteil zahlt den Rest")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
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
        let isOn = selected.contains(line.id)
        let interactive = mode == .positions && !shareActive
        return Button {
            guard interactive else { return }
            if isOn { selected.remove(line.id) } else { selected.insert(line.id) }
        } label: {
            PosCardRow(emphasized: isOn && interactive) {
                HStack(spacing: 12) {
                    Text("\(line.openQuantity)×")
                        .font(.body.monospacedDigit())
                        .frame(width: 32, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(line.name)
                            .font(.body.weight(.medium))
                            .foregroundStyle(PosDesign.ink)
                            .lineLimit(2)
                        if !line.detail.isEmpty {
                            Text(line.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 4)
                    if interactive {
                        Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(isOn ? Color.accentColor : .secondary)
                            .font(.title3)
                    }
                    Text(PosMoney.format(line.openCents))
                        .font(.body.monospacedDigit())
                        .frame(minWidth: 64, alignment: .trailing)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(!interactive)
    }

    @ViewBuilder
    private var dock: some View {
        PosThumbDock {
            if allPaid {
                Text("✓ Alles bezahlt — Tisch freigeben, wenn die Gäste gehen.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                PosButton(title: "\(tableLabel) freigeben", kind: .primary) {
                    Task { await onRelease() }
                }
                if !tableReceipts.isEmpty {
                    PosButton(title: "Belege anzeigen (\(tableReceipts.count))", kind: .secondary) {
                        showTableReceipts = true
                    }
                }
            } else if mode == .positions {
                HStack(spacing: PosLayout.dockGap) {
                    PosAmountButton(
                        title: "Auswahl",
                        amountCents: selectedTotal,
                        kind: .secondary,
                        enabled: selectedTotal > 0 && !shareActive
                    ) {
                        openPay(lines: selectedLines, label: "Auswahl")
                    }
                    PosAmountButton(
                        title: "Rest / Alles",
                        amountCents: openTotal,
                        kind: .primary,
                        enabled: openTotal > 0
                    ) {
                        openPay(lines: lines, label: "Rest / Alles")
                    }
                }
            } else {
                HStack(spacing: PosLayout.dockGap) {
                    PosAmountButton(
                        title: "1 Anteil",
                        amountCents: shareAmount,
                        kind: .primary,
                        enabled: openTotal > 0
                    ) {
                        openSharePay()
                    }
                    PosAmountButton(
                        title: "Rest",
                        amountCents: openTotal,
                        kind: .secondary,
                        enabled: openTotal > 0
                    ) {
                        openPay(lines: lines, label: "Rest")
                    }
                }
            }
        }
    }

    private func openPay(lines payLines: [SessionOpenLine], label: String) {
        guard !payLines.isEmpty else { return }
        payTarget = PayTarget(lines: payLines, label: label)
    }

    /// Anteil: Positionen anteilig der Summe nach — für Demo die ersten offenen bis Anteilssumme.
    private func openSharePay() {
        guard openTotal > 0 else { return }
        let target = shareAmount
        var picked: [SessionOpenLine] = []
        var sum = 0
        for line in lines {
            if sum >= target { break }
            picked.append(line)
            sum += line.openCents
        }
        if picked.isEmpty { picked = lines }
        // Wenn ein Anteil kleiner als erste Position: trotzdem ganze Positionen (Demo).
        openPay(lines: picked, label: "1 Anteil")
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
