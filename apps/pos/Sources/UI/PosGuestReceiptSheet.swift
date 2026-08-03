import SwiftUI

/// Gastbeleg nach Prototyp `ReceiptSheet` — § 6 KassenSichV inkl. TSE-Demo.
struct PosGuestReceiptSheet: View {
    let receipt: PosLocalReceipt
    var onClose: () -> Void

    private var venueName: String {
        let name = PosHubState.shared.restaurantName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty || name == "Demo Restaurant" ? "GOLDENER HIRSCH" : name.uppercased()
    }

    private var netCents: Int {
        Int((Double(receipt.amountCents) / 1.19).rounded())
    }

    private var taxCents: Int { receipt.amountCents - netCents }

    private var methodLabel: String {
        switch receipt.method {
        case "cash": return "Bar"
        case "card": return "Karte"
        case "paypal": return "PayPal"
        case "voucher": return "Gutschein"
        default: return receipt.method
        }
    }

    private var waiterLabel: String {
        let name = receipt.waiterName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Service" : name
    }

    private var tableKellner: String {
        let table = receipt.tableLabel.replacingOccurrences(of: "Tisch ", with: "")
        return "\(table) / \(waiterLabel)"
    }

    private var shareText: String {
        var lines: [String] = [
            venueName,
        ]
        if PosSecurityPolicy.allowsDemoFiscalTse {
            lines.append("DEMO-BELEG — nicht fiskalisch")
            lines.append("\(PosReceiptFiscalDemo.street), \(PosReceiptFiscalDemo.city)")
            lines.append("\(PosReceiptFiscalDemo.taxNumber) · \(PosReceiptFiscalDemo.vatId)")
        } else if receipt.fiscalPending {
            lines.append("Fiskalisierung ausstehend")
        }
        lines.append("")
        lines.append("Beleg-Nr. \(receipt.orderNumber) · Tisch \(receipt.tableLabel) · Kellner \(waiterLabel)")
        lines.append(formatDateTime(receipt.paidAt))
        lines.append("")
        for item in receipt.items ?? [] {
            var row = "\(item.quantity)x \(item.name)"
            if !item.detail.isEmpty { row += " (\(item.detail))" }
            row += "  \(PosMoney.format(item.totalCents))"
            lines.append(row)
        }
        lines.append("")
        lines.append("Zwischensumme: \(PosMoney.format(receipt.amountCents))")
        if receipt.tipCents > 0 {
            lines.append("Trinkgeld: \(PosMoney.format(receipt.tipCents))")
        }
        lines.append("SUMME: \(PosMoney.format(receipt.paidTotalCents)) · Zahlart: \(methodLabel)")
        if let given = receipt.receivedAmountCents {
            lines.append(
                "Gegeben: \(PosMoney.format(given)) · Rückgeld: \(PosMoney.format(given - receipt.paidTotalCents))"
            )
        }
        lines.append("")
        lines.append(
            "MwSt. 19%: Netto \(PosMoney.format(netCents)) · Steuer \(PosMoney.format(taxCents)) · Brutto \(PosMoney.format(receipt.amountCents))"
        )
        if receipt.tipCents > 0 {
            lines.append("(Trinkgeld nicht umsatzsteuerpflichtig)")
        }
        if let tse = receipt.tse {
            lines.append("")
            if PosSecurityPolicy.allowsDemoFiscalTse {
                lines.append("— DEMO-TSE (nicht rechtsgültig) —")
            } else {
                lines.append("— TSE —")
            }
            lines.append("TSE-Transaktions-Nr.: \(tse.transactionNumber)")
            lines.append("TSE-Signaturzaehler: \(tse.signatureCounter)")
            lines.append("Vorgangsbeginn: \(formatDateTime(tse.processStartedAt))")
            lines.append("Vorgangsende: \(formatDateTime(receipt.paidAt))")
            lines.append("TSE-Seriennummer: \(tse.tseSerial)")
            lines.append("Kassen-Seriennummer: \(tse.registerSerial)")
            lines.append("Signaturalgorithmus: ecdsa-plain-SHA256 · Zeitformat: utcTime")
            lines.append("Pruefwert: \(tse.signature)")
        }
        lines.append("")
        lines.append("Vielen Dank für Ihren Besuch!")
        return lines.joined(separator: "\n")
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.72).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    PaperReceiptView {
                        receiptBody
                    }
                    .padding(.horizontal, 14)

