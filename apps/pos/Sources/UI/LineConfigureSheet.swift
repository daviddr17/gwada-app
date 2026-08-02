import SwiftUI

/// Konfiguration einer Position: Gang, Optionen, Ohne-Zutaten, Freitext.
struct LineConfigureSheet: View {
    let item: PosCloudMenuItem
    var menu: PosCloudMenuCatalog? = nil
    let optionGroups: [PosCloudMenuOptionGroup]
    var initialCourse: Int = PosCourse.main
    var onConfirm: (PosCartLine) -> Void
    var onCancel: () -> Void

    @State private var quantity = 1
    @State private var course = PosCourse.main
    @State private var notes = ""
    @State private var selectedOhne: Set<String> = []
    @State private var selectedChoices: Set<String> = []
    @State private var selectedSideIds: Set<String> = []
    @State private var confirmPulse = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.name).font(.title3.weight(.semibold))
                            Text(PosMoney.format(liveLineTotalCents))
                                .foregroundStyle(PosDesign.muted)
                        }
                        Spacer()
                        Stepper("\(quantity)", value: $quantity, in: 1 ... 99)
                            .labelsHidden()
                        Text("\(quantity)×")
                            .font(.headline.monospacedDigit())
                            .frame(minWidth: 36, alignment: .trailing)
                    }
                }

                Section("Gang") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(PosCourse.uiCourses, id: \.self) { c in
                                Button {
                                    course = c
                                } label: {
                                    PosChip(title: PosCourse.label(c), selected: course == c, tint: PosDesign.courseColor(c))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                if !relevantOptionGroups.isEmpty {
                    Section("Optionen") {
                        ForEach(Array(relevantOptionGroups), id: \.id) { group in
                            let activeChoices = activeChoices(for: group)
                            VStack(alignment: .leading, spacing: 8) {
                                Text(group.name)
                                    .font(.subheadline.weight(.semibold))
                                ForEach(activeChoices, id: \.id) { choice in
                                    optionChoiceToggle(group: group, choice: choice)
                                }
                                let selected = selectedCount(in: group)
                                let ruleText = optionRuleText(for: group, selected: selected)
                                let valid = group.isSelectionCountValid(selected)
                                Text(ruleText)
                                    .font(.caption2)
                                    .foregroundStyle(valid ? Color.secondary : Color.red)
                            }
                        }
                    }
                }

                if !sideCandidates.isEmpty, let sideConfig = item.sides {
                    Section("Beilagen") {
                        Text(sideRuleText(config: sideConfig))
                            .font(.footnote)
                            .foregroundStyle(PosDesign.muted)
                        ForEach(sideCandidates) { side in
                            sideToggle(side: side, max: sideConfig.max)
                        }
                        Text("Ausgewählt: \(selectedSideIds.count)")
                            .font(.caption2)
                            .foregroundStyle(sideSelectionValid ? Color.secondary : Color.red)
                    }
                }

                if !(item.recipe ?? []).isEmpty {
                    Section("Ohne …") {
                        Text("Zutaten abwählen — wird als „ohne …“ gebucht.")
                            .font(.footnote)
                            .foregroundStyle(PosDesign.muted)
                        ForEach(item.recipe ?? []) { ing in
                            Toggle(isOn: Binding(
                                get: { selectedOhne.contains(ing.ingredientId) },
                                set: { on in
                                    if on { selectedOhne.insert(ing.ingredientId) }
                                    else { selectedOhne.remove(ing.ingredientId) }
                                }
                            )) {
                                Text("ohne \(ing.name)")
                            }
                        }
                    }
                }

                Section("Hinweis") {
                    TextField("z. B. extra scharf, Allergie …", text: $notes, axis: .vertical)
                        .lineLimit(2 ... 4)
                        .onChange(of: notes) { _, value in
                            if value.count > 80 {
                                notes = String(value.prefix(80))
                            }
                        }
                    Text("\(notes.count)/80")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(notes.count >= 80 ? .orange : .secondary)
                }
            }
            .navigationTitle("Position")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Hinzufügen · \(PosMoney.format(liveLineTotalCents))") { confirm() }
                        .fontWeight(.semibold)
                        .disabled(!canConfirm)
                }
            }
            .onAppear { course = initialCourse }
            .sensoryFeedback(.success, trigger: confirmPulse)
        }
    }

    private var relevantOptionGroups: [PosCloudMenuOptionGroup] {
        let ids = Set(item.optionGroupIds)
        return optionGroups.filter { ids.contains($0.id) && ($0.active != false) }
    }

    private var sideCandidates: [PosCloudMenuItem] {
        guard let menu else { return [] }
        return PosMenuSidePool.sideItems(from: menu)
    }

    private var sideSelectionValid: Bool {
        guard let config = item.sides else { return true }
        if config.required, selectedSideIds.isEmpty { return false }
        return selectedSideIds.count <= max(0, config.max)
    }

    private var canConfirm: Bool {
        let optionsValid = relevantOptionGroups.allSatisfy { group in
            group.isSelectionCountValid(selectedCount(in: group))
        }
        return optionsValid && sideSelectionValid
    }

    private var liveLineTotalCents: Int {
        (item.priceCents + selectedOptionDeltaCents + selectedSideDeltaCents) * quantity
    }

    private var selectedOptionDeltaCents: Int {
        relevantOptionGroups.reduce(0) { sum, group in
            sum + group.choices.reduce(0) { local, choice in
                guard selectedChoices.contains(choice.id) else { return local }
                return local + Int((choice.priceDelta * 100).rounded())
            }
        }
    }

    private var selectedSideDeltaCents: Int {
        guard let config = item.sides else { return 0 }
        let prices = sideCandidates
            .filter { selectedSideIds.contains($0.id) }
            .map { $0.sidePriceCents ?? $0.priceCents }
            .sorted()
        let freeCount = min(config.includedCount, prices.count)
        return prices.dropFirst(freeCount).reduce(0, +)
    }

    private func selectedCount(in group: PosCloudMenuOptionGroup) -> Int {
        let ids = Set(group.choices.map(\.id))
        return selectedChoices.filter { ids.contains($0) }.count
    }

    private func activeChoices(for group: PosCloudMenuOptionGroup) -> [PosCloudMenuChoice] {
        group.choices.filter { $0.active != false }
    }

    private func optionRuleText(for group: PosCloudMenuOptionGroup, selected: Int) -> String {
        if let max = group.effectiveMaxSelect {
            return "\(selected) gewählt · min \(group.minSelect), max \(max)"
        }
        return "\(selected) gewählt · min \(group.minSelect)"
    }

    private func sideRuleText(config: PosCloudMenuItemSideConfig) -> String {
        let requiredText = config.required ? "Pflicht" : "Optional"
        return "\(requiredText) · max \(config.max) · inkl. \(config.includedCount)"
    }

    @ViewBuilder
    private func optionChoiceToggle(group: PosCloudMenuOptionGroup, choice: PosCloudMenuChoice) -> some View {
        let delta = Int((choice.priceDelta * 100).rounded())
        Toggle(
            isOn: Binding(
                get: { selectedChoices.contains(choice.id) },
                set: { on in
                    toggleChoice(group: group, choiceId: choice.id, enabled: on)
                }
            )
        ) {
            HStack {
                Text(choice.name)
                Spacer()
                if delta > 0 {
                    Text("+\(PosMoney.format(delta))")
                        .foregroundStyle(PosDesign.muted)
                        .font(.footnote.monospacedDigit())
                }
            }
        }
    }

    @ViewBuilder
    private func sideToggle(side: PosCloudMenuItem, max: Int) -> some View {
        let sidePrice = side.sidePriceCents ?? side.priceCents
        Toggle(
            isOn: Binding(
                get: { selectedSideIds.contains(side.id) },
                set: { on in
                    toggleSide(sideId: side.id, enabled: on, max: max)
                }
            )
        ) {
            HStack {
                Text(side.name)
                Spacer()
                Text("+\(PosMoney.format(sidePrice))")
                    .foregroundStyle(PosDesign.muted)
                    .font(.footnote.monospacedDigit())
            }
        }
    }

    private func toggleChoice(group: PosCloudMenuOptionGroup, choiceId: String, enabled: Bool) {
        let groupChoiceIds = Set(group.choices.map(\.id))
        if enabled {
            let selected = selectedChoices.filter { groupChoiceIds.contains($0) }
            if let max = group.effectiveMaxSelect, selected.count >= max { return }
            selectedChoices.insert(choiceId)
        } else {
            selectedChoices.remove(choiceId)
        }
    }

    private func toggleSide(sideId: String, enabled: Bool, max: Int) {
        if enabled {
            if selectedSideIds.count >= max { return }
            selectedSideIds.insert(sideId)
        } else {
            selectedSideIds.remove(sideId)
        }
    }

    private func confirm() {
        guard canConfirm else { return }
        var mods: [PosCartModifier] = []
        for group in relevantOptionGroups {
            for choice in group.choices where selectedChoices.contains(choice.id) {
                let delta = Int((choice.priceDelta * 100).rounded())
                mods.append(.option(choiceId: choice.id, name: choice.name, priceDeltaCents: delta))
            }
        }
        let freeSideIds: Set<String> = {
            guard let config = item.sides, config.includedCount > 0 else { return [] }
            let priced = sideCandidates
                .filter { selectedSideIds.contains($0.id) }
                .map { ($0.id, $0.sidePriceCents ?? $0.priceCents) }
                .sorted { $0.1 < $1.1 }
            return Set(priced.prefix(config.includedCount).map(\.0))
        }()
        for side in sideCandidates where selectedSideIds.contains(side.id) {
            let baseSidePrice = side.sidePriceCents ?? side.priceCents
            let sidePrice = freeSideIds.contains(side.id) ? 0 : baseSidePrice
            mods.append(
                PosCartModifier(
                    id: "side-\(side.id)",
                    type: "side",
                    label: "Beilage: \(side.name)",
                    ingredientId: nil,
                    optionChoiceId: side.id,
                    priceDeltaCents: sidePrice
                )
            )
        }
        for ing in item.recipe ?? [] where selectedOhne.contains(ing.ingredientId) {
            mods.append(.ohne(ingredientId: ing.ingredientId, name: ing.name))
        }
        let line = PosCartLine(
            menuItemId: item.id,
            name: item.name,
            unitPriceCents: item.priceCents,
            quantity: quantity,
            course: course,
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
            modifiers: mods
        )
        confirmPulse.toggle()
        onConfirm(line)
    }
}
