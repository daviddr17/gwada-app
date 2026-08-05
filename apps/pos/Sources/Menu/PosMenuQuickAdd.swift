import Foundation

/// Wann ein Menü-Tap die Configure-Sheet überspringt (sofort 1× in den Cart).
enum PosMenuQuickAdd {
    /// `true` = Quick-Add ohne Sheet. Rezept (Ohne …) und Side-Config öffnen immer das Sheet —
    /// auch wenn Beilagen nicht Pflicht sind.
    static func shouldQuickAdd(
        item: PosCloudMenuItem,
        optionGroups: [PosCloudMenuOptionGroup]
    ) -> Bool {
        let ids = Set(item.optionGroupIds)
        let relevantGroups = optionGroups.filter { ids.contains($0.id) && ($0.active != false) }
        let hasRequiredOptions = relevantGroups.contains { $0.minSelect > 0 }
        let hasSidesChooser = (item.sides?.max ?? 0) > 0
        let hasRecipeOmit = !(item.recipe ?? []).isEmpty
        return !hasRequiredOptions && !hasSidesChooser && !hasRecipeOmit
    }
}
