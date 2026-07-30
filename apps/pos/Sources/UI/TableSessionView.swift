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
    @State private var guestCount = 2

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            courseRow
            sentLinesHint
            if let menu = runtime.snapshot?.menu {
                MenuBrowserView(
                    menu: menu,
                    onSelect: onSelectMenuItem,
                    quantityForItem: quantityForMenuItem
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Spacer(minLength: 0)
            }
        }
        .background(PosDesign.bg)
        .navigationTitle(table.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
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
                coverCount: currentSession?.cover_count ?? guestCount,
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
            syncGuestCountFromSession()
        }
        .onChange(of: currentSession?.cover_count) { _, newValue in
            if let newValue { guestCount = newValue }
        }
        .preference(key: PosSessionBonActiveKey.self, value: true)
        .preference(key: PosSessionBonCartQtyKey.self, value: cartQuantity)
        .onAppear {
            bonOpener.open = { showBon = true }
            syncGuestCountFromSession()
        }
        .onDisappear { bonOpener.open = nil }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text(table.label)
                    .font(.title2.weight(.bold))
                HStack(spacing: 8) {
                    PosStatusBadge(
                        title: sessionId == nil ? "Frei" : "Besetzt",
                        emphasized: sessionId != nil
                    )
                    guestStepper
                }
            }
            Spacer()
            Text(PosMoney.format(cartTotal + openTotal))
                .font(.title3.weight(.bold).monospacedDigit())
        }
        .padding(16)
    }

    private var guestStepper: some View {
        HStack(spacing: 6) {
            Image(systemName: "person.2")
                .font(.caption)
            Button {
                adjustGuests(-1)
            } label: {
                Image(systemName: "minus.circle")
            }
            .disabled(guestCount <= 1)
            .accessibilityLabel("Gast entfernen")

            Text("\(guestCount)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .frame(minWidth: 18)

            Button {
                adjustGuests(1)
            } label: {
                Image(systemName: "plus.circle")
            }
            .disabled(guestCount >= 20)
            .accessibilityLabel("Gast hinzufügen")
        }
        .foregroundStyle(.secondary)
        .accessibilityIdentifier("pos.session.guests")
        .accessibilityLabel("\(guestCount) Gäste")
    }

    private var courseRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Neue Artikel auf")
                .font(.caption)
                .foregroundStyle(.secondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PosCourse.uiCourses, id: \.self) { course in
                        Button {
                            activeCourse = course
                        } label: {
                            PosChip(
                                title: PosCourse.chipLabel(course),
                                selected: activeCourse == course,
                                tint: PosDesign.courseColor(course)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("pos.course.\(course)")
                        .accessibilityLabel(PosCourse.chipLabel(course))
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private var sentLinesHint: some View {
        if openLines.isEmpty {
            Text("Noch nichts gesendet — neue Artikel landen im Bon.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
        } else {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle")
                    .font(.caption)
                Text("\(openLines.count) gesendet · \(PosMoney.format(openTotal))")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 6)
            .accessibilityLabel("\(openLines.count) Positionen gesendet")
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 8) {
            if sessionId != nil || !openLines.isEmpty {
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
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.bordered)
            }

            Button {
                showBon = true
            } label: {
                HStack(spacing: 8) {
                    Text(bonDockTitle)
                    Spacer(minLength: 8)
                    Text(PosMoney.format(cartTotal + openTotal))
                        .font(.headline.monospacedDigit())
                }
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .accessibilityIdentifier("pos.bon.open")
        }
        .padding(16)
        .background(.ultraThinMaterial)
    }

    private var bonDockTitle: String {
        var parts = ["Bon öffnen"]
        if cartQuantity > 0 {
            parts.append("\(cartQuantity) neu")
        }
        return parts.joined(separator: " · ")
    }

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }
    private var cartQuantity: Int { cart.reduce(0) { $0 + $1.quantity } }
    private var currentSession: PosLanOpenSession? {
        runtime.snapshot?.floor.openSessions.first(where: { $0.dining_table_id == table.id })
    }

    private func syncGuestCountFromSession() {
        if let covers = currentSession?.cover_count {
            guestCount = covers
        }
    }

    private func adjustGuests(_ delta: Int) {
        let newCount = min(20, max(1, guestCount + delta))
        guard newCount != guestCount else { return }
        guestCount = newCount
        Task {
            let sid = ensureSessionId()
            await runtime.updateCovers(sessionId: sid, covers: newCount)
        }
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
        return runtime.ensureLocalSession(tableId: table.id, covers: guestCount)
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
