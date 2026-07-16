import SwiftUI

/// Konfiguration einer Position: Gang, Optionen, Ohne-Zutaten, Freitext.
struct LineConfigureSheet: View {
    let item: PosCloudMenuItem
    let optionGroups: [PosCloudMenuOptionGroup]
    var initialCourse: PosCourse = .main
    var onConfirm: (PosCartLine) -> Void
    var onCancel: () -> Void

    @State private var quantity = 1
    @State private var course: PosCourse = .main
    @State private var notes = ""
    @State private var selectedOhne: Set<String> = []
    @State private var selectedChoices: Set<String> = []
    @State private var confirmPulse = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.name).font(.title3.weight(.semibold))
                            Text(PosMoney.format(item.priceCents))
                                .foregroundStyle(.secondary)
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
                            ForEach(PosCourse.allCases) { c in
                                Button {
                                    course = c
                                } label: {
                                    PosChip(title: c.label, selected: course == c, tint: PosDesign.courseColor(c))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                if !relevantOptionGroups.isEmpty {
                    Section("Optionen") {
                        ForEach(relevantOptionGroups) { group in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(group.name)
                                    .font(.subheadline.weight(.semibold))
                                ForEach(group.choices.filter { $0.active != false }) { choice in
                                    let delta = Int((choice.priceDelta * 100).rounded())
                                    Toggle(isOn: Binding(
                                        get: { selectedChoices.contains(choice.id) },
                                        set: { on in
                                            if on { selectedChoices.insert(choice.id) }
                                            else { selectedChoices.remove(choice.id) }
                                        }
                                    )) {
                                        HStack {
                                            Text(choice.name)
                                            Spacer()
                                            if delta > 0 {
                                                Text("+\(PosMoney.format(delta))")
                                                    .foregroundStyle(.secondary)
                                                    .font(.footnote.monospacedDigit())
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if !(item.recipe ?? []).isEmpty {
                    Section("Ohne …") {
                        Text("Zutaten abwählen — wird als „ohne …“ gebucht.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
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
                }
            }
            .navigationTitle("Position")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("In Warenkorb") { confirm() }
                        .fontWeight(.semibold)
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

    private func confirm() {
        var mods: [PosCartModifier] = []
        for group in relevantOptionGroups {
            for choice in group.choices where selectedChoices.contains(choice.id) {
                let delta = Int((choice.priceDelta * 100).rounded())
                mods.append(.option(choiceId: choice.id, name: choice.name, priceDeltaCents: delta))
            }
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
