import Foundation

struct PosPrintJobLine: Sendable, Equatable {
    var quantity: Int
    var name: String
    var detail: String
}

struct PosPrintJobSnapshot: Sendable, Equatable {
    var id: String
    var printerId: String
    var printerName: String
    var orderNumber: Int
    var connectionType: String
    var host: String
    var port: UInt16
    var lines: [PosPrintJobLine]
}
