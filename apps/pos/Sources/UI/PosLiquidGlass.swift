import SwiftUI

// MARK: - Liquid Glass (iOS 26+) with material fallback
// Produkt: native TabView-Glass (E13) — nicht nachbauen; Bars nutzen System-Glass.

extension View {
    /// Bottom-/Action-Bars: iOS 26 `glassEffect`, sonst `ultraThinMaterial`.
    func posLiquidGlassBar(cornerRadius: CGFloat = 0) -> some View {
        modifier(PosLiquidGlassBarModifier(cornerRadius: cornerRadius))
    }

    /// Kellner-`TabView`: Minimize-on-scroll (Liquid Glass Standard).
    func posKellnerTabLiquidGlass() -> some View {
        modifier(PosKellnerTabLiquidGlassModifier())
    }

    /// In Tisch-Session / immersiven Flows Tab-Bar ausblenden (Order/Split).
    func posHideTabBarWhenImmersive() -> some View {
        modifier(PosHideTabBarModifier())
    }

}

// MARK: - Bar background

private struct PosLiquidGlassBarModifier: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            if cornerRadius > 0 {
                content.glassEffect(
                    in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                )
            } else {
                content.glassEffect()
            }
        } else {
            content.background(.ultraThinMaterial)
        }
    }
}

// MARK: - TabView chrome

private struct PosKellnerTabLiquidGlassModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}

// MARK: - Hide tab bar in session

private struct PosHideTabBarModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.toolbar(.hidden, for: .tabBar)
    }
}

// MARK: - Bon accessory: Glass capsule (iOS 26)

struct PosBonTabAccessoryGlassChrome: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .padding(.horizontal, 4)
                .glassEffect(in: Capsule())
        } else {
            content
        }
    }
}

/// Sheet-Hintergrund mit Material (Liquid-Glass-Nähe auf allen iOS-Versionen).
struct PosSheetLiquidGlassBackground: ViewModifier {
    func body(content: Content) -> some View {
        content.presentationBackground(.ultraThinMaterial)
    }
}
