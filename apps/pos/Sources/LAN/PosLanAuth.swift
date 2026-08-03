import Foundation

/// Reine Regel: welche LAN-Pfade brauchen Pair-Token bzw. KDS-LAN-Secret.
enum PosLanAuth {
    /// Offen: health, KDS-HTML (Secret steckt im HTML), Pairing-Bootstrap.
    private static let openPaths: Set<String> = [
        PosLanProtocol.healthPath,
        PosLanProtocol.kdsPath,
        PosLanProtocol.pairRequestPath,
        PosLanProtocol.pairStatusPath,
        PosLanProtocol.pairDebugApproveAllPath,
    ]

    /// KDS-Daten: kein Pair-Token, aber `X-Gwada-Pos-Lan-Secret` (Review P1-7).
    private static let kdsSecretPaths: Set<String> = [
        PosLanProtocol.kdsTicketsPath,
        PosLanProtocol.kdsAdvancePath,
    ]

    static func requiresToken(pathOnly: String) -> Bool {
        !openPaths.contains(pathOnly) && !kdsSecretPaths.contains(pathOnly)
    }

    static func requiresKdsLanSecret(pathOnly: String) -> Bool {
        kdsSecretPaths.contains(pathOnly)
    }
}
