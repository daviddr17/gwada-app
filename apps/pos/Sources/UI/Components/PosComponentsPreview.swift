import SwiftUI

#if DEBUG
#Preview("POS Components") {
    ScrollView {
        VStack(alignment: .leading, spacing: PosLayout.section) {
            Text("Buttons").font(.headline)
            PosButton(title: "Primär Aktion", kind: .primary) {}
            PosButton(title: "Sekundär Aktion", kind: .secondary) {}
            HStack(spacing: PosLayout.dockGap) {
                PosAmountButton(title: "Auswahl", amountCents: 1250, kind: .secondary) {}
                PosAmountButton(title: "Rest / Alles", amountCents: 5130, kind: .primary) {}
            }

            Text("Chips").font(.headline)
            PosChipScroller {
                PosChip(title: "Alle", selected: true)
                PosChip(title: "Vorspeisen")
                PosChip(title: "Hauptgerichte")
            }

            Text("Stepper").font(.headline)
            PosStepperControl(value: 2, range: 1 ... 12) { _ in }

            Text("Row").font(.headline)
            PosCardRow {
                Text("1× Wiener Schnitzel")
                    .foregroundStyle(PosDesign.ink)
            }

            Text("Panel").font(.headline)
            PosPanelCard {
                Text("Bon-Inhalt ohne Quittungs-Papier")
                    .foregroundStyle(PosDesign.ink)
                Text("Nur echte Belege nutzen PaperReceiptView.")
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
            }
        }
        .padding(PosLayout.page)
    }
    .background(PosDesign.bg)
}
#endif
