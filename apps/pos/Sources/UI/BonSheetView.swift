import SwiftUI

struct BonSheetActionState {
    private(set) var sending = false
    private(set) var firingCourses: Set<Int> = []

    mutating func beginSending() -> Bool {
        guard !sending else { return false }
        sending = true
        return true
    }

    mutating func finishSending() {
        sending = false
    }

    mutating func beginFiring(course: Int) -> Bool {
        firingCourses.insert(course).inserted
    }

    mutating func finishFiring(course: Int) {
        firingCourses.remove(course)
    }
}

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
    let openLines: [SessionOpenLine]
    let coverCount: Int?
    var onSend: () async -> Bool
    var onFire: (Int) async -> Void
    var onWeiterBestellen: () -> Void
    var onZurRechnung: () -> Void

    @State private var actionState = BonSheetActionState()

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }

    var body: some View {
        NavigationStack {
            ScrollView {
                PaperReceiptView {
                    receiptHeader

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
                }
                .padding(PosDesign.sectionSpacing)
            }
            .background(PosDesign.bg)
            .navigationTitle("Bon")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                actions
            }
        }
        .accessibilityIdentifier("pos.bon.sheet")
    }

    private var receiptHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(tableLabel)
                .font(PosDesign.fontDisplay)
            if let coverCount {
                Text("\(coverCount) Personen")
                    .font(PosDesign.fontBody)
                    .foregroundStyle(PosDesign.muted)
            }
            HStack {
                Text("Offen")
                Spacer()
                Text(PosMoney.format(cartTotal + openTotal))
                    .font(PosDesign.fontMonoTabular)
            }
            .padding(.top, 6)
            Divider()
        }
    }

    @ViewBuilder
    private func courseSection(
        course: Int,
        cartLines: [PosCartLine],
        sentLines: [SessionOpenLine]
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(PosCourse.label(course))
                .font(.headline)
                .foregroundStyle(PosDesign.courseColor(course))

            ForEach(cartLines) { line in
                cartLine(line)
            }

            ForEach(sentLines) { line in
                sentLine(line)
            }

            if courseNeedsFire(openLines: sentLines, course: course, sessionId: sessionId) {
                Button("\(PosCourse.chipLabel(course)) schicken") {
                    Task { await fire(course: course) }
                }
                .buttonStyle(.bordered)
                .tint(PosDesign.courseColor(course))
                .disabled(actionState.firingCourses.contains(course))
            }
        }
        .padding(.vertical, 8)
    }

    private func cartLine(_ line: PosCartLine) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(line.quantity)× \(line.name)")
                    .font(.body.weight(.semibold))
                if !line.subtitle.isEmpty {
                    Text(line.subtitle)
                        .font(.caption)
                        .foregroundStyle(PosDesign.muted)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                Text(PosMoney.format(line.lineTotalCents))
                    .font(PosDesign.fontMonoTabular)
                HStack(spacing: 4) {
                    Button {
                        decrement(line)
                    } label: {
                        Image(systemName: "minus")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        increment(line)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        cycleCourse(line)
                    } label: {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Gang wechseln")
                }
            }
        }
    }

    private func sentLine(_ line: SessionOpenLine) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(line.openQuantity)× \(line.name)")
                    .font(.body.weight(.semibold))
                if !line.detail.isEmpty {
                    Text(line.detail)
                        .font(.caption)
                        .foregroundStyle(PosDesign.muted)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Text(PosMoney.format(line.openCents))
                    .font(PosDesign.fontMonoTabular)
                if line.isFired {
                    PosStatusBadge(title: "Gefeuert", emphasized: true, tint: PosDesign.green)
                } else {
                    PosStatusBadge(title: "Gesendet", tint: PosDesign.courseColor(line.course))
                }
            }
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button {
                Task { await send() }
            } label: {
                Text("Senden · \(PosMoney.format(cartTotal))")
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .disabled(cart.isEmpty || actionState.sending)

            HStack(spacing: 10) {
                Button("Weiter bestellen", action: onWeiterBestellen)
                    .buttonStyle(PosSecondaryButtonStyle())
                Button("Zur Rechnung", action: onZurRechnung)
                    .buttonStyle(PosSecondaryButtonStyle())
            }
        }
        .padding(PosDesign.sectionSpacing)
        .background(.ultraThinMaterial)
    }

    @MainActor
    private func send() async {
        guard actionState.beginSending() else { return }
        defer { actionState.finishSending() }
        _ = await onSend()
    }

    @MainActor
    private func fire(course: Int) async {
        guard actionState.beginFiring(course: course) else { return }
        defer { actionState.finishFiring(course: course) }
        await onFire(course)
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
        openLines: [],
        coverCount: 2,
        onSend: { true },
        onFire: { _ in },
        onWeiterBestellen: {},
        onZurRechnung: {}
    )
}
#endif
