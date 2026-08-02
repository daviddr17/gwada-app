import SwiftUI

struct BonSheetActionState {
    private(set) var schickenCourses: Set<Int> = []

    mutating func beginSchicken(course: Int) -> Bool {
        schickenCourses.insert(course).inserted
    }

    mutating func finishSchicken(course: Int) {
        schickenCourses.remove(course)
    }
}

/// Unsent cart lines for a course → show „Gang N schicken“ (prototype CartSheet).
func courseNeedsSchicken(cart: [PosCartLine], course: Int) -> Bool {
    cart.contains { $0.course == course }
}

/// Sent open lines for a course that still need kitchen fire.
func courseNeedsFire(openLines: [SessionOpenLine], course: Int, sessionId: String) -> Bool {
    let courseLines = openLines.filter { $0.course == course }
    return !courseLines.isEmpty
        && !courseLines.contains(where: \.isFired)
        && !PosHubState.shared.hasFired(sessionId: sessionId, course: course)
}

struct BonSheetView: View {
    let tableLabel: String
    let sessionId: String
    @Binding var cart: [PosCartLine]
    @Binding var openLines: [SessionOpenLine]
    let coverCount: Int?
    /// Prototype: one CTA per course — send that course’s cart lines and fire kitchen.
    var onSchicken: (Int) async -> Bool
    var onWeiterBestellen: () -> Void
    var onZurRechnung: () -> Void

