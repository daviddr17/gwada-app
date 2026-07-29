import Foundation

enum PosMenuSidePool {
    static let sideCategoryName = "Beilagen"

    static func sideItems(from catalog: PosCloudMenuCatalog) -> [PosCloudMenuItem] {
        let ids = Set(
            catalog.categories
                .filter { $0.name.compare(sideCategoryName, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame }
                .map(\.id)
        )
        return catalog.items.filter { ids.contains($0.categoryId) && $0.active }
    }
}

extension PosCloudMenuOptionGroup {
    func isSelectionCountValid(_ count: Int) -> Bool {
        if count < minSelect { return false }
        if let maxSelect, count > maxSelect { return false }
        return true
    }

    var effectiveMaxSelect: Int? { maxSelect }
}
