import Foundation
import SwiftUI

@MainActor
final class PosRuntime: ObservableObject {
    enum Phase: Equatable {
        case idle
        case starting
        case hubReady
        case searching
        case connected
        case error(String)
    }

    @Published private(set) var role: PosDeviceRole
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var detectionLabel: String
    @Published private(set) var hubBaseURL: URL?
    @Published private(set) var snapshot: PosLanHubSnapshot?
    @Published private(set) var bonjourPublishing = false
    @Published private(set) var statusMessage: String = ""

    private let hubDeviceId = UUID().uuidString
    private var httpServer: HubHTTPServer?
    private let advertiser = BonjourHubAdvertiser()
    private let browser = BonjourHubBrowser()
    private let manualHostKey = "gwada_pos_hub_host"

    init() {
        let role = PosDeviceRoleDetector.detect()
        self.role = role
        self.detectionLabel = "Automatisch: \(PosDeviceRoleDetector.deviceKindLabel) → \(role.title)"
    }

    func start() async {
        phase = .starting
        switch role {
        case .hub:
            await startHub()
        case .handheld:
            await connectHandheld()
        }
    }

    func refresh() async {
        switch role {
        case .hub:
            snapshot = DemoSnapshotFactory.makeSnapshot(hubDeviceId: hubDeviceId)
            statusMessage = "Demo-Snapshot aktualisiert (Cloud-Anbindung folgt)."
        case .handheld:
            await connectHandheld()
        }
    }

    func saveManualHost(_ raw: String) async {
        let host = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else { return }
        UserDefaults.standard.set(host, forKey: manualHostKey)
        await connectHandheld(preferredHost: host)
    }

    private func startHub() async {
        stopHub()
        let deviceId = hubDeviceId
        snapshot = DemoSnapshotFactory.makeSnapshot(hubDeviceId: deviceId)

        let server = HubHTTPServer { method, path in
            Self.handleHubRequest(method: method, path: path, hubDeviceId: deviceId)
        }

        do {
            try server.start()
            httpServer = server
            let name = PosLanProtocol.bonjourName(restaurantName: DemoSnapshotFactory.restaurantName)
            advertiser.publish(
                name: name,
                port: Int(PosLanProtocol.hubPort),
                restaurantId: DemoSnapshotFactory.restaurantId
            )
            bonjourPublishing = true
            phase = .hubReady
            statusMessage = "Kassen-Server läuft auf Port \(PosLanProtocol.hubPort)."
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "Server-Start fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func stopHub() {
        httpServer?.stop()
        httpServer = nil
        advertiser.stop()
        bonjourPublishing = false
    }

    private nonisolated static func handleHubRequest(
        method: String,
        path: String,
        hubDeviceId: String
    ) -> (Int, Data) {
        if method == "OPTIONS" {
            return (204, Data())
        }
        guard method == "GET" else {
            return (405, Data(#"{"error":"method_not_allowed"}"#.utf8))
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

        if path == PosLanProtocol.healthPath {
            let health = DemoSnapshotFactory.makeHealth()
            let data = (try? encoder.encode(health)) ?? Data(#"{"ok":false}"#.utf8)
            return (200, data)
        }

        if path == PosLanProtocol.snapshotPath {
            let snap = DemoSnapshotFactory.makeSnapshot(hubDeviceId: hubDeviceId)
            let data = (try? encoder.encode(snap)) ?? Data(#"{"error":"encode"}"#.utf8)
            return (200, data)
        }

        return (404, Data(#"{"error":"not_found"}"#.utf8))
    }

    private func connectHandheld(preferredHost: String? = nil) async {
        phase = .searching
        statusMessage = "Suche iPad-Kasse im WLAN …"
        snapshot = nil
        hubBaseURL = nil

        var candidates: [URL] = []
        if let preferredHost, !preferredHost.isEmpty {
            candidates.append(PosLanProtocol.hubBaseURL(host: preferredHost))
        } else if let saved = UserDefaults.standard.string(forKey: manualHostKey), !saved.isEmpty {
            candidates.append(PosLanProtocol.hubBaseURL(host: saved))
        }

        let discovered = await browser.scan(timeout: 4.5)
        for hub in discovered where !candidates.contains(hub.baseURL) {
            candidates.append(hub.baseURL)
        }

        guard !candidates.isEmpty else {
            phase = .error("Keine Kasse gefunden")
            statusMessage = "Keine Kasse im WLAN. iPad mit Gwada POS starten oder Hub-IP eintragen."
            return
        }

        var lastError: String?
        for base in candidates {
            do {
                statusMessage = "Verbinde \(base.host ?? "") …"
                _ = try await HandheldHubClient.fetchHealth(baseURL: base)
                let snap = try await HandheldHubClient.fetchSnapshot(
                    baseURL: base,
                    restaurantId: DemoSnapshotFactory.restaurantId
                )
                if let host = base.host {
                    UserDefaults.standard.set(host, forKey: manualHostKey)
                }
                hubBaseURL = base
                snapshot = snap
                phase = .connected
                statusMessage = "Verbunden mit \(snap.hub.displayName)."
                return
            } catch {
                lastError = error.localizedDescription
            }
        }

        phase = .error(lastError ?? "Kasse nicht erreichbar")
        statusMessage = lastError ?? "Kasse nicht erreichbar."
    }
}
