import XCTest
@testable import GwadaPOS

final class HubHTTPServerParseTests: XCTestCase {
    /// Baut eine rohe HTTP/1.1-Anfrage (Request-Line + mehrzeilige Header + JSON-Body) als `Data`.
    /// Mehrere Header-Zeilen sind wichtig: jedes `\r\n` im Header ist ein einzelner Swift-`Character`
    /// (Grapheme-Cluster), aber zwei Bytes — genau das ist die Quelle des Bugs.
    private func makeRequest(body: String, path: String = "/v1/pair/request") -> Data {
        let bodyBytes = Array(body.utf8)
        let head = [
            "POST \(path) HTTP/1.1",
            "Host: 127.0.0.1:8787",
            "X-Pos-Protocol: 1",
            "Content-Type: application/json",
            "Content-Length: \(bodyBytes.count)",
        ].joined(separator: "\r\n")
        var data = Data((head + "\r\n\r\n").utf8)
        data.append(Data(bodyBytes))
        return data
    }

    func test_parseRequest_extractsByteAccurateBody() throws {
        let json = #"{"deviceName":"x","installationId":"yyyyyyyy"}"#
        let request = makeRequest(body: json)

        let parsed = try XCTUnwrap(HubHTTPServer.parseRequest(request))

        XCTAssertEqual(parsed.method, "POST")
        XCTAssertEqual(parsed.pathWithQuery, "/v1/pair/request")
        XCTAssertEqual(parsed.headers["content-length"], "\(json.utf8.count)")

        let decodedBody = String(data: parsed.body, encoding: .utf8)
        XCTAssertEqual(decodedBody, json)
    }

    func test_parseRequest_returnsNilForTruncatedBody() {
        let json = #"{"deviceName":"x","installationId":"yyyyyyyy"}"#
        var request = makeRequest(body: json)
        // Simuliert einen Receive-Loop-Zwischenstand: Body noch nicht vollständig eingetroffen.
        request.removeLast(5)

        XCTAssertNil(HubHTTPServer.parseRequest(request))
    }
}
