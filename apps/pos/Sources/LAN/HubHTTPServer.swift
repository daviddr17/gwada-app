import Foundation
import Network

/// Minimaler HTTP/1.1-Server für die iPad-Kasse (Network.framework).
final class HubHTTPServer: @unchecked Sendable {
    typealias Handler = @Sendable (String, String, [String: String], Data) -> (status: Int, body: Data)

    private let port: NWEndpoint.Port
    private let handler: Handler
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "app.gwada.pos.hub-http")

    init(port: UInt16 = PosLanProtocol.hubPort, handler: @escaping Handler) {
        self.port = NWEndpoint.Port(rawValue: port)!
        self.handler = handler
    }

    func start() throws {
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        let listener = try NWListener(using: parameters, on: port)
        self.listener = listener

        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }

        listener.stateUpdateHandler = { state in
            if case let .failed(error) = state {
                print("[HubHTTP] listener failed: \(error)")
            }
        }

        listener.start(queue: queue)
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receive(on: connection, buffer: Data())
    }

    private func receive(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 256 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if let error {
                print("[HubHTTP] receive error: \(error)")
                connection.cancel()
                return
            }

            var next = buffer
            if let data, !data.isEmpty {
                next.append(data)
            }

            if let request = Self.parseRequest(next) {
                let result = self.handler(request.method, request.pathWithQuery, request.headers, request.body)
                let response = Self.serializeResponse(status: result.status, body: result.body)
                connection.send(content: response, completion: .contentProcessed { _ in
                    connection.cancel()
                })
                return
            }

            if isComplete {
                connection.cancel()
                return
            }

            self.receive(on: connection, buffer: next)
        }
    }

    struct ParsedRequest {
        var method: String
        /// Path inkl. Query (z. B. `/v1/reservations?day=2026-07-17`).
        var pathWithQuery: String
        var headers: [String: String]
        var body: Data
    }

    private static let headerDelimiter = Data([0x0D, 0x0A, 0x0D, 0x0A])

    static func parseRequest(_ data: Data) -> ParsedRequest? {
        // Der Header/Body-Trenner muss auf den rohen Bytes gesucht werden: "\r\n" ist in
        // Swift-Strings EIN Character (Grapheme-Cluster), aber ZWEI Bytes. Ein über
        // `raw.distance(...)` gezählter Offset würde daher pro CRLF im Header um 1 Byte
        // zu wenig zählen und die Body-Slice aus `data` verschieben/korrumpieren.
        guard let delimiterRange = data.range(of: headerDelimiter) else { return nil }
        let bodyStart = delimiterRange.upperBound

        guard let raw = String(data: data[..<delimiterRange.lowerBound], encoding: .utf8) else { return nil }
        let lines = raw.split(separator: "\r\n", omittingEmptySubsequences: false).map(String.init)
        guard let requestLine = lines.first else { return nil }
        let parts = requestLine.split(separator: " ")
        guard parts.count >= 2 else { return nil }
        let method = String(parts[0]).uppercased()
        let pathWithQuery = String(parts[1])

        var contentLength = 0
        for line in lines.dropFirst() {
            let lower = line.lowercased()
            if lower.hasPrefix("content-length:") {
                let value = line.split(separator: ":", maxSplits: 1).last?
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? "0"
                contentLength = Int(value) ?? 0
            }
        }

        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            if !key.isEmpty { headers[key] = value }
        }

        guard data.count >= bodyStart + contentLength else { return nil }
        let body = data.subdata(in: bodyStart ..< (bodyStart + contentLength))
        return ParsedRequest(method: method, pathWithQuery: pathWithQuery, headers: headers, body: body)
    }

    private static func serializeResponse(status: Int, body: Data) -> Data {
        let statusText: String
        switch status {
        case 200: statusText = "OK"
        case 201: statusText = "Created"
        case 204: statusText = "No Content"
        case 400: statusText = "Bad Request"
        case 404: statusText = "Not Found"
        case 405: statusText = "Method Not Allowed"
        case 401: statusText = "Unauthorized"
        case 503: statusText = "Service Unavailable"
        default: statusText = "Error"
        }

        let isHTML = body.starts(with: Data("<!doctype html>".utf8)) || body.starts(with: Data("<!DOCTYPE html>".utf8))
        let contentType = isHTML ? "text/html; charset=utf-8" : "application/json; charset=utf-8"
        let header = """
        HTTP/1.1 \(status) \(statusText)\r
        Content-Type: \(contentType)\r
        Content-Length: \(body.count)\r
        Connection: close\r
        Access-Control-Allow-Origin: *\r
        Access-Control-Allow-Methods: GET, POST, OPTIONS\r
        Access-Control-Allow-Headers: Content-Type, \(PosLanProtocol.headerProtocol), \(PosLanProtocol.headerRestaurantId), \(PosLanProtocol.headerPairToken)\r
        \(PosLanProtocol.headerProtocol): \(PosLanProtocol.version)\r
        \r
        """
        var response = Data(header.utf8)
        response.append(body)
        return response
    }
}
