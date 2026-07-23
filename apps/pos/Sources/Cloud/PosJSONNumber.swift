import Foundation

/// Decodes JSON numbers that may arrive as Int or Double.
struct PosJSONNumber: Decodable, Equatable, Sendable {
    var doubleValue: Double
    var intValue: Int { Int(doubleValue.rounded()) }

    init(_ value: Double) { doubleValue = value }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) {
            doubleValue = d
            return
        }
        if let i = try? c.decode(Int.self) {
            doubleValue = Double(i)
            return
        }
        if let s = try? c.decode(String.self), let d = Double(s) {
            doubleValue = d
            return
        }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Expected number")
    }
}
