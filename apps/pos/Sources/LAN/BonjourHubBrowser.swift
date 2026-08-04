import Foundation

struct DiscoveredPosHub: Equatable, Identifiable, Sendable {
    var id: String { "\(host):\(port)" }
    var name: String
    var host: String
    var port: Int
    /// SHA-256 Fingerprint aus Bonjour TXT `fp` (lowercase hex).
    var tlsFingerprint: String?

    var baseURL: URL {
        PosLanProtocol.hubBaseURL(host: host, port: UInt16(port))
    }
}

/// Sucht iPad-Kassen im WLAN.
final class BonjourHubBrowser: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
    private let browser = NetServiceBrowser()
    private var resolving: [NetService] = []
    private var found: [String: DiscoveredPosHub] = [:]
    private var continuation: CheckedContinuation<[DiscoveredPosHub], Never>?
    private var timeoutWork: DispatchWorkItem?

    override init() {
        super.init()
        browser.delegate = self
        browser.includesPeerToPeer = true
    }

    @MainActor
    func scan(timeout: TimeInterval = 4.5) async -> [DiscoveredPosHub] {
        found.removeAll()
        resolving.removeAll()
        timeoutWork?.cancel()

        return await withCheckedContinuation { continuation in
            self.continuation = continuation
            browser.searchForServices(
                ofType: PosLanProtocol.bonjourType,
                inDomain: PosLanProtocol.bonjourDomain
            )

            let work = DispatchWorkItem { [weak self] in
                self?.finish()
            }
            timeoutWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout, execute: work)
        }
    }

    private func finish() {
        browser.stop()
        timeoutWork?.cancel()
        timeoutWork = nil
        let hubs = Array(found.values).sorted { $0.name < $1.name }
        continuation?.resume(returning: hubs)
        continuation = nil
    }

    func netServiceBrowser(
        _ browser: NetServiceBrowser,
        didFind service: NetService,
        moreComing: Bool
    ) {
        service.delegate = self
        resolving.append(service)
        service.resolve(withTimeout: 3)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let host = preferredIPv4(from: sender) ?? sender.hostName else { return }
        let port = sender.port > 0 ? sender.port : Int(PosLanProtocol.hubPort)
        let cleanedHost = host.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let hub = DiscoveredPosHub(
            name: sender.name,
            host: cleanedHost,
            port: port,
            tlsFingerprint: Self.tlsFingerprint(from: sender)
        )
        found[hub.id] = hub
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        print("[Bonjour] resolve failed: \(errorDict)")
    }

    private static func tlsFingerprint(from service: NetService) -> String? {
        guard let raw = service.txtRecordData() else { return nil }
        let dict = NetService.dictionary(fromTXTRecord: raw)
        guard let data = dict["fp"] ?? dict["FP"],
              let fp = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased(),
              !fp.isEmpty
        else {
            return nil
        }
        return fp
    }

    private func preferredIPv4(from service: NetService) -> String? {
        guard let addresses = service.addresses else { return nil }
        for address in addresses {
            var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            address.withUnsafeBytes { raw in
                guard let ptr = raw.bindMemory(to: sockaddr.self).baseAddress else { return }
                getnameinfo(
                    ptr,
                    socklen_t(address.count),
                    &hostname,
                    socklen_t(hostname.count),
                    nil,
                    0,
                    NI_NUMERICHOST
                )
            }
            let host = String(cString: hostname)
            if host.contains("."), !host.contains(":"), !host.hasPrefix("127.") {
                return host
            }
        }
        return nil
    }
}
