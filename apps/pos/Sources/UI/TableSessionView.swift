import SwiftUI

/// Tisch-Session: Warenkorb + Speisekarte + Split / Umziehen.
struct TableSessionView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @EnvironmentObject private var bonOpener: PosSessionBonOpener

    let table: PosLanFloorTable
    let sessionId: String?

    @State private var cart: [PosCartLine] = []
    @State private var configuring: PosCloudMenuItem?
    @State private var showKassieren = false
    @State private var showMove = false
    @State private var showMoveSession = false
    @State private var showBon = false
    @State private var pendingKassierenAfterBon = false
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
        .posHideTabBarWhenImmersive()
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if !resolvedSessionId.isEmpty, !resolvedSessionId.hasPrefix("pending-") {
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
                    showKassieren = true
                } label: {
                    Image(systemName: "scissors")
                }
                .disabled(openLines.isEmpty || !runtime.canCollectAtRegister)
                .accessibilityLabel("Rechnung kassieren")
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
        .fullScreenCover(isPresented: $showKassieren) {
            KassierenView(
                tableLabel: table.label,
                sessionId: ensureSessionId(),
                lines: $openLines,
                onPaid: {
                    await refreshOpenLines()
                },
                onRelease: {
                    let sid = ensureSessionId()
                    _ = await runtime.releaseTable(sessionId: sid, forceAbort: false)
                    showKassieren = false
                },
                onClose: { showKassieren = false }
            )
            .environmentObject(runtime)
            .modifier(PosSheetLiquidGlassBackground())
        }
        .sheet(isPresented: $showBon) {
            BonSheetView(
                tableLabel: table.label,
                sessionId: resolvedSessionId,
                cart: $cart,
                openLines: $openLines,
                coverCount: currentSession?.cover_count ?? guestCount,
                onSchicken: { course in
                    await schickenCourse(course)
                },
                onWeiterBestellen: {
                    showBon = false
                },
                onZurRechnung: {
                    pendingKassierenAfterBon = true
                    showBon = false
                }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .modifier(PosSheetLiquidGlassBackground())
        }
        .onChange(of: showBon) { _, isPresented in
            guard !isPresented, pendingKassierenAfterBon else { return }
            pendingKassierenAfterBon = false
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(250))
                showKassieren = true
            }
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
            if let sid = sessionId ?? currentSession?.id {
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
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    PosStatusBadge(
                        title: resolvedSessionId.isEmpty || resolvedSessionId.hasPrefix("pending-")
                            ? "Frei"
                            : "Besetzt",
                        emphasized: !(resolvedSessionId.isEmpty || resolvedSessionId.hasPrefix("pending-"))
                    )
                    guestStepper
                }
            }
            Spacer(minLength: 8)
            Text(PosMoney.format(cartTotal + openTotal))
                .font(.title2.weight(.bold).monospacedDigit())
                .accessibilityLabel("Summe \(PosMoney.format(cartTotal + openTotal))")
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
    }

    private var guestStepper: some View {
        HStack(spacing: 6) {
            Image(systemName: "person.2")
                .font(.subheadline)
                .foregroundStyle(PosDesign.muted)
            Button {
                adjustGuests(-1)
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.title2)
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(guestCount <= 1)
            .accessibilityLabel("Gast entfernen")

            Text("\(guestCount)")
                .font(.body.weight(.semibold).monospacedDigit())
                .frame(minWidth: 24)

            Button {
                adjustGuests(1)
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(guestCount >= 20)
            .accessibilityLabel("Gast hinzufügen")
        }
        .foregroundStyle(PosDesign.muted)
        .accessibilityIdentifier("pos.session.guests")
        .accessibilityLabel("\(guestCount) Gäste")
    }

    private var courseRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Neue Artikel auf")
                .font(.subheadline)
                .foregroundStyle(PosDesign.muted)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
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
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private var sentLinesHint: some View {
        if openLines.isEmpty && cart.isEmpty {
            Text("Artikel antippen — der Bon sammelt die Bestellung.")
                .font(.caption)
                .foregroundStyle(PosDesign.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
        } else if !openLines.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "doc.text")
                    .font(.caption)
                Text("\(openLines.count) auf dem Bon · \(PosMoney.format(openTotal)) — unten öffnen")
                    .font(.caption.weight(.semibold))
                Spacer(minLength: 0)
            }
            .foregroundStyle(PosDesign.muted)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PosDesign.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(PosDesign.line, lineWidth: 1)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
            .accessibilityIdentifier("pos.session.openBonHint")
            .accessibilityLabel("Bon mit \(openLines.count) Positionen — unten öffnen")
        } else if cartQuantity > 0 {
            Text("\(cartQuantity) neu im Bon — unten öffnen zum Schicken.")
                .font(.subheadline)
                .foregroundStyle(PosDesign.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
        }
    }

    private var bottomBar: some View {
        PosThumbDock {
            if !resolvedSessionId.isEmpty,
               !resolvedSessionId.hasPrefix("pending-"),
               openLines.isEmpty,
               cart.isEmpty
            {
                PosButton(title: "Freigeben", kind: .secondary) {
                    Task {
                        _ = await runtime.releaseTable(sessionId: resolvedSessionId, forceAbort: false)
                    }
                }
                .disabled(!runtime.canMutateLiveFloor)
            }

            Button {
                showBon = true
            } label: {
                HStack(spacing: 8) {
                    Text(bonDockTitle)
                        .font(.headline.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                    Spacer(minLength: 8)
                    Text(PosMoney.format(cartTotal + openTotal))
                        .font(.headline.monospacedDigit())
                        .lineLimit(1)
                }
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .accessibilityIdentifier("pos.bon.open")
        }
        .posLiquidGlassBar()
    }

    private var bonDockTitle: String {
        if cartQuantity > 0 {
            return "Bon öffnen · \(cartQuantity) neu"
        }
        if !openLines.isEmpty {
            return "Bon öffnen · \(openLines.count) Pos."
        }
        return "Bon öffnen"
    }

    private var cartTotal: Int { cart.reduce(0) { $0 + $1.lineTotalCents } }
    private var openTotal: Int { openLines.reduce(0) { $0 + $1.openCents } }
    private var cartQuantity: Int { cart.reduce(0) { $0 + $1.quantity } }
    private var currentSession: PosLanOpenSession? {
        runtime.snapshot?.floor.openSessions.first(where: { $0.dining_table_id == table.id })
    }

    /// Hub-Session-ID wenn vorhanden — keine lokale Ghost-ID am gekoppelten Handgerät.
    private var resolvedSessionId: String {
        if let sessionId { return sessionId }
        if let existing = currentSession?.id { return existing }
        return ""
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
        // Do not open a session just to change guest count on a free table.
        guard let sid = sessionId ?? currentSession?.id else { return }
        Task {
            await runtime.updateCovers(sessionId: sid, covers: newCount)
        }
    }

    private func quantityForMenuItem(_ menuItemId: String) -> Int {
        let inCart = cart
            .filter { $0.menuItemId == menuItemId }
            .reduce(0) { $0 + $1.quantity }
        let inOpen = openLines
            .filter { $0.menuItemId == menuItemId }
            .reduce(0) { $0 + $1.openQuantity }
        return inCart + inOpen
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
        if let sid = sessionId ?? currentSession?.id { return sid }
        return runtime.ensureLocalSession(tableId: table.id, covers: guestCount)
    }

    /// Prototype CartSheet: „Gang N schicken“ = send course cart lines + kitchen fire.
    @discardableResult
    private func schickenCourse(_ course: Int) async -> Bool {
        let courseCart = cart.filter { $0.course == course }
        if !courseCart.isEmpty {
            let ok = await runtime.sendCart(tableId: table.id, lines: courseCart)
            guard ok else { return false }
            cart.removeAll { $0.course == course }
            sendPulse.toggle()
            await refreshOpenLines()
        }
        // Session erst nach sendCart vom Hub — vorher kein ensureLocalSession (Ghost-ID).
        guard let sid = currentSession?.id ?? sessionId, !sid.hasPrefix("pending-") else {
            return !courseCart.isEmpty
        }
        _ = await runtime.fireCourse(sessionId: sid, course: course)
        await refreshOpenLines()
        return true
    }

    private func refreshOpenLines() async {
        openLines = await runtime.loadOpenLines(tableId: table.id)
    }
}
