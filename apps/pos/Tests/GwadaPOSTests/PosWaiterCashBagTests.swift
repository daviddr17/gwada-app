import XCTest
@testable import GwadaPOS

final class PosWaiterCashBagTests: XCTestCase {
    override func tearDown() {
        PosHubState.shared.resetForFactoryReset()
        PosLocalStore.saveCashBags([])
        PosLocalStore.saveCashBagMovements([])
        PosLocalStore.flushForTests()
        super.tearDown()
    }

    func testExpectedCents_openingPlusSalesMinusDrops() {
        let movements = [
            PosCashBagMovement(
                id: "m1",
                cashBagId: "bag-1",
                kind: "float_out",
                amountCents: 10_000,
                idempotencyKey: "issue-1"
            ),
            PosCashBagMovement(
                id: "m2",
                cashBagId: "bag-1",
                kind: "cash_sale",
                amountCents: 5_000,
                idempotencyKey: "sale-1"
            ),
            PosCashBagMovement(
                id: "m3",
                cashBagId: "bag-1",
                kind: "drop_in",
                amountCents: 2_000,
                idempotencyKey: nil
            ),
        ]
        XCTAssertEqual(
            PosCashBagMath.expectedCents(openingFloatCents: 10_000, movements: movements),
            13_000
        )
    }

    func testIssueLocalCashBag_createsOpenBagOncePerStaff() {
        let hub = makeHub(registerOpen: true)

        let first = hub.issueLocalCashBag(
            staffProfileId: "staff-a",
            openingFloatCents: 5_000,
            issuedBy: "manager-1",
            idempotencyKey: "issue-a-1"
        )
        guard case .success(let bag) = first else {
            return XCTFail("expected success, got \(first)")
        }
        XCTAssertEqual(bag.staffProfileId, "staff-a")
        XCTAssertEqual(bag.status, .open)
        XCTAssertEqual(bag.openingFloatCents, 5_000)
        XCTAssertEqual(bag.registerSessionId, "register-1")
        XCTAssertEqual(hub.openCashBag(for: "staff-a")?.id, bag.id)

        let second = hub.issueLocalCashBag(
            staffProfileId: "staff-a",
            openingFloatCents: 1_000,
            issuedBy: "manager-1",
            idempotencyKey: "issue-a-2"
        )
        XCTAssertEqual(second, .failure(.alreadyOpen))
    }

    func testIssueLocalCashBag_idempotentReplay() {
        let hub = makeHub(registerOpen: true)
        let first = hub.issueLocalCashBag(
            staffProfileId: "staff-b",
            openingFloatCents: 2_000,
            issuedBy: "manager-1",
            idempotencyKey: "same-key"
        )
        let second = hub.issueLocalCashBag(
            staffProfileId: "staff-b",
            openingFloatCents: 9_999,
            issuedBy: "manager-1",
            idempotencyKey: "same-key"
        )
        guard case .success(let a) = first, case .success(let b) = second else {
            return XCTFail("expected replay success")
        }
        XCTAssertEqual(a.id, b.id)
        XCTAssertEqual(a.openingFloatCents, 2_000)
    }

    func testIssueLocalCashBag_requiresOpenRegister() {
        let hub = makeHub(registerOpen: false)
        let result = hub.issueLocalCashBag(
            staffProfileId: "staff-c",
            openingFloatCents: 1_000,
            issuedBy: "manager-1",
            idempotencyKey: "issue-closed"
        )
        XCTAssertEqual(result, .failure(.noOpenRegister))
    }

    func testApplyLocalCashSale_andCloseWithManagerOverride() {
        let hub = makeHub(registerOpen: true)
        let issued = hub.issueLocalCashBag(
            staffProfileId: "cashier-1",
            openingFloatCents: 10_000,
            issuedBy: "manager-1",
            idempotencyKey: "issue-sale"
        )
        guard case .success(let bag) = issued else {
            return XCTFail("issue failed: \(issued)")
        }

        let sale = hub.applyLocalCashSale(
            cashierProfileId: "cashier-1",
            amountCents: 5_000,
            paymentId: "pay-1",
            idempotencyKey: "cash_sale:pay-1"
        )
        XCTAssertEqual(sale, .success(bag.id))

        let closeNeedsPin = hub.closeLocalCashBag(
            bagId: bag.id,
            countCents: 12_000,
            thresholdCents: 500,
            managerOverride: false
        )
        // expected 15_000, count 12_000 → |diff| 3000 >= 500
        XCTAssertEqual(closeNeedsPin, .failure(.managerPinRequired))

        let closed = hub.closeLocalCashBag(
            bagId: bag.id,
            countCents: 12_000,
            thresholdCents: 500,
            managerOverride: true
        )
        XCTAssertEqual(closed, .success(-3_000))
        XCTAssertNil(hub.openCashBag(for: "cashier-1"))
    }

