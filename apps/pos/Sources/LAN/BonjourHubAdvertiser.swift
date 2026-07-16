import Foundation

/// Publiziert die iPad-Kasse im lokalen Netz (`_gwada-pos._tcp`).
final class BonjourHubAdvertiser: NSObject, NetServiceDelegate {
    private var service: NetService?
    private(set) var isPublishing = false

    func publish(name: String, port: Int, restaurantId: String) {
        stop()
        let service = NetService(
            domain: PosLanProtocol.bonjourDomain,
            type: PosLanProtocol.bonjourType,
            name: name,
            port: Int32(port)
        )
        service.includesPeerToPeer = true
        service.delegate = self
        let txt: [String: Data] = [
            "restaurantId": Data(restaurantId.utf8),
            "role": Data("hub".utf8),
            "path": Data("/v1".utf8),
            "protocol": Data(String(PosLanProtocol.version).utf8),
        ]
        service.setTXTRecord(NetService.data(fromTXTRecord: txt))
        self.service = service
        service.publish()
    }

    func stop() {
        service?.stop()
        service = nil
        isPublishing = false
    }

    func netServiceDidPublish(_ sender: NetService) {
        isPublishing = true
        print("[Bonjour] published \(sender.name) \(sender.type)")
    }

    func netService(_ sender: NetService, didNotPublish errorDict: [String: NSNumber]) {
        isPublishing = false
        print("[Bonjour] publish failed: \(errorDict)")
    }
}
