import SwiftUI

/// Touch-Ziffernblock für Beträge (Trinkgeld / gegeben) in Cent.
struct PosCashKeypad: View {
    @Binding var cents: Int
    var maxCents: Int = 9_999_99

    var body: some View {
        let keys: [[String]] = [
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["C", "0", "⌫"],
        ]
        VStack(spacing: 8) {
            ForEach(keys, id: \.self) { row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.self) { key in
                        Button {
                            tap(key)
                        } label: {
                            Text(key == "⌫" ? "⌫" : key)
                                .font(.title2.weight(.semibold).monospacedDigit())
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func tap(_ key: String) {
        switch key {
        case "C":
            cents = 0
        case "⌫":
            cents /= 10
        default:
            guard let digit = Int(key) else { return }
            let next = cents * 10 + digit
            if next <= maxCents { cents = next }
        }
    }
}