                    HStack(spacing: PosLayout.dockGap) {
                        ShareLink(
                            item: shareText,
                            subject: Text("Beleg \(receipt.orderNumber) · \(venueName)"),
                            message: Text(shareText)
                        ) {
                            Text("Beleg teilen")
                                .font(.headline.weight(.semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PosPrimaryButtonStyle())

                        PosButton(title: "Schließen", kind: .secondary, action: onClose)
                    }
                    .padding(.horizontal, PosLayout.pageTight)
                    .padding(.top, PosLayout.stack)
                    .padding(.bottom, 24)
                }
                .padding(.top, 20)
            }
        }
        .presentationBackground(.clear)
        .accessibilityIdentifier("pos.guestReceipt")
    }

    private var receiptBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Pflicht: Name & Anschrift
            VStack(spacing: 2) {
                Text(venueName)
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                    .tracking(0.6)
                    .multilineTextAlignment(.center)
                if PosSecurityPolicy.allowsDemoFiscalTse {
                    Text("DEMO-BELEG — nicht fiskalisch")
                        .font(.system(size: 10, weight: .bold).monospaced())
                        .foregroundStyle(.red.opacity(0.85))
                        .padding(.top, 2)
                    Text("\(PosReceiptFiscalDemo.street) · \(PosReceiptFiscalDemo.city)")
                        .font(.system(size: 10.5).monospaced())
                        .foregroundStyle(paperMuted)
                    Text(PosReceiptFiscalDemo.phone)
                        .font(.system(size: 10.5).monospaced())
                        .foregroundStyle(paperMuted)
                    Text(PosReceiptFiscalDemo.taxNumber)
                        .font(.system(size: 10.5).monospaced())
                        .foregroundStyle(paperMuted)
                    Text(PosReceiptFiscalDemo.vatId)
                        .font(.system(size: 10.5).monospaced())
                        .foregroundStyle(paperMuted)
                } else if receipt.fiscalPending {
                    Text("Fiskalisierung ausstehend")
                        .font(.system(size: 10, weight: .semibold).monospaced())
                        .foregroundStyle(paperMuted)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 8)

            dashedLine

            metaRow("Beleg-Nr.", "\(receipt.orderNumber)")
            metaRow("Tisch / Kellner", tableKellner)
            metaRow("Datum", formatDateTime(receipt.paidAt))
            if let label = receipt.label, !label.isEmpty {
                metaRow("Vorgang", label)
            }

            dashedLine

            ForEach(Array((receipt.items ?? []).enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 1) {
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(item.quantity)×")
                            .frame(width: 24, alignment: .leading)
                        Text(item.name)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(PosMoney.format(item.totalCents))
                    }
                    .font(.system(size: 11.5).monospaced())
                    if !item.detail.isEmpty {
                        Text(item.detail)
                            .font(.system(size: 9.5).monospaced())
                            .foregroundStyle(paperMuted)
                            .padding(.leading, 32)
                    }
                }
                .padding(.bottom, 2)
            }

            dashedLine

            metaRow("Zwischensumme", PosMoney.format(receipt.amountCents))
            if receipt.tipCents > 0 {
                metaRow("Trinkgeld", PosMoney.format(receipt.tipCents))
            }
            HStack {
                Text("SUMME")
                Spacer()
                Text(PosMoney.format(receipt.paidTotalCents))
            }
            .font(.system(size: 14, weight: .bold).monospaced())
            .padding(.vertical, 4)

            metaRow("Zahlart", methodLabel)
            if let given = receipt.receivedAmountCents {
                metaRow(
                    "Gegeben / Rückgeld",
                    "\(PosMoney.format(given)) / \(PosMoney.format(given - receipt.paidTotalCents))"
                )
            }

            dashedLine

            // MwSt.-Tabelle
            HStack {
                Text("MwSt.").frame(maxWidth: .infinity, alignment: .leading)
                Text("Netto").frame(maxWidth: .infinity)
                Text("Steuer").frame(maxWidth: .infinity)
                Text("Brutto").frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(.system(size: 10.5).monospaced())
            .foregroundStyle(paperMuted)

            HStack {
                Text("A 19%").frame(maxWidth: .infinity, alignment: .leading)
                Text(PosMoney.format(netCents)).frame(maxWidth: .infinity)
                Text(PosMoney.format(taxCents)).frame(maxWidth: .infinity)
                Text(PosMoney.format(receipt.amountCents)).frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(.system(size: 11).monospaced())

            if receipt.tipCents > 0 {
                Text("Trinkgeld nicht umsatzsteuerpflichtig")
                    .font(.system(size: 9.5).monospaced())
                    .foregroundStyle(paperMuted)
                    .padding(.top, 2)
            }

            dashedLine

            if let tse = receipt.tse {
                if PosSecurityPolicy.allowsDemoFiscalTse {
                    Text("DEMO-TSE — nicht rechtsgültig")
                        .font(.system(size: 10, weight: .bold).monospaced())
                        .foregroundStyle(.red.opacity(0.85))
                        .padding(.bottom, 4)
                }
                Text("TSE-SICHERHEITSEINRICHTUNG")
                    .font(.system(size: 10, weight: .semibold).monospaced())
                    .tracking(1.4)
                    .foregroundStyle(paperMuted)
                    .padding(.bottom, 4)

                metaRow("TSE-Transaktions-Nr.", "\(tse.transactionNumber)")
                metaRow("TSE-Signaturzähler", "\(tse.signatureCounter)")
                metaRow("Vorgangsbeginn", formatDateTime(tse.processStartedAt))
                metaRow("Vorgangsende", formatDateTime(receipt.paidAt))
                metaRow("TSE-Seriennummer", tse.tseSerial, breakAll: true)
                metaRow("Kassen-Seriennr.", tse.registerSerial)
                metaRow("Sig.-Algorithmus", "ecdsa-plain-SHA256")
                metaRow("TSE-Zeitformat", "utcTime")
                metaRow("Prüfwert", tse.signature, breakAll: true)

                VStack(spacing: 4) {
                    PosReceiptQrPlaceholder(seed: tse.signatureCounter)
                    Text("DSFinV-K QR-Code")
                        .font(.system(size: 9.5).monospaced())
                        .foregroundStyle(paperMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
                .padding(.bottom, 4)
            }

            Text("Vielen Dank für Ihren Besuch!")
                .font(.system(size: 11).monospaced())
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
        }
        .foregroundStyle(paperInk)
    }

    private var paperInk: Color {
        Color(red: 40 / 255, green: 37 / 255, blue: 27 / 255)
    }

    private var paperMuted: Color {
        Color(red: 139 / 255, green: 134 / 255, blue: 119 / 255)
    }

    private var dashedLine: some View {
        Rectangle()
            .fill(paperMuted.opacity(0.35))
            .frame(height: 1)
            .padding(.vertical, 8)
    }

    private func metaRow(_ label: String, _ value: String, breakAll: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .foregroundStyle(paperMuted)
                .fixedSize(horizontal: true, vertical: false)
            Spacer(minLength: 8)
            Text(value)
                .multilineTextAlignment(.trailing)
                .lineLimit(breakAll ? 4 : 2)
                .minimumScaleFactor(breakAll ? 0.7 : 1)
        }
        .font(.system(size: 10.5).monospaced())
        .padding(.vertical, 1)
    }

    private func formatDateTime(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let out = DateFormatter()
        out.locale = Locale(identifier: "de_DE")
        out.dateFormat = "dd.MM.yyyy, HH:mm:ss"
        return out.string(from: date)
    }
}

