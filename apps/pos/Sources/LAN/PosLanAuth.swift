import Foundation

/// Reine Regel: welche LAN-Pfade brauchen einen Pairing-Token.
enum PosLanAuth {
    /// Offen (kein Token): health (Discovery), kds-HTML (Browser), pair/*.
    private static let openPaths: Set<String> = [
        PosLanProtocol.healthPath,
        PosLanProtocol.kdsPath,
        PosLanProtocol.pairRequestPath,
        PosLanProtocol.pairStatusPath,
    ]

    static func requiresToken(pathOnly: String) -> Bool {
        !openPaths.contains(pathOnly)
    }
}
