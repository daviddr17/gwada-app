import Foundation

struct SessionOpenLine: Identifiable, Equatable, Sendable {
    var id: String
    var orderLineId: String
    var name: String
    var openQuantity: Int
    var openCents: Int
    var course: Int
    var firedAt: Date?
    var detail: String

    var isFired: Bool { firedAt != nil }
}
