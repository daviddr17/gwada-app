import Foundation

/// Prototyp-Stammdaten für Gastbeleg / TSE-Demo (§ 6 KassenSichV) bis Fiskaly live ist.
enum PosReceiptFiscalDemo {
    static let street = "Hirschgasse 12"
    static let city = "65183 Wiesbaden"
    static let phone = "Tel. 0611 123456"
    static let taxNumber = "St.-Nr. 040/123/45678"
    static let vatId = "USt-IdNr. DE123456789"
    static let tseSerial = "bd1f0c339a7e42d18c55f0a2e6b91d374a88c1f2e0d3b6a49175c8e2f4a0b6d1"
    static let registerSerial = "GH-KASSE-01-8842"

    private static let txKey = "gwada_pos_tse_tx"
    private static let sigKey = "gwada_pos_tse_sig"

    static func nextTse(amountCents: Int, processStartedAt: String, processEndedAt: String) -> PosLocalReceiptTse {
        let defaults = UserDefaults.standard
        let tx = max(28_413, defaults.integer(forKey: txKey) + 1)
        let sig = max(192_337, defaults.integer(forKey: sigKey) + 1)
        defaults.set(tx, forKey: txKey)
        defaults.set(sig, forKey: sigKey)
        let seed = (abs(processEndedAt.hashValue) % 100_000) + amountCents
        return PosLocalReceiptTse(
            transactionNumber: tx,
            signatureCounter: sig,
            tseSerial: tseSerial,
            registerSerial: registerSerial,
            signature: fakeSignature(seed: seed),
            processStartedAt: processStartedAt
        )
    }

    static func fakeSignature(seed: Int) -> String {
        let chars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")
        var h = UInt64(UInt32(bitPattern: Int32(truncatingIfNeeded: seed == 0 ? 1 : seed)))
        var s = ""
        for _ in 0 ..< 86 {
            h = (h &* 1_103_515_245 &+ 12_345) % 2_147_483_648
            s.append(chars[Int(h % 64)])
        }
        return s + "=="
    }
}
