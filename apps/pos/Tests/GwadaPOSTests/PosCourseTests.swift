import XCTest
@testable import GwadaPOS

final class PosCourseTests: XCTestCase {
    func testParseLegacy() {
        XCTAssertEqual(PosCourse.parse("starter"), 1)
        XCTAssertEqual(PosCourse.parse("main"), 2)
        XCTAssertEqual(PosCourse.parse("side"), 2)
        XCTAssertEqual(PosCourse.parse("3"), 3)
        XCTAssertEqual(PosCourse.parse(nil), 2)
    }

    func testLabels() {
        XCTAssertEqual(PosCourse.label(1), "Vorspeise")
        XCTAssertEqual(PosCourse.label(4), "Gang 4")
    }

    func testCloudCourseDtosDecodeNumericCourses() throws {
        let decoder = JSONDecoder()
        let summary = try decoder.decode(
            PosCloudSessionSummaryLine.self,
            from: Data("""
            {
              "id": "summary-line",
              "orderId": "order-1",
              "name": "Dessert",
              "quantity": 1,
              "paidQuantity": 0,
              "openQuantity": 1,
              "openAmountCents": 600,
              "unitPriceCents": 600,
              "course": 3
            }
            """.utf8)
        )
        let tickets = try decoder.decode(
            PosCloudClient.KdsTicketsResponse.self,
            from: Data("""
            {
              "tickets": [{
                "orderId": "order-1",
                "orderNumber": 1,
                "status": "open",
                "lines": [{
                  "id": "ticket-line",
                  "name": "Dessert",
                  "quantity": 1,
                  "course": 3
                }]
              }]
            }
            """.utf8)
        )
        let advance = try decoder.decode(
            PosCloudClient.KdsAdvanceResponse.self,
            from: Data("""
            {
              "lines": [{
                "id": "advance-line",
                "name": "Dessert",
                "quantity": 1,
                "course": 3
              }]
            }
            """.utf8)
        )

        XCTAssertEqual(summary.course, 3)
        XCTAssertEqual(tickets.tickets[0].lines[0].course, 3)
        XCTAssertEqual(advance.lines?[0].course, 3)
    }

    func testCloudCourseDtosDecodeLegacyStringCourses() throws {
        let decoder = JSONDecoder()
        let summary = try decoder.decode(
            PosCloudSessionSummaryLine.self,
            from: Data("""
            {
              "id": "summary-line",
              "orderId": "order-1",
              "name": "Starter",
              "quantity": 1,
              "paidQuantity": 0,
              "openQuantity": 1,
              "openAmountCents": 500,
              "unitPriceCents": 500,
              "course": "starter"
            }
            """.utf8)
        )
        let tickets = try decoder.decode(
            PosCloudClient.KdsTicketsResponse.self,
            from: Data("""
            {
              "tickets": [{
                "orderId": "order-1",
                "orderNumber": 1,
                "status": "open",
                "lines": [{
                  "id": "ticket-line",
                  "name": "Starter",
                  "quantity": 1,
                  "course": "starter"
                }]
              }]
            }
            """.utf8)
        )
        let advance = try decoder.decode(
            PosCloudClient.KdsAdvanceResponse.self,
            from: Data("""
            {
              "lines": [{
                "id": "advance-line",
                "name": "Starter",
                "quantity": 1,
                "course": "starter"
              }]
            }
            """.utf8)
        )

        XCTAssertEqual(summary.course, 1)
        XCTAssertEqual(tickets.tickets[0].lines[0].course, 1)
        XCTAssertEqual(advance.lines?[0].course, 1)
    }

    func testSyncFireCoursePayloadDecodesLegacyStringCourse() throws {
        let payload = try JSONDecoder().decode(
            PosSyncFireCoursePayload.self,
            from: Data("""
            {
              "restaurantId": "restaurant-1",
              "tableSessionId": "session-1",
              "course": "main",
              "fireAttemptId": "attempt-1"
            }
            """.utf8)
        )

        XCTAssertEqual(payload.course, 2)
    }

    func testSyncFireCoursePayloadDecodesNumericCourse() throws {
        let payload = try JSONDecoder().decode(
            PosSyncFireCoursePayload.self,
            from: Data("""
            {
              "restaurantId": "restaurant-1",
              "tableSessionId": "session-1",
              "course": 2,
              "fireAttemptId": "attempt-1"
            }
            """.utf8)
        )

        XCTAssertEqual(payload.course, 2)
    }

    func testSyncFireCoursePayloadEncodesNumericCourse() throws {
        let data = try JSONEncoder().encode(
            PosSyncFireCoursePayload(
                restaurantId: "restaurant-1",
                tableSessionId: "session-1",
                course: 2,
                fireAttemptId: "attempt-1"
            )
        )
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(json?["course"] as? Int, 2)
    }
}
