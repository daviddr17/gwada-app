import SwiftUI

/// Tisch-Session: Warenkorb + Speisekarte + Split / Umziehen.
struct TableSessionView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @EnvironmentObject private var bonOpener: PosSessionBonOpener

    let table: PosLanFloorTable
    let sessionId: String?

    @State private var cart: [PosCartLine] = []
    @State private var configuring: PosCloudMenuItem?
    @State private var showSplit = false
    @State private var showMove = false
    @State private var showMoveSession = false
    @State private var showBon = false
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
                        if openLines.isEmpty {
                            emptyState
                        } else {
                            openLinesList
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
                openLines.isEmpty ? AnyView(emptyState) : AnyView(openLinesList)
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
                    cart = PosCart.merging(cart, adding: line)
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
        .sheet(isPresented: $showBon) {
            BonSheetView(
                tableLabel: table.label,
                sessionId: ensureSessionId(),
                cart: $cart,
                openLines: openLines,
                coverCount: currentSession?.cover_count,
                onSend: {
                    await sendCart()
                },
                onFire: { course in
                    _ = await runtime.fireCourse(sessionId: ensureSessionId(), course: course)
                    await refreshOpenLines()
                },
                onWeiterBestellen: {
                    showBon = false
                },
                onZurRechnung: {
                    showBon = false
                    showSplit = true
                }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
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
        .preference(key: PosSessionBonActiveKey.self, value: true)
        .preference(key: PosSessionBonCartQtyKey.self, value: cartQuantity)
        .onAppear { bonOpener.open = { showBon = true } }
        .onDisappear { bonOpener.open = nil }
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
                        .accessibilityIdentifier("pos.course.\(course)")
                        .accessibilityLabel(PosCourse.label(course))
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(16)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Noch nichts gesendet", systemImage: "cart")
        } description: {
            Text("Noch keine Positionen an Küche oder Bar gesendet.")
        } actions: {
            Text("Wähle ein Gericht in der Speisekarte. Ungesendete Positionen findest du im Bon.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var openLinesList: some View {
        List {
            Section("Bereits gesendet") {
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
        .listStyle(.insetGrouped)
    }

    private var bottomBar: some View {
        VStack(spacing: 10) {
            if sessionId != nil || !openLines.isEmpty {
                HStack(spacing: 8) {
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
                showBon = true
            } label: {
                HStack(spacing: 8) {
                    Text("Bon")
                    if cartQuantity > 0 {
                        Text("\(cartQuantity)")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.accentColor.opacity(0.25), in: Capsule())
                    }
                }
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .accessibilityIdentifier("pos.bon.open")
        }
        .padding(16)
        .background(.ultraThinMaterial)
    }

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }
    private var cartQuantity: Int { cart.reduce(0) { $0 + $1.quantity } }
    private var currentSession: PosLanOpenSession? {
        runtime.snapshot?.floor.openSessions.first(where: { $0.dining_table_id == table.id })
    }

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
        cart = PosCart.merging(
            cart,
            adding: PosCartLine(
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

    private func sendCart() async -> Bool {
        let ok = await runtime.sendCart(tableId: table.id, lines: cart)
        if ok {
            cart.removeAll()
            sendPulse.toggle()
            await refreshOpenLines()
        }
        return ok
    }

    private func refreshOpenLines() async {
        openLines = await runtime.loadOpenLines(tableId: table.id)
    }
}
