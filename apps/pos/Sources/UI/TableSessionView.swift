import SwiftUI

/// Tisch-Session: Warenkorb + Speisekarte + Split / Umziehen.
struct TableSessionView: View {
    @EnvironmentObject private var runtime: PosRuntime

    let table: PosLanFloorTable
    let sessionId: String?

    @State private var cart: [PosCartLine] = []
    @State private var configuring: PosCloudMenuItem?
    @State private var showSplit = false
    @State private var showMove = false
    @State private var showMoveSession = false
    @State private var sending = false
    @State private var openLines: [SessionOpenLine] = []
    @State private var sendPulse = false
    @State private var activeCourse = PosCourse.main

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            if let menu = runtime.snapshot?.menu {
                VStack(spacing: 0) {
                    Group {
                        if cart.isEmpty && openLines.isEmpty {
                            emptyState
                        } else {
                            cartList
                        }
                    }
                    .frame(maxHeight: 300)
                    Divider()
                    MenuBrowserView(
                        menu: menu,
                        onSelect: onSelectMenuItem,
                        quantityForItem: quantityForMenuItem
                    )
                }
            } else {
                cart.isEmpty && openLines.isEmpty ? AnyView(emptyState) : AnyView(cartList)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(table.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if sessionId != nil {
                    Button {
                        showMoveSession = true
                    } label: {
                        Image(systemName: "arrow.left.arrow.right.circle")
                    }
                    .accessibilityLabel("Tisch umziehen")
                }
                Button {
                    showMove = true
                } label: {
                    Image(systemName: "arrow.left.arrow.right")
                }
                .disabled(openLines.isEmpty)
                .accessibilityLabel("Positionen umziehen")
                Button {
                    showSplit = true
                } label: {
                    Image(systemName: "scissors")
                }
                .disabled(openLines.isEmpty)
                .accessibilityLabel("Rechnung splitten")
            }
        }
        .safeAreaInset(edge: .bottom) {
            bottomBar
        }
        .sensoryFeedback(.success, trigger: sendPulse)
        .sheet(item: $configuring) { item in
            LineConfigureSheet(
                item: item,
                menu: runtime.snapshot?.menu,
                optionGroups: runtime.snapshot?.menu?.optionGroups ?? [],
                initialCourse: activeCourse,
                onConfirm: { line in
                    cart.append(line)
                    configuring = nil
                },
                onCancel: { configuring = nil }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSplit) {
            SplitPayView(
                lines: openLines,
                onPay: { picked, method, tip, received, giftVoucherId, customPaymentMethodId in
                    showSplit = false
                    Task {
                        await runtime.collectSplit(
                            sessionId: ensureSessionId(),
                            lines: picked,
                            method: method,
                            tipCents: tip,
                            receivedAmountCents: received,
                            giftVoucherId: giftVoucherId,
                            customPaymentMethodId: customPaymentMethodId
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
        .sheet(isPresented: $showMoveSession) {
            if let sid = sessionId ?? openLines.first.map({ _ in ensureSessionId() }) {
                MoveSessionSheet(sessionId: sid, fromTableId: table.id)
                    .environmentObject(runtime)
            }
        }
        .task {
            await refreshOpenLines()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(table.label).font(.title2.weight(.bold))
                    HStack(spacing: 8) {
                        PosStatusBadge(
                            title: sessionId == nil ? "Frei" : "Besetzt",
                            emphasized: sessionId != nil
                        )
                        Text("\(table.capacity) Plätze")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text(PosMoney.format(cartTotal + openTotal))
                    .font(.title3.weight(.bold).monospacedDigit())
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PosCourse.uiCourses, id: \.self) { course in
                        Button {
                            activeCourse = course
                        } label: {
                            PosChip(
                                title: PosCourse.label(course),
                                selected: activeCourse == course,
                                tint: PosDesign.courseColor(course)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(16)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Warenkorb leer", systemImage: "cart")
        } description: {
            Text("Gerichte hinzufügen — Gang, Ohne-Zutaten und Hinweise wählbar.")
        } actions: {
            Text("Wähle ein Gericht unten in der Speisekarte.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button {
                                showSplit = true
                            } label: {
                                Label("Split", systemImage: "scissors")
                            }
                            .tint(.orange)
                            Button {
                                showMove = true
                            } label: {
                                Label("Umziehen", systemImage: "arrow.left.arrow.right")
                            }
                            .tint(.accentColor)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func cartRow(_ line: PosCartLine) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(PosCourse.shortLabel(line.course))
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
            if sessionId != nil || !openLines.isEmpty {
                HStack(spacing: 8) {
                    Button {
                        Task {
                            let sid = ensureSessionId()
                            _ = await runtime.fireCourse(sessionId: sid, course: activeCourse)
                        }
                    } label: {
                        Label("Fire", systemImage: "flame.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)

                    Button {
                        Task {
                            let sid = ensureSessionId()
                            let open = openTotal
                            if open <= 0 {
                                _ = await runtime.releaseTable(sessionId: sid, forceAbort: false)
                            } else if !PosHubState.shared.hasFired(sessionId: sid) {
                                _ = await runtime.releaseTable(sessionId: sid, forceAbort: true)
                            } else {
                                runtime.announce("Offener Betrag — erst kassieren, dann freigeben.")
                            }
                        }
                    } label: {
                        Label(
                            openTotal <= 0 ? "Freigeben" : "Abbruch",
                            systemImage: openTotal <= 0 ? "checkmark.circle" : "xmark.circle"
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                }
            }

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

    private func quantityForMenuItem(_ menuItemId: String) -> Int {
        cart
            .filter { $0.menuItemId == menuItemId }
            .reduce(0) { $0 + $1.quantity }
    }

    private func onSelectMenuItem(_ item: PosCloudMenuItem) {
        if shouldQuickAdd(item) {
            quickAdd(item)
            return
        }
        configuring = item
    }

    private func shouldQuickAdd(_ item: PosCloudMenuItem) -> Bool {
        let relevantGroups = optionGroupsForItem(item)
        let hasRequiredOptions = relevantGroups.contains { $0.minSelect > 0 }
        let requiresSides = item.sides?.required == true
        return !hasRequiredOptions && !requiresSides
    }

    private func optionGroupsForItem(_ item: PosCloudMenuItem) -> [PosCloudMenuOptionGroup] {
        let ids = Set(item.optionGroupIds)
        let groups = runtime.snapshot?.menu?.optionGroups ?? []
        return groups.filter { ids.contains($0.id) && ($0.active != false) }
    }

    private func quickAdd(_ item: PosCloudMenuItem) {
        if let idx = cart.firstIndex(where: {
            $0.menuItemId == item.id &&
                $0.course == activeCourse &&
                $0.modifiers.isEmpty &&
                $0.notes.isEmpty
        }) {
            cart[idx].quantity += 1
            return
        }
        cart.append(
            PosCartLine(
                menuItemId: item.id,
                name: item.name,
                unitPriceCents: item.priceCents,
                quantity: 1,
                course: activeCourse,
                notes: "",
                modifiers: []
            )
        )
    }

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
            sendPulse.toggle()
            await refreshOpenLines()
        }
    }

    private func refreshOpenLines() async {
        openLines = await runtime.loadOpenLines(tableId: table.id)
    }
}
