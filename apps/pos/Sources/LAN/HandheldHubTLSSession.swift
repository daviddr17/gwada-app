import CryptoKit
import Foundation
import Security

enum HandheldHubTLS {
    private static let fingerprintLock = NSLock()
    private static var acceptedFingerprint: String?

    static var lastAcceptedFingerprintHex: String? {
        fingerprintLock.lock()
        defer { fingerprintLock.unlock() }
        return acceptedFingerprint
    }

    static func makeSession(
        pinnedFingerprintHex: String?,
        allowTrustOnFirstUse: Bool = PosSecurityPolicy.allowsTlsTrustOnFirstUse
    ) -> URLSession {
        fingerprintLock.lock()
        acceptedFingerprint = nil
        fingerprintLock.unlock()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        return URLSession(
            configuration: configuration,
            delegate: CertificatePinningDelegate(
                pinnedFingerprintHex: pinnedFingerprintHex,
                allowTrustOnFirstUse: allowTrustOnFirstUse
            ),
            delegateQueue: nil
        )
    }

    fileprivate static func accept(_ fingerprint: String) {
        fingerprintLock.lock()
        acceptedFingerprint = fingerprint
        fingerprintLock.unlock()
    }
}

private final class CertificatePinningDelegate: NSObject, URLSessionDelegate {
    private let pinnedFingerprintHex: String?
    private let allowTrustOnFirstUse: Bool

    init(pinnedFingerprintHex: String?, allowTrustOnFirstUse: Bool) {
        let normalized = pinnedFingerprintHex?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        self.pinnedFingerprintHex = normalized?.isEmpty == true ? nil : normalized
        self.allowTrustOnFirstUse = allowTrustOnFirstUse
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              let certificates = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let certificate = certificates.first else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let fingerprint = SHA256.hash(data: SecCertificateCopyData(certificate) as Data)
            .map { String(format: "%02x", $0) }
            .joined()

        if let pinnedFingerprintHex {
            guard fingerprint == pinnedFingerprintHex else {
                completionHandler(.cancelAuthenticationChallenge, nil)
                return
            }
            HandheldHubTLS.accept(fingerprint)
        } else if allowTrustOnFirstUse {
            // DEBUG / manuell ohne Bonjour-fp — nicht für Production-Pairing.
            HandheldHubTLS.accept(fingerprint)
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}
