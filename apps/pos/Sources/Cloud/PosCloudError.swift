import Foundation

enum PosCloudError: LocalizedError {
    case unauthorized
    case missingConfig(String)
    case invalidResponse
    case httpStatus(Int, String?)
    case offline
    case missingRestaurant

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Nicht angemeldet — bitte erneut einloggen."
        case .missingConfig(let name):
            return "Konfiguration fehlt: \(name)."
        case .invalidResponse:
            return "Ungültige Antwort von der Cloud."
        case .httpStatus(let code, let body):
            return "Cloud HTTP \(code)\(body.map { ": \($0.prefix(120))" } ?? "")"
        case .offline:
            return "Cloud-API nicht erreichbar (Next unter API-Basis gestartet? Lokal: :3000)."
        case .missingRestaurant:
            return "Restaurant-ID fehlt — bitte in den Einstellungen setzen."
        }
    }
}
