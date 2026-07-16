import Foundation

/// Minimaler ESC/POS-Küchenbon — klein für schnellen TCP-Send.
enum EscPosTicketBuilder {
    private static let initPrinter = Data([0x1B, 0x40])
    private static let alignCenter = Data([0x1B, 0x61, 0x01])
    private static let alignLeft = Data([0x1B, 0x61, 0x00])
    private static let boldOn = Data([0x1B, 0x45, 0x01])
    private static let boldOff = Data([0x1B, 0x45, 0x00])
    private static let doubleOn = Data([0x1D, 0x21, 0x11])
    private static let doubleOff = Data([0x1D, 0x21, 0x00])
    private static let cutPartial = Data([0x1D, 0x56, 0x01])
    private static let lineFeed = Data([0x0A])

    static func kitchenTicket(
        restaurantName: String,
        orderNumber: Int,
        printerName: String,
        lines: [PosPrintJobLine],
        createdAt: Date = Date()
    ) -> Data {
        var out = Data()
        out.append(initPrinter)
        out.append(alignCenter)
        out.append(boldOn)
        out.append(doubleOn)
        out.append(textLine("#\(orderNumber)"))
        out.append(doubleOff)
        out.append(boldOff)
        out.append(textLine(restaurantName))
        out.append(textLine(printerName))
        out.append(textLine(timeString(createdAt)))
        out.append(textLine(String(repeating: "-", count: 32)))
        out.append(alignLeft)

        for line in lines {
            out.append(boldOn)
            out.append(textLine("\(line.quantity)× \(line.name)"))
            out.append(boldOff)
            let detail = line.detail.trimmingCharacters(in: .whitespacesAndNewlines)
            if !detail.isEmpty {
                out.append(textLine("  \(detail)"))
            }
        }

        out.append(lineFeed)
        out.append(lineFeed)
        out.append(cutPartial)
        return out
    }

    private static func textLine(_ string: String) -> Data {
        var data = string.data(using: .utf8) ?? Data(string.utf8)
        data.append(contentsOf: [0x0A])
        return data
    }

    private static func timeString(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }
}
