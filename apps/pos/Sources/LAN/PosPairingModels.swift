import Foundation

enum PosLanPairState: String, Codable, Sendable {
    case pending
    case approved
    case rejected
    case expired
}

/// iPhone → Hub: Kopplungsanfrage.
struct PosLanPairRequest: Codable, Equatable, Sendable {
    var deviceName: String
    var installationId: String
}

/// Hub → iPhone: Antwort auf die Anfrage (Code zum Abgleich am iPad).
struct PosLanPairChallenge: Codable, Equatable, Sendable {
    var pairId: String
    var verificationCode: String
}

/// Hub → iPhone: Poll-Ergebnis.
struct PosLanPairStatus: Codable, Equatable, Sendable {
    var state: PosLanPairState
    var token: String?
    var hub: PosLanHubInfo?
    /// ISO8601 — wann der Pair-Token abläuft (P2-1).
    var tokenExpiresAt: String?
}

/// Antwort auf `POST /v1/pair/refresh`.
struct PosLanPairRefreshResponse: Codable, Equatable, Sendable {
    var token: String
    var expiresAt: String
    var hub: PosLanHubInfo?
}
