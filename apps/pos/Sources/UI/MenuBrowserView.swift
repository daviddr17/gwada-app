import SwiftUI

struct MenuBrowserView: View {
    let menu: PosCloudMenuCatalog
    var onSelect: (PosCloudMenuItem) -> Void
    var quantityForItem: (String) -> Int = { _ in 0 }

    @State private var search = ""
    @State private var categoryId: String?

    var body: some View {
        VStack(spacing: 0) {
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
                .padding(.vertical, 12)
            }
            .background(PosDesign.bg)

            ScrollView {
                if filteredItems.isEmpty {
                    ContentUnavailableView.search(text: search)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.top, 32)
                } else {
                    LazyVGrid(
                        columns: [
                            GridItem(.flexible(minimum: 150), spacing: 10),
                            GridItem(.flexible(minimum: 150), spacing: 10),
                        ],
                        spacing: 10
                    ) {
                        ForEach(filteredItems) { item in
                            let qty = quantityForItem(item.id)
                            Button {
                                onSelect(item)
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack(alignment: .top, spacing: 6) {
                                        Text(item.name)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(PosDesign.ink)
                                            .lineLimit(2)
                                        Spacer(minLength: 0)
                                        if qty > 0 {
                                            Text("\(qty)")
                                                .font(.caption2.weight(.bold))
                                                .foregroundStyle(PosDesign.accentForeground)
                                                .padding(.horizontal, 7)
                                                .padding(.vertical, 4)
                                                .background(Capsule().fill(PosDesign.brandAccent))
                                        }
                                    }

                                    if !item.description.isEmpty {
                                        Text(item.description)
                                            .font(.caption)
                                            .foregroundStyle(PosDesign.muted)
                                            .lineLimit(2)
                                    }

                                    if !(item.recipe ?? []).isEmpty {
                                        Text("Rezept · Ohne-Auswahl")
                                            .font(.caption2.weight(.medium))
                                            .foregroundStyle(PosDesign.muted)
                                    }

                                    Spacer(minLength: 0)

                                    Text(PosMoney.format(item.priceCents))
                                        .font(.subheadline.weight(.semibold).monospacedDigit())
                                        .foregroundStyle(PosDesign.ink)
                                }
                                .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(PosDesign.surface)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(PosDesign.line, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                }
            }
            .background(PosDesign.bg)
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
