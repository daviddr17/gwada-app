import SwiftUI

struct MenuBrowserView: View {
    let menu: PosCloudMenuCatalog
    var onSelect: (PosCloudMenuItem) -> Void

    @State private var search = ""
    @State private var categoryId: String?

    var body: some View {
        VStack(spacing: 0) {
            SearchField(text: $search, placeholder: "Gericht suchen")
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

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
                .padding(.bottom, 8)
            }

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
        }
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

private struct SearchField: View {
    @Binding var text: String
    var placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
        }
        .padding(12)
        .background(Color(.tertiarySystemFill))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