    @State private var actionState = BonSheetActionState()

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }
    private var grandTotal: Int { cartTotal + openTotal }
    private var hasAnything: Bool { !cart.isEmpty || !openLines.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                PosPanelCard {
                    VStack(alignment: .leading, spacing: PosLayout.stack) {
                        receiptHeader

                        if !hasAnything {
                            Text("Noch keine Artikel. Bon schließen und Artikel antippen.")
                                .font(.subheadline)
                                .foregroundStyle(PosDesign.muted)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        }

                        ForEach(PosCourse.uiCourses, id: \.self) { course in
                            let cartLines = cart.filter { $0.course == course }
                            let sentLines = openLines.filter { $0.course == course }

                            if !cartLines.isEmpty || !sentLines.isEmpty {
                                courseSection(
                                    course: course,
                                    cartLines: cartLines,
                                    sentLines: sentLines
                                )
                            }
                        }

                        if hasAnything {
                            summeRow
                        }
                    }
                }
                .padding(PosDesign.sectionSpacing)
            }
            .background(PosDesign.bg)
            .navigationTitle("Bon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(PosDesign.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .safeAreaInset(edge: .bottom) {
                actions
            }
        }
        .accessibilityIdentifier("pos.bon.sheet")
    }

    private var receiptHeader: some View {
        VStack(spacing: 6) {
            Text("BON")
                .font(.caption.weight(.semibold).monospaced())
                .tracking(1.2)
                .foregroundStyle(PosDesign.muted)
            Text(tableLabel)
                .font(PosDesign.fontDisplay)
                .foregroundStyle(PosDesign.ink)
            if let coverCount {
                Text("\(coverCount) Gäste")
                    .font(.caption.monospaced())
                    .foregroundStyle(PosDesign.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 8)
    }

    private var summeRow: some View {
        VStack(spacing: 8) {
            Divider().overlay(PosDesign.line)
            HStack {
                Text("Summe")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(PosDesign.ink)
                Spacer()
                Text(PosMoney.format(grandTotal))
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .foregroundStyle(PosDesign.ink)
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func courseSection(
        course: Int,
        cartLines: [PosCartLine],
        sentLines: [SessionOpenLine]
    ) -> some View {
        let allSent = cartLines.isEmpty && !sentLines.isEmpty
        let kitchenDone = allSent && (
            sentLines.allSatisfy(\.isFired)
                || PosHubState.shared.hasFired(sessionId: sessionId, course: course)
        )

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(PosCourse.bonHeaderLabel(course))
                    .font(.caption.weight(.bold).monospaced())
                    .tracking(0.8)
                    .foregroundStyle(PosDesign.ink)
                    .accessibilityLabel(PosCourse.chipLabel(course))
                Rectangle()
                    .fill(PosDesign.line)
                    .frame(height: 1)
                if kitchenDone {
                    Text("✓ Küche")
                        .font(.caption.monospaced())
                        .foregroundStyle(PosDesign.green)
                }
            }

            ForEach(cartLines) { line in
                cartLine(line)
            }

            ForEach(sentLines) { line in
                sentLine(line)
            }

            if courseNeedsSchicken(cart: cartLines, course: course)
                || courseNeedsFire(openLines: sentLines, course: course, sessionId: sessionId)
            {
                PosButton(
                    title: "\(PosCourse.chipLabel(course)) schicken",
                    kind: .secondary,
                    enabled: !actionState.schickenCourses.contains(course)
                ) {
                    Task { await schicken(course: course) }
                }
                .accessibilityIdentifier("pos.bon.schicken.\(course)")
            }
        }
        .padding(.vertical, 8)
    }

    private func cartLine(_ line: PosCartLine) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(line.quantity)×")
                    .font(PosDesign.fontMonoTabular)
                    .foregroundStyle(PosDesign.ink)
                    .frame(minWidth: 28, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(PosDesign.ink)
                    if !line.subtitle.isEmpty {
                        Text(line.subtitle)
                            .font(.caption)
                            .foregroundStyle(PosDesign.muted)
                    }
                    Button {
                        cycleCourse(line)
                    } label: {
                        Text("\(PosCourse.chipLabel(line.course)) · tippen zum Wechseln")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(PosDesign.muted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Gang wechseln")
                }
                Spacer(minLength: 8)
                Text(PosMoney.format(line.lineTotalCents))
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(PosDesign.ink)
            }

            HStack(spacing: 0) {
                Spacer(minLength: 28)
                PosQtyStepper(
                    quantity: line.quantity,
                    onDecrement: { decrement(line) },
                    onIncrement: { increment(line) }
                )
                Spacer(minLength: 0)
            }
        }
        .padding(.vertical, 4)
    }

    private func sentLine(_ line: SessionOpenLine) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(line.openQuantity)×")
                .font(PosDesign.fontMonoTabular)
                .frame(width: 28, alignment: .leading)
                .foregroundStyle(PosDesign.muted)
            VStack(alignment: .leading, spacing: 2) {
                Text(line.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(PosDesign.ink)
                if !line.detail.isEmpty {
                    Text(line.detail)
                        .font(.caption)
                        .foregroundStyle(PosDesign.muted)
                }
            }
            Spacer(minLength: 4)
            Text(PosMoney.format(line.openCents))
                .font(PosDesign.fontMonoTabular)
                .frame(width: 64, alignment: .trailing)
                .foregroundStyle(PosDesign.ink)
        }
        .opacity(0.62)
    }

    private var actions: some View {
        HStack(spacing: PosLayout.dockGap) {
            PosButton(title: "Weiter bestellen", kind: .secondary, action: onWeiterBestellen)
            PosButton(title: "Zur Rechnung", kind: .primary, enabled: hasAnything, action: onZurRechnung)
                .accessibilityIdentifier("pos.bon.zurRechnung")
        }
        .padding(PosLayout.page)
        .background(PosDesign.surface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(PosDesign.line)
                .frame(height: 1)
        }
        .posLiquidGlassBar()
    }

    @MainActor
    private func schicken(course: Int) async {
        guard actionState.beginSchicken(course: course) else { return }
        defer { actionState.finishSchicken(course: course) }
        _ = await onSchicken(course)
    }

    private func decrement(_ line: PosCartLine) {
        guard let index = cart.firstIndex(where: { $0.id == line.id }) else { return }
        if cart[index].quantity == 1 {
            cart.remove(at: index)
        } else {
            cart[index].quantity -= 1
        }
    }

    private func increment(_ line: PosCartLine) {
        var added = line
        added.id = UUID().uuidString
        added.quantity = 1
        cart = PosCart.merging(cart, adding: added)
    }

    private func cycleCourse(_ line: PosCartLine) {
        let nextCourse = line.course == PosCourse.dessert ? PosCourse.starter : line.course + 1
        cart = PosCart.changingCourse(cart, lineId: line.id, to: nextCourse)
    }
}

#if DEBUG
#Preview {
    BonSheetView(
        tableLabel: "Tisch 12",
        sessionId: "preview-session",
        cart: .constant([]),
        openLines: .constant([]),
        coverCount: 2,
        onSchicken: { _ in true },
        onWeiterBestellen: {},
        onZurRechnung: {}
    )
}
#endif
