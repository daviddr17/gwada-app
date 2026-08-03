import XCTest
@testable import GwadaPOS

@MainActor
final class PosReviewNextStepsTests: XCTestCase {
    func test_shouldDeadLetter_permanent4xxAndMissingConfig() {
        XCTAssertTrue(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.missingConfig("Nest-URL"),
                attempts: 1
            )
        )
        XCTAssertTrue(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.httpStatus(400, "bad"),
                attempts: 1
            )
        )
        XCTAssertTrue(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.httpStatus(404, nil),
                attempts: 1
            )
        )
        XCTAssertTrue(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.offline,
                attempts: PosSyncQueue.maxFlushAttempts
            )
        )
    }

    func test_shouldDeadLetter_keepsFifoOnTransient() {
        XCTAssertFalse(
            PosSyncQueue.shouldDeadLetter(error: PosCloudError.offline, attempts: 1)
        )
        XCTAssertFalse(
            PosSyncQueue.shouldDeadLetter(error: PosCloudError.unauthorized, attempts: 3)
        )
        XCTAssertFalse(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.httpStatus(401, nil),
                attempts: 2
            )
        )
        XCTAssertFalse(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.httpStatus(503, "down"),
                attempts: 5
            )
        )
        XCTAssertFalse(
            PosSyncQueue.shouldDeadLetter(
                error: PosCloudError.httpStatus(429, nil),
                attempts: 1
            )
        )
    }

    func test_kdsHtml_embedsLanSecretHeaderUsage() {
        let html = String(data: KdsHubHTML.page(lanSecret: "secret-abc"), encoding: .utf8) ?? ""
        XCTAssertTrue(html.contains("X-Gwada-Pos-Lan-Secret"))
        XCTAssertTrue(html.contains("secret-abc"))
    }

    func test_lanProtocol_headerLanSecret_constant() {
        XCTAssertEqual(PosLanProtocol.headerLanSecret, "X-Gwada-Pos-Lan-Secret")
    }
}
