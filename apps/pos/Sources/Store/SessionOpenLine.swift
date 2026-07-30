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
    /// Present for locally buffered lines (menu badges); cloud summary may omit it.
    var menuItemId: String? = nil

    var isFired: Bool { firedAt != nil }
}
