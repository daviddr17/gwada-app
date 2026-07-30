import Foundation

/// Reine Regel: welche LAN-Pfade brauchen einen Pairing-Token.
enum PosLanAuth {
    /// Offen (kein Token): health (Discovery), kds-HTML (Browser), kds-Tickets und kds-Advance (Browser-Display), pair/*.
    private static let openPaths: Set<String> = [
        PosLanProtocol.healthPath,
        PosLanProtocol.kdsPath,
        PosLanProtocol.kdsTicketsPath,
        PosLanProtocol.kdsAdvancePath,
        PosLanProtocol.pairRequestPath,
        PosLanProtocol.pairStatusPath,
        PosLanProtocol.pairDebugApproveAllPath,
    ]

    static func requiresToken(pathOnly: String) -> Bool {
        !openPaths.contains(pathOnly)
    }
}
