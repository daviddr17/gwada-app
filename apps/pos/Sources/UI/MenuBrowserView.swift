import SwiftUI

struct MenuBrowserView: View {
    let menu: PosCloudMenuCatalog
    var onSelect: (PosCloudMenuItem) -> Void

    @State private var search = ""
    @State private var categoryId: String?

    var body: some View {
        List(filteredItems) { item in
            Button {
                onSelect(item)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                        if !item.description.isEmpty {
                            Text(item.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        if !(item.recipe ?? []).isEmpty {
                            Text("Rezept · Ohne-Auswahl")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.teal)
                        }
                    }
                    Spacer()
                    Text(PosMoney.format(item.priceCents))
                        .font(.body.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.primary)
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.plain)
        .overlay {
            if filteredItems.isEmpty {
                ContentUnavailableView.search(text: search)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button {
                        categoryId = nil
                    } label: {
                        PosChip(title: "Alle", selected: categoryId == nil)
                    }
                    .buttonStyle(.plain)
                    ForEach(menu.categories) { cat in
                        Button {
                            categoryId = cat.id
                        } label: {
                            PosChip(title: cat.name, selected: categoryId == cat.id)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .background(.bar)
        }
        .searchable(text: $search, prompt: "Gericht suchen")
    }

    private var filteredItems: [PosCloudMenuItem] {
        menu.items.filter { item in
            guard item.active else { return false }
            if let categoryId, item.categoryId != categoryId { return false }
            let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
            if q.isEmpty { return true }
            return item.name.localizedCaseInsensitiveContains(q)
                || item.description.localizedCaseInsensitiveContains(q)
        }
    }
}
