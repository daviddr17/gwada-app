import SwiftUI

/// Tisch-Session: Warenkorb + Speisekarte + Split / Umziehen.
struct TableSessionView: View {
    @EnvironmentObject private var runtime: PosRuntime

    let table: PosLanFloorTable
    let sessionId: String?

    @State private var cart: [PosCartLine] = []
    @State private var showMenu = false
    @State private var configuring: PosCloudMenuItem?
    @State private var showSplit = false
    @State private var showMove = false
    @State private var sending = false
    @State private var openLines: [SessionOpenLine] = []

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            if cart.isEmpty && openLines.isEmpty {
                emptyState
            } else {
                cartList
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(table.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    showMove = true
                } label: {
                    Image(systemName: "arrow.left.arrow.right")
                }
                .disabled(openLines.isEmpty)
                Button {
                    showSplit = true
                } label: {
                    Image(systemName: "scissors")
                }
                .disabled(openLines.isEmpty)
            }
        }
        .safeAreaInset(edge: .bottom) {
            bottomBar
        }
        .sheet(isPresented: $showMenu) {
            if let menu = runtime.snapshot?.menu {
                NavigationStack {
                    MenuBrowserView(menu: menu) { item in
                        configuring = item
                    }
                    .navigationTitle("Speisekarte")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Fertig") { showMenu = false }
                        }
                    }
                }
                .presentationDetents([.large])
            }
        }
        .sheet(item: $configuring) { item in
            LineConfigureSheet(
                item: item,
                optionGroups: runtime.snapshot?.menu?.optionGroups ?? [],
                initialCourse: .main,
                onConfirm: { line in
                    cart.append(line)
                    configuring = nil
                    showMenu = false
                },
                onCancel: { configuring = nil }
            )
        }
        .sheet(isPresented: $showSplit) {
            SplitPayView(
                lines: openLines,
                onPay: { picked, method, tip in
                    showSplit = false
                    Task {
                        await runtime.collectSplit(
                            sessionId: ensureSessionId(),
                            lines: picked,
                            method: method,
                            tipCents: tip
                        )
                        await refreshOpenLines()
                    }
                },
                onCancel: { showSplit = false }
            )
        }
        .sheet(isPresented: $showMove) {
            MoveLinesView(
                lines: openLines,
                tables: runtime.snapshot?.floor.tables ?? [],
                openSessions: runtime.snapshot?.floor.openSessions ?? [],
                currentTableId: table.id,
                onMove: { ids, qtys, target in
                    showMove = false
                    Task {
                        await runtime.moveLines(
                            lineIds: ids,
                            quantities: qtys,
                            fromTableId: table.id,
                            toTableId: target
                        )
                        await refreshOpenLines()
                    }
                },
                onCancel: { showMove = false }
            )
        }
        .task {
            await refreshOpenLines()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(table.label).font(.title2.weight(.bold))
                Text(sessionId == nil ? "Frei · \(table.capacity) Plätze" : "Besetzt · \(table.capacity) Plätze")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(PosMoney.format(cartTotal + openTotal))
                .font(.title3.weight(.bold).monospacedDigit())
        }
        .padding(16)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "cart")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(.secondary)
            Text("Warenkorb leer")
                .font(.headline)
            Text("Gerichte hinzufügen — Gang, Ohne-Zutaten und Hinweise wählbar.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var cartList: some View {
        List {
            if !cart.isEmpty {
                Section("Warenkorb") {
                    ForEach(cart) { line in
                        cartRow(line)
                    }
                    .onDelete { idx in cart.remove(atOffsets: idx) }
                }
            }
            if !openLines.isEmpty {
                Section("Bereits gebucht") {
                    ForEach(openLines) { line in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(line.openQuantity)× \(line.name)")
                                    .font(.body.weight(.semibold))
                                if !line.detail.isEmpty {
                                    Text(line.detail)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text(PosMoney.format(line.openCents))
                                .font(.body.monospacedDigit())
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func cartRow(_ line: PosCartLine) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(line.course.shortLabel)
                .font(.caption.weight(.bold))
                .foregroundStyle(PosDesign.courseColor(line.course))
                .frame(width: 22, height: 22)
                .background(PosDesign.courseColor(line.course).opacity(0.15))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text("\(line.quantity)× \(line.name)")
                    .font(.body.weight(.semibold))
                Text(line.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(PosMoney.format(line.lineTotalCents))
                .font(.body.monospacedDigit())
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 10) {
            Button {
                showMenu = true
            } label: {
                Label("Gericht hinzufügen", systemImage: "plus")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)

            Button {
                Task { await sendCart() }
            } label: {
                if sending {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                } else {
                    Text(cart.isEmpty ? "Nichts zu senden" : "Bestellung senden · \(PosMoney.format(cartTotal))")
                }
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .disabled(cart.isEmpty || sending)
        }
        .padding(16)
        .background(.ultraThinMaterial)
    }

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }

    private func ensureSessionId() -> String {
        if let sessionId { return sessionId }
        return runtime.ensureLocalSession(tableId: table.id)
    }

    private func sendCart() async {
        sending = true
        defer { sending = false }
        let ok = await runtime.sendCart(tableId: table.id, lines: cart)
        if ok {
            cart.removeAll()
            await refreshOpenLines()
        }
    }

    private func refreshOpenLines() async {
        openLines = await runtime.loadOpenLines(tableId: table.id)
    }
}
