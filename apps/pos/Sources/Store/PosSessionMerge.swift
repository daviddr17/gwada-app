import Foundation

enum PosSessionMergeError: Error, Equatable {
    case sameSession
    case sourceNotFound
    case targetNotFound
    case kassierenActive
    case missingIdempotencyKey
    case hubUnavailable
}

enum PosSessionMergeResult: Equatable {
    case ok(targetSessionId: String, coverCount: Int, idempotentReplay: Bool)
}

struct PosLanSessionMergeResponse: Decodable {
    var ok: Bool?
    var targetSessionId: String
    var coverCount: Int
    var idempotentReplay: Bool

    private enum CodingKeys: String, CodingKey {
        case ok
        case targetSessionId
        case coverCount
        case idempotentReplay
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ok = try container.decodeIfPresent(Bool.self, forKey: .ok)
        targetSessionId = try container.decode(String.self, forKey: .targetSessionId)
        coverCount = try container.decode(Int.self, forKey: .coverCount)
        idempotentReplay = try container.decodeIfPresent(Bool.self, forKey: .idempotentReplay) ?? false
    }
}

enum PosSessionMergePolicy {
    /// Beide Sessions dürfen keinen Kassieren-Lock haben.
    static func canMerge(sourceLocked: Bool, targetLocked: Bool) -> Bool {
        !sourceLocked && !targetLocked
    }
}
