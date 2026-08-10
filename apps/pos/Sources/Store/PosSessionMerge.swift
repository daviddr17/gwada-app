import Foundation

enum PosSessionMergeError: Error, Equatable {
    case sameSession
    case sourceNotFound
    case targetNotFound
    case kassierenActive
    case missingIdempotencyKey
}

enum PosSessionMergeResult: Equatable {
    case ok(targetSessionId: String, coverCount: Int, idempotentReplay: Bool)
}

enum PosSessionMergePolicy {
    /// Beide Sessions dürfen keinen Kassieren-Lock haben.
    static func canMerge(sourceLocked: Bool, targetLocked: Bool) -> Bool {
        !sourceLocked && !targetLocked
    }
}