/// Einfacher Platzhalter-QR wie Prototyp `QRCodeFake` (nicht scannbar — bis DSFinV-K live).
struct PosReceiptQrPlaceholder: View {
    let seed: Int
    private let n = 17

    var body: some View {
        let cells = Self.cells(seed: seed, n: n)
        VStack(spacing: 0) {
            ForEach(0 ..< n, id: \.self) { r in
                HStack(spacing: 0) {
                    ForEach(0 ..< n, id: \.self) { c in
                        Rectangle()
                            .fill(cells[r * n + c] ? Color.black : Color.white)
                            .frame(width: 7, height: 7)
                    }
                }
            }
        }
        .padding(10)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private static func cells(seed: Int, n: Int) -> [Bool] {
        var h = UInt64(UInt32(bitPattern: Int32(truncatingIfNeeded: seed &* 2_654_435_761)))
        var arr = [Bool](repeating: false, count: n * n)
        for i in 0 ..< (n * n) {
            h = (h &* 1_103_515_245 &+ 12_345) % 2_147_483_648
            arr[i] = h % 3 != 0
        }
        func mark(r0: Int, c0: Int) {
            for r in 0 ..< 5 {
                for c in 0 ..< 5 {
                    let edge = r == 0 || r == 4 || c == 0 || c == 4
                    arr[(r0 + r) * n + (c0 + c)] = edge || (r == 2 && c == 2)
                }
            }
        }
        mark(r0: 0, c0: 0)
        mark(r0: 0, c0: 12)
        mark(r0: 12, c0: 0)
        return arr
    }
}

#if DEBUG
#Preview {
    PosGuestReceiptSheet(
        receipt: PosLocalReceipt(
            localId: "preview",
            paymentId: nil,
            orderId: nil,
            orderNumber: 4711,
            tableSessionId: "s1",
            tableLabel: "Tisch 12",
            diningTableId: "t12",
            method: "cash",
            status: "paid",
            amountCents: 2450,
            tipCents: 0,
            receivedAmountCents: 5000,
            paidAt: ISO8601DateFormatter().string(from: Date()),
            fiscalPending: true,
            canVoidCash: true,
            dayYmd: "2026-07-30",
            label: "Rest / Alles",
            items: [
                PosLocalReceiptLine(quantity: 1, name: "Wiener Schnitzel", detail: "mit Pommes", totalCents: 1850),
                PosLocalReceiptLine(quantity: 2, name: "Cola 0,4", detail: "", totalCents: 600),
            ],
            waiterName: "Fadi",
            tse: PosReceiptFiscalDemo.nextTse(
                amountCents: 2450,
                processStartedAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-45)),
                processEndedAt: ISO8601DateFormatter().string(from: Date())
            )
        ),
        onClose: {}
    )
}
#endif
