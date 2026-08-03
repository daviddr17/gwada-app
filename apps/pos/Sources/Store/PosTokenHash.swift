import Foundation
import CryptoKit

enum PosTokenHash {
    /// SHA-256 hex — Hub speichert nur Hashes, Klartext nur einmal an das Handgerät.
    static func sha256Hex(_ token: String) -> String {
        let digest = SHA256.hash(data: Data(token.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