    func testHandoverLocalCashBag_transfersExpectedFloat() {
        let hub = makeHub(registerOpen: true)
        _ = hub.issueLocalCashBag(
            staffProfileId: "from-staff",
            openingFloatCents: 8_000,
            issuedBy: "manager-1",
            idempotencyKey: "issue-from"
        )
        _ = hub.applyLocalCashSale(
            cashierProfileId: "from-staff",
            amountCents: 2_000,
            paymentId: "pay-h",
            idempotencyKey: "cash_sale:pay-h"
        )

        let handed = hub.handoverLocalCashBag(from: "from-staff", to: "to-staff")
        guard case .success(let toBag) = handed else {
            return XCTFail("handover failed: \(handed)")
        }
        XCTAssertEqual(toBag.staffProfileId, "to-staff")
        XCTAssertEqual(toBag.status, .open)
        XCTAssertEqual(toBag.openingFloatCents, 10_000)
        XCTAssertNil(hub.openCashBag(for: "from-staff"))
        XCTAssertEqual(hub.openCashBag(for: "to-staff")?.id, toBag.id)

        let targetBusy = hub.handoverLocalCashBag(from: "to-staff", to: "to-staff")
        XCTAssertEqual(targetBusy, .failure(.targetHasOpenBag))
    }

    /// Documents cash-bag staff key = `profiles.id`, not `restaurant_staff.id`.
    func testCashBagStaffKey_prefersProfileIdOverRestaurantStaffId() {
        let restaurantStaffId = "11111111-2222-3333-4444-555555555555"
        let profileId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        XCTAssertNotEqual(restaurantStaffId, profileId)

        let rosterStaff = PosAuthRosterStaff(
            id: restaurantStaffId,
            given_name: "Anna",
            family_name: "Waiter",
            profile_id: profileId,
            position_name: "Service",
            offline_pin_hash: "deadbeef",
            permissions: ["pos.kasse.use"]
        )
        XCTAssertEqual(rosterStaff.cashBagProfileId, profileId)

        let session = PosPinSession(
            sessionId: "sess-1",
            sessionToken: "tok",
            staffId: restaurantStaffId,
            staffName: "Anna Waiter",
            profileId: profileId,
            permissionKeys: ["pos.kasse.use"],
            isOffline: true
        )
        XCTAssertEqual(session.cashBagProfileId, profileId)

        let hub = makeHub(registerOpen: true)
        let issued = hub.issueLocalCashBag(
            staffProfileId: profileId,
            openingFloatCents: 1_000,
            issuedBy: "manager-profile",
            idempotencyKey: "issue-profile-ns"
        )
        guard case .success(let bag) = issued else {
            return XCTFail("issue failed: \(issued)")
        }
        XCTAssertEqual(bag.staffProfileId, profileId)
        XCTAssertNil(hub.openCashBag(for: restaurantStaffId))
        XCTAssertEqual(hub.openCashBag(for: profileId)?.id, bag.id)
    }

    private func makeHub(registerOpen: Bool) -> PosHubState {
        let hub = PosHubState.shared
        hub.resetForFactoryReset()
        PosLocalStore.saveOpenLines([:])
        PosLocalStore.saveKassierenLocks([:])
        PosLocalStore.saveCashBags([])
        PosLocalStore.saveCashBagMovements([])
        PosLocalStore.flushForTests()
        hub.configure(hubDeviceId: "cash-bag-test-hub")
        var boot = DemoSnapshotFactory.makeBootstrap(hubDeviceId: "cash-bag-test-hub")
        if !registerOpen {
            boot.register = PosCloudRegisterStatus(isOpen: false, sessionId: nil, openedAt: nil)
        }
        hub.applyBootstrap(boot)
        return hub
    }
}
