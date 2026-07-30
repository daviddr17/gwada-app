import SwiftUI

struct BonSheetView: View {
    let tableLabel: String
    @Binding var cart: [PosCartLine]
    let openLines: [SessionOpenLine]
    let coverCount: Int?
    var onSend: () async -> Bool
    var onFire: (Int) async -> Void
    var onWeiterBestellen: () -> Void
    var onZurRechnung: () -> Void

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

            if sentLines.contains(where: { !$0.isFired }) {
                Button("\(PosCourse.label(course)) schicken") {
                    Task { await onFire(course) }
                }
                .buttonStyle(.bordered)
                .tint(PosDesign.courseColor(course))
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
                Task { _ = await onSend() }
            } label: {
                Text("Senden · \(PosMoney.format(cartTotal))")
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .disabled(cart.isEmpty)

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
