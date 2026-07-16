import Foundation
import Network

/// Raw-TCP ESC/POS an feste LAN-IP (typisch Port 9100). Kurze Timeouts, kein UI-Block.
enum PosNetworkPrinterClient {
    enum PrintError: Error, LocalizedError {
        case invalidHost
        case connectTimeout
        case sendFailed(String)

        var errorDescription: String? {
            switch self {
            case .invalidHost: return "Ungültige Drucker-IP"
            case .connectTimeout: return "Drucker nicht erreichbar"
            case .sendFailed(let m): return m
            }
        }
    }

    static func send(
        host: String,
        port: UInt16,
        payload: Data,
        timeoutMs: Int = 1500
    ) async throws {
        let cleaned = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { throw PrintError.invalidHost }

        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                try await sendOnce(host: cleaned, port: port, payload: payload)
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
                throw PrintError.connectTimeout
            }
            _ = try await group.next()
            group.cancelAll()
        }
    }

    private static func sendOnce(host: String, port: UInt16, payload: Data) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: port) ?? 9100
            )
            let conn = NWConnection(to: endpoint, using: .tcp)
            let lock = NSLock()
            var settled = false

            func finish(_ result: Result<Void, Error>) {
                lock.lock()
                defer { lock.unlock() }
                guard !settled else { return }
                settled = true
                conn.cancel()
                switch result {
                case .success: cont.resume()
                case .failure(let e): cont.resume(throwing: e)
                }
            }

            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    conn.send(
                        content: payload,
                        completion: .contentProcessed { error in
                            if let error {
                                finish(.failure(PrintError.sendFailed(error.localizedDescription)))
                            } else {
                                finish(.success(()))
                            }
                        }
                    )
                case .failed(let error):
                    finish(.failure(PrintError.sendFailed(error.localizedDescription)))
                default:
                    break
                }
            }

            conn.start(queue: DispatchQueue.global(qos: .userInitiated))
        }
    }
}
