import SwiftUI

// MARK: - Session Bon preferences (Equatable only — no closures)

struct PosSessionBonActiveKey: PreferenceKey {
    static var defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

struct PosSessionBonCartQtyKey: PreferenceKey {
    static var defaultValue = 0
    static func reduce(value: inout Int, nextValue: () -> Int) {
        value = max(value, nextValue())
    }
}

// MARK: - Opener (closure holder — not in preferences)

@MainActor
final class PosSessionBonOpener: ObservableObject {
    var open: (() -> Void)?
    func trigger() { open?() }
}

// MARK: - iOS 26 tab accessory button

struct PosBonTabAccessoryButton: View {
    let cartQuantity: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                HStack(spacing: 6) {
                    Text("Bon")
                    if cartQuantity > 0 {
                        Text("\(cartQuantity)")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.accentColor))
                            .foregroundStyle(.white)
                    }
                }
            } icon: {
                Image(systemName: "doc.text")
            }
        }
        .accessibilityIdentifier("pos.bon.tabAccessory")
    }
}

// MARK: - TabView bottom accessory (iOS 26+)

struct PosBonTabAccessoryModifier: ViewModifier {
    let isActive: Bool
    let cartQuantity: Int
    @ObservedObject var opener: PosSessionBonOpener

    func body(content: Content) -> some View {
        // iOS 26: `tabViewBottomAccessory` mit leerem Inhalt rendert trotzdem eine leere Pill.
        if #available(iOS 26, *), isActive {
            content.tabViewBottomAccessory {
                PosBonTabAccessoryButton(cartQuantity: cartQuantity) {
                    opener.trigger()
                }
            }
        } else {
            content
        }
    }
}
