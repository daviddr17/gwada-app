import CryptoKit
import Foundation
import Security

enum PosHubTLSIdentity {
    private static let label = "app.gwada.pos.hub-tls"
    private static let keyTag = Data("\(label).private-key".utf8)
    private static let lock = NSLock()

    static func loadOrCreate() throws -> SecIdentity {
        lock.lock()
        defer { lock.unlock() }

        if loadCertificate() != nil, let identity = loadIdentity() {
            return identity
        }

        deleteStoredItems()
        let key = try createPrivateKey()
        let certificate = try createCertificate(privateKey: key)
        try store(certificate: certificate)

        guard let identity = loadIdentity() else {
            throw Error.identityUnavailable
        }
        return identity
    }

    static func certificateFingerprintSHA256Hex(identity: SecIdentity) -> String? {
        var certificate: SecCertificate?
        guard SecIdentityCopyCertificate(identity, &certificate) == errSecSuccess,
              let certificate else {
            return nil
        }
        return SHA256.hash(data: SecCertificateCopyData(certificate) as Data)
            .map { String(format: "%02x", $0) }
            .joined()
    }

    #if DEBUG
    static func resetForTests() {
        lock.lock()
        defer { lock.unlock() }
        deleteStoredItems()
    }
    #endif

    private static func loadCertificate() -> SecCertificate? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassCertificate,
            kSecAttrLabel as String: label,
            kSecReturnRef as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else {
            return nil
        }
        let certificate = result as! SecCertificate
        return certificate
    }

    private static func loadIdentity() -> SecIdentity? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassIdentity,
            kSecAttrLabel as String: label,
            kSecReturnRef as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else {
            return nil
        }
        let identity = result as! SecIdentity
        return identity
    }

    private static func createPrivateKey() throws -> SecKey {
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag,
                kSecAttrLabel as String: label,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ],
        ]
        var error: Unmanaged<CFError>?
        guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw Error.keyCreation(error?.takeRetainedValue())
        }
        return key
    }

    private static func createCertificate(privateKey: SecKey) throws -> SecCertificate {
        guard let publicKey = SecKeyCopyPublicKey(privateKey),
              let publicKeyBytes = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            throw Error.publicKeyUnavailable
        }

        let signatureAlgorithm = DER.sequence(DER.oid([1, 2, 840, 10045, 4, 3, 2]))
        let commonName = DER.sequence(DER.set(DER.sequence(
            DER.oid([2, 5, 4, 3]),
            DER.utf8String("Gwada POS Hub")
        )))
        let validity = DER.sequence(
            DER.generalizedTime(Date()),
            DER.generalizedTime(Calendar(identifier: .gregorian).date(byAdding: .year, value: 5, to: Date())!)
        )
        let subjectPublicKeyInfo = DER.sequence(
            DER.sequence(
                DER.oid([1, 2, 840, 10045, 2, 1]),
                DER.oid([1, 2, 840, 10045, 3, 1, 7])
            ),
            DER.bitString(publicKeyBytes)
        )
        let extensions = DER.explicit(3, DER.sequence(
            DER.sequence(DER.oid([2, 5, 29, 19]), DER.octetString(DER.sequence())),
            DER.sequence(DER.oid([2, 5, 29, 15]), DER.octetString(DER.bitString(Data([0x80]), unusedBits: 7)))
        ))
        let tbsCertificate = DER.sequence(
            DER.explicit(0, DER.integer(Data([2]))),
            DER.integer(try randomSerial()),
            signatureAlgorithm,
            commonName,
            validity,
            commonName,
            subjectPublicKeyInfo,
            extensions
        )

        var signingError: Unmanaged<CFError>?
        guard let rawSignature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            tbsCertificate as CFData,
            &signingError
        ) as Data? else {
            throw Error.signingFailed(signingError?.takeRetainedValue())
        }
        // X9.62 liefert bereits DER SEQUENCE(r,s) — direkt in BIT STRING.
        let certificateDER = DER.sequence(tbsCertificate, signatureAlgorithm, DER.bitString(rawSignature))
        guard let certificate = SecCertificateCreateWithData(nil, certificateDER as CFData) else {
            throw Error.certificateCreationFailed
        }
        return certificate
    }

    private static func randomSerial() throws -> Data {
        var bytes = [UInt8](repeating: 0, count: 16)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw Error.randomFailed
        }
        bytes[0] &= 0x7F
        return Data(bytes)
    }

    private static func store(certificate: SecCertificate) throws {
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassCertificate,
            kSecAttrLabel as String: label,
            kSecValueRef as String: certificate,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw Error.keychain(status) }
    }

    private static func deleteStoredItems() {
        SecItemDelete([
            kSecClass as String: kSecClassCertificate,
            kSecAttrLabel as String: label,
        ] as CFDictionary)
        SecItemDelete([
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeyClass as String: kSecAttrKeyClassPrivate,
        ] as CFDictionary)
    }
}

private extension PosHubTLSIdentity {
    enum Error: Swift.Error {
        case keyCreation(CFError?)
        case publicKeyUnavailable
        case signingFailed(CFError?)
        case invalidSignature
        case certificateCreationFailed
        case randomFailed
        case keychain(OSStatus)
        case identityUnavailable
    }

    enum DER {
        static func sequence(_ values: Data...) -> Data { tagged(0x30, values.reduce(into: Data(), +=)) }
        static func set(_ values: Data...) -> Data { tagged(0x31, values.reduce(into: Data(), +=)) }
        static func explicit(_ tag: UInt8, _ value: Data) -> Data { tagged(0xA0 | tag, value) }
        static func octetString(_ value: Data) -> Data { tagged(0x04, value) }
        static func utf8String(_ value: String) -> Data { tagged(0x0C, Data(value.utf8)) }
        static func generalizedTime(_ value: Date) -> Data {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyyMMddHHmmss'Z'"
            return tagged(0x18, Data(formatter.string(from: value).utf8))
        }

        static func integer(_ value: some DataProtocol) -> Data {
            var bytes = Array(value.drop(while: { $0 == 0 }))
            if bytes.isEmpty { bytes = [0] }
            if bytes[0] & 0x80 != 0 { bytes.insert(0, at: 0) }
            return tagged(0x02, Data(bytes))
        }

        static func bitString(_ value: Data, unusedBits: UInt8 = 0) -> Data {
            tagged(0x03, Data([unusedBits]) + value)
        }

        static func oid(_ values: [UInt64]) -> Data {
            precondition(values.count >= 2)
            var result = Data([UInt8(values[0] * 40 + values[1])])
            for value in values.dropFirst(2) {
                var encoded = [UInt8(value & 0x7F)]
                var remaining = value >> 7
                while remaining > 0 {
                    encoded.insert(UInt8(remaining & 0x7F) | 0x80, at: 0)
                    remaining >>= 7
                }
                result.append(contentsOf: encoded)
            }
            return tagged(0x06, result)
        }

        private static func tagged(_ tag: UInt8, _ value: Data) -> Data {
            Data([tag]) + length(value.count) + value
        }

        private static func length(_ count: Int) -> Data {
            if count < 128 { return Data([UInt8(count)]) }
            var bytes = [UInt8]()
            var remaining = count
            while remaining > 0 {
                bytes.insert(UInt8(remaining & 0xFF), at: 0)
                remaining >>= 8
            }
            return Data([0x80 | UInt8(bytes.count)] + bytes)
        }
    }
}
