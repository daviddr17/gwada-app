import SwiftUI

/// Layout-Tokens aus Prototyp-Briefing (Einhand, ≥44 pt, Daumen-Dock).
enum PosLayout {
    /// Außenrand Seiteninhalt.
    static let page: CGFloat = 16
    /// Engerer Außenrand am Dock.
    static let pageTight: CGFloat = 12
    /// Abstand zwischen Sektionen.
    static let section: CGFloat = 16
    /// Abstand innerhalb einer Sektion.
    static let stack: CGFloat = 10
    /// Abstand zwischen Dock-Buttons.
    static let dockGap: CGFloat = 10
    /// Minimale Touch-Höhe (Apple HIG / Briefing).
    static let touchMin: CGFloat = 44
    /// Primär-CTA Höhe (etwas großzügiger für Daumen).
    static let buttonMin: CGFloat = 52
    /// Zweizeilige Amount-Buttons (Titel + Betrag).
    static let amountButtonMin: CGFloat = 64
    /// Horizontaler Innenabstand in Buttons — Text darf nicht am Rand kleben.
    static let buttonPadX: CGFloat = 16
    /// Vertikaler Innenabstand einzeiliger Buttons.
    static let buttonPadY: CGFloat = 14
    static let chipPadX: CGFloat = 14
    static let chipPadY: CGFloat = 10
    static let cardRadius: CGFloat = 16
    static let chipRadius: CGFloat = 999
    static let rowMin: CGFloat = 56
}
