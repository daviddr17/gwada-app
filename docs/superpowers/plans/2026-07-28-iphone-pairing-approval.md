# iPhone Pairing & Approval (Schritt 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein iPhone koppelt sich per LAN an den iPad-Hub, wird am iPad einzeln freigegeben (Code-Abgleich) und erhält einen Pairing-Token, den der Hub auf den Daten-Endpunkten erzwingt.

**Architecture:** LAN-only (Ansatz A). Der Hub (`HubHTTPServer` in `PosRuntime.startHub`) hält Pending-Kopplungen und genehmigte Tokens in einem thread-sicheren `PosPairingStore` (NSLock, `@unchecked Sendable`, aufrufbar aus dem nicht-isolierten HTTP-Handler). Das iPhone fragt an, pollt Status, erhält nach Freigabe einen Token und sendet ihn als Header `X-Gwada-Pair-Token` bei allen Daten-Requests.

**Tech Stack:** Swift 5, SwiftUI, Network.framework, XCTest, XcodeGen. Ziel iOS 17. Getestet im Simulator (iPhone-Sim → iPad-Sim über `127.0.0.1:8787`).

## Global Constraints

- Deployment-Target iOS 17.0; Swift 5.0; XcodeGen erzeugt `GwadaPOS.xcodeproj` aus `apps/pos/project.yml` (nach jeder project.yml-Änderung `xcodegen generate` im `apps/pos`-Verzeichnis).
- Bonjour funktioniert **nicht** zwischen zwei Simulatoren — der manuelle Host-Pfad (`127.0.0.1:8787`) ist der testbare Weg auf einem Mac.
- `HubHTTPServer`-Routing-Handler ist `nonisolated static` und läuft off-main → jeder darin genutzte Store muss thread-sicher sein (Muster: `PosHubState`, `@unchecked Sendable` + `NSLock`).
- Alle neuen LAN-DTOs: `Codable, Equatable, Sendable`.
- Bestehende offene Endpunkte bleiben offen: `/v1/health` (Discovery) und `/v1/kds` (Browser-HTML). Token-pflichtig: `/v1/snapshot`, `/v1/sessions`, `/v1/orders`, `/v1/reservations`, `/v1/kds/tickets`.
- Build-Kommando (Sim): `xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build` (Verzeichnis `apps/pos`).
- Test-Kommando: `xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'` (nach Test-Target in Task 2).
- Keine `Co-Authored-By`-Zeilen in Commits.

---

## File Structure

**Neu:**
- `apps/pos/Sources/LAN/PosPairingModels.swift` — Pairing-DTOs (Wire-Contract)
- `apps/pos/Sources/LAN/PosLanAuth.swift` — reine Funktion: welche Pfade Token brauchen
- `apps/pos/Sources/Store/PosPairingStore.swift` — Hub-seitige State-Machine (thread-safe)
- `apps/pos/Sources/UI/HubPairingApprovalsView.swift` — iPad-Freigabe-UI
- `apps/pos/Tests/GwadaPOSTests/PosPairingStoreTests.swift` — Unit-Tests State-Machine
- `apps/pos/Tests/GwadaPOSTests/PosLanAuthTests.swift` — Unit-Tests Auth-Regel
- `apps/pos/Tests/GwadaPOSTests/PosLanPairingCodableTests.swift` — DTO-Round-Trip
- `apps/pos/Tests/GwadaPOSTests/PosEnrollmentStoreTests.swift` — Token-Persistenz

**Geändert:**
- `apps/pos/Sources/LAN/PosLanProtocol.swift` — neue Pfade + Header-Konstante
- `apps/pos/Sources/LAN/HubHTTPServer.swift` — Handler-Signatur um Header, 401, CORS-Header
- `apps/pos/Sources/LAN/HandheldHubClient.swift` — Token-Header + `requestPairing`/`pairingStatus`
- `apps/pos/Sources/App/PosRuntime.swift` — Routing (Pair-Endpunkte + Enforcement), Handheld-Pairing-Flow, Runtime-State
- `apps/pos/Sources/Store/PosEnrollmentStore.swift` — Token + Hub-BaseURL persistieren
- `apps/pos/Sources/UI/HandheldPairingGateView.swift` — manuelles Host-Feld + Warte-auf-Freigabe-Zustand
- `apps/pos/Sources/UI/RootView.swift` — iPad-Approvals-Einstieg (Hub-Toolbar)
- `apps/pos/project.yml` — XCTest-Target

---

## Task 1: Pairing-Protokoll & DTOs

**Files:**
- Modify: `apps/pos/Sources/LAN/PosLanProtocol.swift`
- Create: `apps/pos/Sources/LAN/PosPairingModels.swift`

**Interfaces:**
- Produces: `PosLanProtocol.pairRequestPath` = `"/v1/pair/request"`, `PosLanProtocol.pairStatusPath` = `"/v1/pair/status"`, `PosLanProtocol.headerPairToken` = `"X-Gwada-Pair-Token"`; DTOs `PosLanPairRequest{deviceName,installationId}`, `PosLanPairChallenge{pairId,verificationCode}`, `PosLanPairStatus{state,token?,hub?}`, enum `PosLanPairState: String {pending,approved,rejected,expired}`.

- [ ] **Step 1: Add protocol constants**

In `apps/pos/Sources/LAN/PosLanProtocol.swift`, after the `printJobsPath` line, add:

```swift
    static let pairRequestPath = "/v1/pair/request"
    static let pairStatusPath = "/v1/pair/status"
```

After the `headerRestaurantId` line, add:

```swift
    static let headerPairToken = "X-Gwada-Pair-Token"
```

- [ ] **Step 2: Create DTO file**

Create `apps/pos/Sources/LAN/PosPairingModels.swift`:

```swift
import Foundation

enum PosLanPairState: String, Codable, Sendable {
    case pending
    case approved
    case rejected
    case expired
}

/// iPhone → Hub: Kopplungsanfrage.
struct PosLanPairRequest: Codable, Equatable, Sendable {
    var deviceName: String
    var installationId: String
}

/// Hub → iPhone: Antwort auf die Anfrage (Code zum Abgleich am iPad).
struct PosLanPairChallenge: Codable, Equatable, Sendable {
    var pairId: String
    var verificationCode: String
}

/// Hub → iPhone: Poll-Ergebnis.
struct PosLanPairStatus: Codable, Equatable, Sendable {
    var state: PosLanPairState
    var token: String?
    var hub: PosLanHubInfo?
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/pos/Tests/GwadaPOSTests/PosLanPairingCodableTests.swift` (test target follows in Task 2 — write the file now):

```swift
import XCTest
@testable import GwadaPOS

final class PosLanPairingCodableTests: XCTestCase {
    func test_pairStatus_roundTrips() throws {
        let status = PosLanPairStatus(
            state: .approved,
            token: "tok_abc",
            hub: PosLanHubInfo(deviceId: "d1", displayName: "Kasse", role: "hub")
        )
        let data = try JSONEncoder().encode(status)
        let decoded = try JSONDecoder().decode(PosLanPairStatus.self, from: data)
        XCTAssertEqual(decoded, status)
        XCTAssertEqual(decoded.state, .approved)
        XCTAssertEqual(decoded.token, "tok_abc")
    }

    func test_pairState_decodesRawString() throws {
        let json = Data(#"{"state":"pending"}"#.utf8)
        let decoded = try JSONDecoder().decode(PosLanPairStatus.self, from: json)
        XCTAssertEqual(decoded.state, .pending)
        XCTAssertNil(decoded.token)
    }
}
```

- [ ] **Step 4: Commit (test runs in Task 2 once the target exists)**

```bash
cd apps/pos
git add Sources/LAN/PosLanProtocol.swift Sources/LAN/PosPairingModels.swift Tests/GwadaPOSTests/PosLanPairingCodableTests.swift
git commit -m "feat(pos): LAN-Pairing-Protokoll + DTOs"
```

---

## Task 2: XCTest-Target + PosPairingStore (State-Machine)

**Files:**
- Modify: `apps/pos/project.yml`
- Create: `apps/pos/Sources/Store/PosPairingStore.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosPairingStoreTests.swift`

**Interfaces:**
- Consumes: `PosLanPairRequest`, `PosLanPairChallenge`, `PosLanPairStatus`, `PosLanPairState`, `PosLanHubInfo` (Task 1).
- Produces: `PosPairingStore.shared`; `func createPending(_ req: PosLanPairRequest) -> PosLanPairChallenge`; `func status(pairId: String) -> PosLanPairStatus`; `func approve(pairId: String) -> String?` (token); `func reject(pairId: String)`; `func verify(token: String) -> Bool`; `func revoke(token: String)`; `struct PendingPairing{pairId,deviceName,installationId,verificationCode,createdAt}`; `struct ApprovedDevice{installationId,deviceName,token,approvedAt}`; `func pendingList() -> [PendingPairing]`; `func approvedList() -> [ApprovedDevice]`; `func configureHubInfo(_ info: PosLanHubInfo)`; `var pendingTTL: TimeInterval` (default 300); testbarer Zeit-Hook `now: () -> Date`.

- [ ] **Step 1: Add test target to project.yml**

In `apps/pos/project.yml`, under `targets:` after the `GwadaPOS:` block, add:

```yaml
  GwadaPOSTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - path: Tests/GwadaPOSTests
    dependencies:
      - target: GwadaPOS
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: app.gwada.pos.tests
        GENERATE_INFOPLIST_FILE: true
```

Under `schemes: > GwadaPOS: > build: > targets:` add the test target, and add a `test:` block. Replace the existing `schemes:` block with:

```yaml
schemes:
  GwadaPOS:
    build:
      targets:
        GwadaPOS: all
        GwadaPOSTests: [test]
    run:
      config: Debug
    test:
      targets:
        - GwadaPOSTests
```

- [ ] **Step 2: Regenerate the Xcode project**

Run: `cd apps/pos && xcodegen generate`
Expected: `Created project at .../apps/pos/GwadaPOS.xcodeproj`, no error.

- [ ] **Step 3: Write the failing test**

Create `apps/pos/Tests/GwadaPOSTests/PosPairingStoreTests.swift`:

```swift
import XCTest
@testable import GwadaPOS

final class PosPairingStoreTests: XCTestCase {
    private func makeStore(now: @escaping () -> Date = { Date() }) -> PosPairingStore {
        let store = PosPairingStore(now: now)
        store.configureHubInfo(PosLanHubInfo(deviceId: "hub1", displayName: "Kasse", role: "hub"))
        return store
    }

    private var req: PosLanPairRequest {
        PosLanPairRequest(deviceName: "iPhone Test", installationId: "install-123")
    }

    func test_createPending_producesSixDigitCodeAndPendingStatus() {
        let store = makeStore()
        let challenge = store.createPending(req)
        XCTAssertEqual(challenge.verificationCode.count, 6)
        XCTAssertTrue(challenge.verificationCode.allSatisfy(\.isNumber))
        XCTAssertEqual(store.status(pairId: challenge.pairId).state, .pending)
        XCTAssertEqual(store.pendingList().count, 1)
    }

    func test_approve_issuesTokenAndStatusApproved() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)
        XCTAssertNotNil(token)
        let status = store.status(pairId: challenge.pairId)
        XCTAssertEqual(status.state, .approved)
        XCTAssertEqual(status.token, token)
        XCTAssertEqual(store.pendingList().count, 0)
        XCTAssertEqual(store.approvedList().count, 1)
    }

    func test_verify_trueOnlyForIssuedToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        XCTAssertTrue(store.verify(token: token))
        XCTAssertFalse(store.verify(token: "nope"))
    }

    func test_reject_setsRejectedNoToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        store.reject(pairId: challenge.pairId)
        let status = store.status(pairId: challenge.pairId)
        XCTAssertEqual(status.state, .rejected)
        XCTAssertNil(status.token)
    }

    func test_pendingExpiresAfterTTL() {
        var current = Date(timeIntervalSince1970: 1_000_000)
        let store = makeStore(now: { current })
        let challenge = store.createPending(req)
        current = current.addingTimeInterval(store.pendingTTL + 1)
        XCTAssertEqual(store.status(pairId: challenge.pairId).state, .expired)
        XCTAssertEqual(store.pendingList().count, 0)
    }

    func test_revoke_invalidatesToken() {
        let store = makeStore()
        let challenge = store.createPending(req)
        let token = store.approve(pairId: challenge.pairId)!
        store.revoke(token: token)
        XCTAssertFalse(store.verify(token: token))
        XCTAssertEqual(store.approvedList().count, 0)
    }

    func test_unknownPairId_isRejected() {
        let store = makeStore()
        XCTAssertEqual(store.status(pairId: "unknown").state, .rejected)
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -20`
Expected: FAIL — `cannot find 'PosPairingStore' in scope`.

- [ ] **Step 5: Implement PosPairingStore**

Create `apps/pos/Sources/Store/PosPairingStore.swift`:

```swift
import Foundation

/// Hub-seitige Kopplungs-State-Machine (thread-safe, aus HTTP-Handler nutzbar).
final class PosPairingStore: @unchecked Sendable {
    static let shared = PosPairingStore()

    struct PendingPairing: Sendable, Equatable {
        var pairId: String
        var deviceName: String
        var installationId: String
        var verificationCode: String
        var createdAt: Date
    }

    struct ApprovedDevice: Sendable, Equatable {
        var installationId: String
        var deviceName: String
        var token: String
        var approvedAt: Date
    }

    let pendingTTL: TimeInterval = 300

    private let lock = NSLock()
    private let now: () -> Date
    private var pending: [String: PendingPairing] = [:]
    private var rejected: Set<String> = []
    private var approvedByPair: [String: ApprovedDevice] = [:]
    private var validTokens: Set<String> = []
    private var hubInfo: PosLanHubInfo?

    init(now: @escaping () -> Date = { Date() }) {
        self.now = now
    }

    func configureHubInfo(_ info: PosLanHubInfo) {
        lock.lock(); defer { lock.unlock() }
        hubInfo = info
    }

    func createPending(_ req: PosLanPairRequest) -> PosLanPairChallenge {
        lock.lock(); defer { lock.unlock() }
        let pairId = UUID().uuidString
        let code = String(format: "%06d", Int.random(in: 0...999_999))
        pending[pairId] = PendingPairing(
            pairId: pairId,
            deviceName: req.deviceName,
            installationId: req.installationId,
            verificationCode: code,
            createdAt: now()
        )
        return PosLanPairChallenge(pairId: pairId, verificationCode: code)
    }

    func status(pairId: String) -> PosLanPairStatus {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        if let approved = approvedByPair[pairId] {
            return PosLanPairStatus(state: .approved, token: approved.token, hub: hubInfo)
        }
        if pending[pairId] != nil {
            return PosLanPairStatus(state: .pending, token: nil, hub: nil)
        }
        // unbekannt/abgelaufen/abgelehnt → nicht mehr wartend
        return PosLanPairStatus(state: .rejected, token: nil, hub: nil)
    }

    @discardableResult
    func approve(pairId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        guard let p = pending.removeValue(forKey: pairId) else { return nil }
        let token = Self.makeToken()
        approvedByPair[pairId] = ApprovedDevice(
            installationId: p.installationId,
            deviceName: p.deviceName,
            token: token,
            approvedAt: now()
        )
        validTokens.insert(token)
        return token
    }

    func reject(pairId: String) {
        lock.lock(); defer { lock.unlock() }
        pending.removeValue(forKey: pairId)
        rejected.insert(pairId)
    }

    func verify(token: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return validTokens.contains(token)
    }

    func revoke(token: String) {
        lock.lock(); defer { lock.unlock() }
        validTokens.remove(token)
        approvedByPair = approvedByPair.filter { $0.value.token != token }
    }

    func pendingList() -> [PendingPairing] {
        lock.lock(); defer { lock.unlock() }
        expireLocked()
        return pending.values.sorted { $0.createdAt < $1.createdAt }
    }

    func approvedList() -> [ApprovedDevice] {
        lock.lock(); defer { lock.unlock() }
        return approvedByPair.values.sorted { $0.approvedAt < $1.approvedAt }
    }

    // MARK: - Intern (lock muss gehalten sein)

    private func expireLocked() {
        let cutoff = now().addingTimeInterval(-pendingTTL)
        pending = pending.filter { $0.value.createdAt >= cutoff }
    }

    private static func makeToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -20`
Expected: PASS — `PosPairingStoreTests` + `PosLanPairingCodableTests` grün (`** TEST SUCCEEDED **`).

- [ ] **Step 7: Commit**

```bash
cd apps/pos
git add project.yml GwadaPOS.xcodeproj Sources/Store/PosPairingStore.swift Tests/GwadaPOSTests/PosPairingStoreTests.swift
git commit -m "feat(pos): PosPairingStore State-Machine + XCTest-Target"
```

---

## Task 3: HubHTTPServer — Header-Durchreichung + 401 + PosLanAuth

**Files:**
- Modify: `apps/pos/Sources/LAN/HubHTTPServer.swift`
- Create: `apps/pos/Sources/LAN/PosLanAuth.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosLanAuthTests.swift`

**Interfaces:**
- Consumes: `PosLanProtocol` paths (Task 1).
- Produces: `HubHTTPServer.Handler = @Sendable (String, String, [String: String], Data) -> (status: Int, body: Data)` (Header-Dict, lowercased keys); `enum PosLanAuth { static func requiresToken(pathOnly: String) -> Bool }`; `HubHTTPServer` liefert bei Status 401 den Text `Unauthorized` und listet `X-Gwada-Pair-Token` in `Access-Control-Allow-Headers`.

- [ ] **Step 1: Write the failing test**

Create `apps/pos/Tests/GwadaPOSTests/PosLanAuthTests.swift`:

```swift
import XCTest
@testable import GwadaPOS

final class PosLanAuthTests: XCTestCase {
    func test_dataPaths_requireToken() {
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.snapshotPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.openSessionPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.createOrderPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.reservationsPath))
        XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsTicketsPath))
    }

    func test_openPaths_doNotRequireToken() {
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.healthPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.kdsPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairRequestPath))
        XCTAssertFalse(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.pairStatusPath))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -15`
Expected: FAIL — `cannot find 'PosLanAuth' in scope`.

- [ ] **Step 3: Implement PosLanAuth**

Create `apps/pos/Sources/LAN/PosLanAuth.swift`:

```swift
import Foundation

/// Reine Regel: welche LAN-Pfade brauchen einen Pairing-Token.
enum PosLanAuth {
    /// Offen (kein Token): health (Discovery), kds-HTML (Browser), pair/*.
    private static let openPaths: Set<String> = [
        PosLanProtocol.healthPath,
        PosLanProtocol.kdsPath,
        PosLanProtocol.pairRequestPath,
        PosLanProtocol.pairStatusPath,
    ]

    static func requiresToken(pathOnly: String) -> Bool {
        !openPaths.contains(pathOnly)
    }
}
```

- [ ] **Step 4: Extend HubHTTPServer handler signature + header parsing**

In `apps/pos/Sources/LAN/HubHTTPServer.swift`:

Replace line 6:

```swift
    typealias Handler = @Sendable (String, String, [String: String], Data) -> (status: Int, body: Data)
```

Replace the `ParsedRequest` struct (lines 79-84) with:

```swift
    private struct ParsedRequest {
        var method: String
        var pathWithQuery: String
        var headers: [String: String]
        var body: Data
    }
```

In `parseRequest` (after the `contentLength` loop, before `let bodyStart`), build the headers dict:

```swift
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            if !key.isEmpty { headers[key] = value }
        }
```

Change the final `return` of `parseRequest` to:

```swift
        return ParsedRequest(method: method, pathWithQuery: pathWithQuery, headers: headers, body: body)
```

Change the handler call (line 62) to pass headers:

```swift
                let result = self.handler(request.method, request.pathWithQuery, request.headers, request.body)
```

In `serializeResponse`, add a `401` case to the status switch (after `case 405`):

```swift
        case 401: statusText = "Unauthorized"
```

In the CORS header line (`Access-Control-Allow-Headers: …`), append the pair token header:

```swift
        Access-Control-Allow-Headers: Content-Type, \(PosLanProtocol.headerProtocol), \(PosLanProtocol.headerRestaurantId), \(PosLanProtocol.headerPairToken)\r
```

- [ ] **Step 5: Update the handler closure in PosRuntime (compile fix only)**

In `apps/pos/Sources/App/PosRuntime.swift` line ~998, change the closure signature so it still compiles (full enforcement wiring is Task 4):

```swift
        let server = HubHTTPServer { method, path, headers, body in
            Self.handleHubRequest(method: method, path: path, headers: headers, body: body)
        }
```

And change `handleHubRequest`'s signature (line ~1097) to accept headers (add the parameter; body unchanged for now):

```swift
    private nonisolated static func handleHubRequest(
        method: String,
        path: String,
        headers: [String: String],
        body: Data
    ) -> (Int, Data) {
```

- [ ] **Step 6: Run tests to verify they pass + build succeeds**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -20`
Expected: PASS — `PosLanAuthTests` grün, alle vorigen grün, Build ok.

- [ ] **Step 7: Commit**

```bash
cd apps/pos
git add Sources/LAN/HubHTTPServer.swift Sources/LAN/PosLanAuth.swift Sources/App/PosRuntime.swift Tests/GwadaPOSTests/PosLanAuthTests.swift
git commit -m "feat(pos): Hub-Server reicht Header durch + 401 + PosLanAuth-Regel"
```

---

## Task 4: Hub-Routing — Pair-Endpunkte + Token-Enforcement

**Files:**
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (`handleHubRequest`, `startHub`)

**Interfaces:**
- Consumes: `PosPairingStore.shared` (Task 2), `PosLanAuth.requiresToken` (Task 3), `PosLanProtocol` paths/header (Task 1), `PosLanPairRequest` (Task 1).
- Produces: HTTP-Verhalten — `POST /v1/pair/request` → 201 `PosLanPairChallenge`; `GET /v1/pair/status?pairId=` → 200 `PosLanPairStatus`; Daten-Pfade ohne gültigen `X-Gwada-Pair-Token` → 401.

- [ ] **Step 1: Enforce token at the top of handleHubRequest**

In `apps/pos/Sources/App/PosRuntime.swift`, in `handleHubRequest`, directly after `let pathOnly = lanPathOnly(path)` (line ~1106), insert the enforcement block:

```swift
        if PosLanAuth.requiresToken(pathOnly: pathOnly) {
            let token = headers[PosLanProtocol.headerPairToken.lowercased()] ?? ""
            guard PosPairingStore.shared.verify(token: token) else {
                return (401, Data(#"{"error":"unpaired"}"#.utf8))
            }
        }
```

- [ ] **Step 2: Add GET /v1/pair/status route**

In the `if method == "GET"` block, before `return (404, …)` (line ~1140), add:

```swift
            if pathOnly == PosLanProtocol.pairStatusPath {
                let pairId = lanQueryValue(path, key: "pairId") ?? ""
                let status = PosPairingStore.shared.status(pairId: pairId)
                let data = (try? encoder.encode(status)) ?? Data(#"{"state":"rejected"}"#.utf8)
                return (200, data)
            }
```

- [ ] **Step 3: Add POST /v1/pair/request route**

In the `if method == "POST"` block, before `return (405, …)` (line ~1278), add:

```swift
            if pathOnly == PosLanProtocol.pairRequestPath {
                guard let req = try? decoder.decode(PosLanPairRequest.self, from: body) else {
                    return (400, Data(#"{"error":"invalid_body"}"#.utf8))
                }
                let challenge = PosPairingStore.shared.createPending(req)
                let data = (try? encoder.encode(challenge)) ?? Data(#"{"error":"encode"}"#.utf8)
                return (201, data)
            }
```

- [ ] **Step 4: Configure hub info on startHub**

In `startHub()`, after `PosHubState.shared.configure(hubDeviceId: hubDeviceId)` (line ~989), add:

```swift
        PosPairingStore.shared.configureHubInfo(
            PosLanHubInfo(deviceId: hubDeviceId, displayName: PosHubState.shared.restaurantName, role: "hub")
        )
```

- [ ] **Step 5: Build to verify it compiles**

Run: `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' build 2>&1 | tail -8`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Manual endpoint test (real, curl against the hub)**

Boot the iPad sim, launch the enrolled hub app (see Task 9 for the enroll/build recipe), then from the Mac shell:

```bash
# 1) unpaired snapshot → 401
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/v1/snapshot
# 2) request pairing → 201 + pairId/verificationCode
curl -s -X POST http://127.0.0.1:8787/v1/pair/request \
  -H 'Content-Type: application/json' \
  -d '{"deviceName":"curl-test","installationId":"curl-install-1"}'
# 3) status pending
curl -s "http://127.0.0.1:8787/v1/pair/status?pairId=<PAIR_ID>"
```

Expected: (1) `401`; (2) JSON with `pairId` + 6-digit `verificationCode`; (3) `{"state":"pending"}`.

- [ ] **Step 7: Commit**

```bash
cd apps/pos
git add Sources/App/PosRuntime.swift
git commit -m "feat(pos): Hub-Routing Pair-Endpunkte + Token-Enforcement"
```

---

## Task 5: HandheldHubClient — Token-Header + Pair-Calls

**Files:**
- Modify: `apps/pos/Sources/LAN/HandheldHubClient.swift`

**Interfaces:**
- Consumes: `PosLanProtocol` paths/header (Task 1), `PosLanPairRequest`, `PosLanPairChallenge`, `PosLanPairStatus` (Task 1).
- Produces: `static func requestPairing(baseURL: URL, request: PosLanPairRequest) async throws -> PosLanPairChallenge`; `static func pairingStatus(baseURL: URL, pairId: String) async throws -> PosLanPairStatus`; alle Daten-Calls (`fetchSnapshot`, `openSession`, `createOrder`, `fetchReservationsDay`, `createReservation`, KDS) senden optional `X-Gwada-Pair-Token` via neuen Parameter `pairToken: String?`.

- [ ] **Step 1: Add a shared header helper + pair token parameter**

In `apps/pos/Sources/LAN/HandheldHubClient.swift`, add a private helper inside `enum HandheldHubClient` (after the `session`/`decoder`/`encoder` lines):

```swift
    private static func applyPairToken(_ token: String?, to request: inout URLRequest) {
        if let token, !token.isEmpty {
            request.setValue(token, forHTTPHeaderField: PosLanProtocol.headerPairToken)
        }
    }
```

Add `pairToken: String? = nil` as a parameter to `fetchSnapshot`, `openSession`, `createOrder`, `fetchReservationsDay`, `createReservation`, and the KDS calls, and call `applyPairToken(pairToken, to: &request)` after each `URLRequest` is built (next to the existing `setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)` lines). Example for `fetchSnapshot`:

```swift
    static func fetchSnapshot(baseURL: URL, restaurantId: String?, pairToken: String? = nil) async throws -> PosLanHubSnapshot {
        let url = url(baseURL, path: PosLanProtocol.snapshotPath)
        var request = URLRequest(url: url)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        applyPairToken(pairToken, to: &request)
        if let restaurantId {
            request.setValue(restaurantId, forHTTPHeaderField: PosLanProtocol.headerRestaurantId)
        }
        // … rest unverändert
```

Apply the same `pairToken` parameter + `applyPairToken(...)` line to the other data calls listed above.

- [ ] **Step 2: Add pairing calls**

Add to `enum HandheldHubClient`:

```swift
    static func requestPairing(baseURL: URL, request req: PosLanPairRequest) async throws -> PosLanPairChallenge {
        var request = URLRequest(url: url(baseURL, path: PosLanProtocol.pairRequestPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        request.httpBody = try encoder.encode(req)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw HandheldHubClientError.invalidResponse }
        guard http.statusCode == 201 || http.statusCode == 200 else {
            throw HandheldHubClientError.httpStatus(http.statusCode)
        }
        return try decoder.decode(PosLanPairChallenge.self, from: data)
    }

    static func pairingStatus(baseURL: URL, pairId: String) async throws -> PosLanPairStatus {
        let escaped = pairId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? pairId
        let target = URL(string: "\(url(baseURL, path: PosLanProtocol.pairStatusPath).absoluteString)?pairId=\(escaped)")!
        var request = URLRequest(url: target)
        request.setValue("1", forHTTPHeaderField: PosLanProtocol.headerProtocol)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw HandheldHubClientError.invalidResponse
        }
        return try decoder.decode(PosLanPairStatus.self, from: data)
    }
```

- [ ] **Step 3: Build to verify it compiles**

Run: `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -8`
Expected: `** BUILD SUCCEEDED **`. (Callers in PosRuntime still compile because `pairToken` defaults to `nil`; enforcement of passing it is Task 8.)

- [ ] **Step 4: Commit**

```bash
cd apps/pos
git add Sources/LAN/HandheldHubClient.swift
git commit -m "feat(pos): HandheldHubClient Pair-Calls + Token-Header"
```

---

## Task 6: PosEnrollmentStore — Token + Hub-BaseURL persistieren

**Files:**
- Modify: `apps/pos/Sources/Store/PosEnrollmentStore.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosEnrollmentStoreTests.swift`

**Interfaces:**
- Produces: `PosEnrollmentStore.handheldPairToken: String?` (published, private(set)); `PosEnrollmentStore.handheldHubBaseURL: String?` (published, private(set)); `func markHandheldPaired(token: String, hubBaseURL: String)`; `resetHandheldPairing()` löscht Token + BaseURL. Bestehendes parameterloses `markHandheldPaired()` bleibt für Rückwärtskompatibilität (setzt nur den Bool).

- [ ] **Step 1: Write the failing test**

Create `apps/pos/Tests/GwadaPOSTests/PosEnrollmentStoreTests.swift`:

```swift
import XCTest
@testable import GwadaPOS

@MainActor
final class PosEnrollmentStoreTests: XCTestCase {
    override func setUp() {
        super.setUp()
        PosEnrollmentStore.shared.resetHandheldPairing()
    }

    func test_markPaired_persistsTokenAndHost() {
        let store = PosEnrollmentStore.shared
        store.markHandheldPaired(token: "tok_xyz", hubBaseURL: "http://127.0.0.1:8787")
        XCTAssertTrue(store.isHandheldPaired)
        XCTAssertEqual(store.handheldPairToken, "tok_xyz")
        XCTAssertEqual(store.handheldHubBaseURL, "http://127.0.0.1:8787")
    }

    func test_reset_clearsTokenAndHost() {
        let store = PosEnrollmentStore.shared
        store.markHandheldPaired(token: "tok_xyz", hubBaseURL: "http://127.0.0.1:8787")
        store.resetHandheldPairing()
        XCTAssertFalse(store.isHandheldPaired)
        XCTAssertNil(store.handheldPairToken)
        XCTAssertNil(store.handheldHubBaseURL)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -15`
Expected: FAIL — `value of type 'PosEnrollmentStore' has no member 'handheldPairToken'`.

- [ ] **Step 3: Implement persistence**

In `apps/pos/Sources/Store/PosEnrollmentStore.swift`:

Add keys after `handheldPairedKey`:

```swift
    private let handheldTokenKey = "gwada_pos_handheld_token"
    private let handheldHubURLKey = "gwada_pos_handheld_hub_url"
```

Add published properties after `isHandheldPaired`:

```swift
    @Published private(set) var handheldPairToken: String?
    @Published private(set) var handheldHubBaseURL: String?
```

In `init()`, after the `isHandheldPaired = …` line, add:

```swift
        handheldPairToken = UserDefaults.standard.string(forKey: handheldTokenKey)
        handheldHubBaseURL = UserDefaults.standard.string(forKey: handheldHubURLKey)
```

Add a new overload next to the existing `markHandheldPaired()`:

```swift
    func markHandheldPaired(token: String, hubBaseURL: String) {
        isHandheldPaired = true
        handheldPairToken = token
        handheldHubBaseURL = hubBaseURL
        UserDefaults.standard.set(true, forKey: handheldPairedKey)
        UserDefaults.standard.set(token, forKey: handheldTokenKey)
        UserDefaults.standard.set(hubBaseURL, forKey: handheldHubURLKey)
    }
```

Extend `resetHandheldPairing()` to clear the new values:

```swift
    func resetHandheldPairing() {
        isHandheldPaired = false
        handheldPairToken = nil
        handheldHubBaseURL = nil
        UserDefaults.standard.removeObject(forKey: handheldPairedKey)
        UserDefaults.standard.removeObject(forKey: handheldTokenKey)
        UserDefaults.standard.removeObject(forKey: handheldHubURLKey)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -20`
Expected: PASS — `PosEnrollmentStoreTests` grün.

- [ ] **Step 5: Commit**

```bash
cd apps/pos
git add Sources/Store/PosEnrollmentStore.swift Tests/GwadaPOSTests/PosEnrollmentStoreTests.swift
git commit -m "feat(pos): Enrollment-Store persistiert Pairing-Token + Hub-URL"
```

---

## Task 7: iPad-Freigabe-UI (HubPairingApprovalsView)

**Files:**
- Create: `apps/pos/Sources/UI/HubPairingApprovalsView.swift`
- Modify: `apps/pos/Sources/UI/RootView.swift`

**Interfaces:**
- Consumes: `PosPairingStore.shared` (`pendingList`, `approvedList`, `approve`, `reject`, `revoke`) (Task 2).
- Produces: `HubPairingApprovalsView` (SwiftUI sheet), erreichbar über das Personen-Plus-Symbol in der Hub-Toolbar.

> **Scope-Reduktion ggü. Spec:** Die Spec nennt zusätzlich „Hub-Adresse als Text + QR (nur Anzeige)". Im Sim tippt der Tester ohnehin `127.0.0.1:8787` manuell, und die exakte LAN-IP erfordert Interface-Enumeration + QR CoreImage. Für diesen Slice zeigt die View nur den **Port-Hinweis** (unten, Step 1); IP-Anzeige + QR sind auf eine spätere Iteration (echte Geräte) verschoben. Verweis im Plan-Abschluss vermerken.

- [ ] **Step 1: Create the approvals view**

Create `apps/pos/Sources/UI/HubPairingApprovalsView.swift`:

```swift
import SwiftUI

/// iPad: ausstehende Handgeräte freigeben / genehmigte widerrufen.
struct HubPairingApprovalsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var pending: [PosPairingStore.PendingPairing] = []
    @State private var approved: [PosPairingStore.ApprovedDevice] = []
    private let refreshTimer = Timer.publish(every: 1.5, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Handgeräte verbinden sich im lokalen WLAN mit dieser Kasse (Port 8787). Im Simulator: Hub-Adresse am iPhone `127.0.0.1:8787` eingeben.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("Ausstehende Anfragen") {
                    if pending.isEmpty {
                        Text("Keine offenen Anfragen.").foregroundStyle(.secondary)
                    }
                    ForEach(pending, id: \.pairId) { p in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(p.deviceName).font(.headline)
                            Text("Code: \(p.verificationCode)")
                                .font(.system(.title3, design: .monospaced))
                                .foregroundStyle(Color.accentColor)
                            HStack {
                                Button("Freigeben") {
                                    _ = PosPairingStore.shared.approve(pairId: p.pairId)
                                    reload()
                                }.buttonStyle(.borderedProminent)
                                Button("Ablehnen", role: .destructive) {
                                    PosPairingStore.shared.reject(pairId: p.pairId)
                                    reload()
                                }.buttonStyle(.bordered)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                Section("Gekoppelte Geräte") {
                    if approved.isEmpty {
                        Text("Noch keine Geräte.").foregroundStyle(.secondary)
                    }
                    ForEach(approved, id: \.token) { d in
                        HStack {
                            Text(d.deviceName)
                            Spacer()
                            Button("Widerrufen", role: .destructive) {
                                PosPairingStore.shared.revoke(token: d.token)
                                reload()
                            }.font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Handgeräte verbinden")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
            .onAppear(perform: reload)
            .onReceive(refreshTimer) { _ in reload() }
        }
    }

    private func reload() {
        pending = PosPairingStore.shared.pendingList()
        approved = PosPairingStore.shared.approvedList()
    }
}
```

- [ ] **Step 2: Add the toolbar entry in RootView hubSplitView**

In `apps/pos/Sources/UI/RootView.swift`, add a state var near the other `@State` declarations:

```swift
    @State private var showingPairingApprovals = false
```

In `hubSplitView`, add a toolbar button (place it in the existing toolbar of the hub split view; the person-plus icon) and attach the sheet:

```swift
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingPairingApprovals = true
                    } label: {
                        Image(systemName: "person.badge.plus")
                    }
                }
```

Attach the sheet to `hubSplitView` (e.g., after its `.toolbar { … }`):

```swift
                .sheet(isPresented: $showingPairingApprovals) {
                    HubPairingApprovalsView()
                }
```

- [ ] **Step 3: Build to verify it compiles**

Run: `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' build 2>&1 | tail -8`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
cd apps/pos
git add Sources/UI/HubPairingApprovalsView.swift Sources/UI/RootView.swift
git commit -m "feat(pos): iPad-Freigabe-UI für Handgeräte-Pairing"
```

---

## Task 8: iPhone-Pairing-Flow (connectHandheld + Warte-UI)

**Files:**
- Modify: `apps/pos/Sources/App/PosRuntime.swift`
- Modify: `apps/pos/Sources/UI/HandheldPairingGateView.swift`

**Interfaces:**
- Consumes: `HandheldHubClient.requestPairing`/`pairingStatus` (Task 5), `PosEnrollmentStore.markHandheldPaired(token:hubBaseURL:)` + `handheldPairToken` (Task 6), `PosLanPairRequest`/`PosLanPairStatus`/`PosLanPairState` (Task 1), `PosDeviceIdentity` (bestehend, für installationId).
- Produces: `PosRuntime.pairingChallenge: PosLanPairChallenge?` (published), `PosRuntime.phase` erweitert um `.awaitingApproval`; `func startHandheldPairing(host: String)` und `func cancelHandheldPairing()`; `connectHandheld` nutzt gespeicherten Token für `fetchSnapshot`.

- [ ] **Step 1: Add awaitingApproval phase + published challenge**

In `apps/pos/Sources/App/PosRuntime.swift`, in the `Phase` enum (line ~6), add a case:

```swift
        case awaitingApproval
```

Add published state near `hubBaseURL` (line ~19):

```swift
    @Published private(set) var pairingChallenge: PosLanPairChallenge?
    private var pairingPollTask: Task<Void, Never>?
```

- [ ] **Step 2: Use stored token when connecting; branch to pairing when missing/401**

In `connectHandheld` (line ~1307 loop), replace the body of the `for base in candidates` loop's `do { … }` so that the snapshot fetch carries the token and a missing/invalid token triggers pairing. Replace the `let snap = try await HandheldHubClient.fetchSnapshot(...)` call and the success block with:

```swift
                let health = try await HandheldHubClient.fetchHealth(baseURL: base)
                guard health.ok else { throw HandheldHubClientError.invalidResponse }
                let token = PosEnrollmentStore.shared.handheldPairToken
                do {
                    let snap = try await HandheldHubClient.fetchSnapshot(
                        baseURL: base,
                        restaurantId: health.restaurantId,
                        pairToken: token
                    )
                    if let host = base.host {
                        UserDefaults.standard.set(host, forKey: manualHostKey)
                    }
                    hubBaseURL = base
                    isSoloMode = false
                    publishSnapshot(snap)
                    phase = .connected
                    statusMessage = "Verbunden mit \(snap.hub.displayName)."
                    await pullReservationsDay(PosReservationsStore.todayYmd())
                    return
                } catch HandheldHubClientError.httpStatus(401) {
                    // kein/ungültiger Token → Kopplung anstoßen
                    PosEnrollmentStore.shared.resetHandheldPairing()
                    await beginPairing(base: base)
                    return
                }
```

> `fetchSnapshot` wirft bereits `HandheldHubClientError.httpStatus(http.statusCode)` bei non-200 (verifiziert in `HandheldHubClient.swift:37`), also liefert ein 401 genau `.httpStatus(401)` — keine Client-Anpassung nötig.

- [ ] **Step 3: Add pairing helpers**

Add to `PosRuntime`:

```swift
    func startHandheldPairing(host: String) async {
        let base = PosLanProtocol.hubBaseURL(host: host)
        await beginPairing(base: base)
    }

    func cancelHandheldPairing() {
        pairingPollTask?.cancel()
        pairingPollTask = nil
        pairingChallenge = nil
        phase = .searching
        statusMessage = ""
    }

    private func beginPairing(base: URL) async {
        do {
            let req = PosLanPairRequest(
                deviceName: PosDeviceRoleDetector.deviceKindLabel,
                installationId: PosDeviceIdentity.id
            )
            let challenge = try await HandheldHubClient.requestPairing(baseURL: base, request: req)
            pairingChallenge = challenge
            hubBaseURL = nil
            phase = .awaitingApproval
            statusMessage = "Warte auf Freigabe am iPad …"
            pollPairing(base: base, pairId: challenge.pairId)
        } catch {
            phase = .error(error.localizedDescription)
            statusMessage = "Kopplung fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func pollPairing(base: URL, pairId: String) {
        pairingPollTask?.cancel()
        pairingPollTask = Task { [weak self] in
            for _ in 0..<150 { // ~5 min bei 2s
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard let status = try? await HandheldHubClient.pairingStatus(baseURL: base, pairId: pairId) else { continue }
                switch status.state {
                case .approved:
                    guard let token = status.token else { continue }
                    await MainActor.run {
                        PosEnrollmentStore.shared.markHandheldPaired(
                            token: token,
                            hubBaseURL: base.absoluteString
                        )
                        self?.pairingChallenge = nil
                    }
                    await self?.connectHandheld(preferredHost: base.host)
                    return
                case .rejected, .expired:
                    await MainActor.run {
                        self?.pairingChallenge = nil
                        self?.phase = .error(status.state == .rejected ? "Freigabe abgelehnt" : "Code abgelaufen")
                        self?.statusMessage = status.state == .rejected
                            ? "Freigabe am iPad abgelehnt."
                            : "Code abgelaufen — erneut koppeln."
                    }
                    return
                case .pending:
                    continue
                }
            }
        }
    }
```

> `PosDeviceIdentity.id` ist der stabile Geräte-ID-Accessor (UserDefaults-gestützt, `Sources/Cloud/PosDeviceIdentity.swift:7`).

- [ ] **Step 4: Update the gate view — manual host + waiting state**

Replace `apps/pos/Sources/UI/HandheldPairingGateView.swift` body with a version that adds a host field and an awaiting-approval branch:

```swift
import SwiftUI

/// iPhone: ohne Pairing kein Betrieb (Kundenpfad — kein Solo).
struct HandheldPairingGateView: View {
    @EnvironmentObject private var runtime: PosRuntime
    #if DEBUG
    @State private var host = "127.0.0.1:8787"
    #else
    @State private var host = ""
    #endif

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "ipad.and.iphone")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)

            if runtime.phase == .awaitingApproval, let challenge = runtime.pairingChallenge {
                Text("Warte auf Freigabe am iPad")
                    .font(.title2.weight(.semibold))
                Text("Vergleiche diesen Code auf dem iPad und tippe dort „Freigeben“.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
                Text(challenge.verificationCode)
                    .font(.system(size: 40, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.accentColor)
                ProgressView()
                Button("Abbrechen") { runtime.cancelHandheldPairing() }
                    .font(.caption)
            } else {
                Text("Mit der Kasse verbinden")
                    .font(.title2.weight(.semibold))
                Text("Schalte die iPad-Kasse ein — Bonjour findet sie automatisch, oder gib die Hub-Adresse ein.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)

                if !runtime.statusMessage.isEmpty {
                    Text(runtime.statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await runtime.refresh() }
                } label: {
                    Text("Automatisch suchen").frame(maxWidth: .infinity)
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .padding(.horizontal, 32)

                VStack(spacing: 8) {
                    TextField("Hub-Adresse (host:port)", text: $host)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Koppeln") {
                        Task { await runtime.startHandheldPairing(host: host) }
                    }
                    .disabled(host.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 32)

                #if DEBUG
                Button("DEBUG: Solo ohne Kasse") {
                    Task { await runtime.startHandheldSolo(preferCloud: false) }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                #endif
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
    }
}
```

- [ ] **Step 5: Build to verify it compiles**

Run: `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | tail -8`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
cd apps/pos
git add Sources/App/PosRuntime.swift Sources/UI/HandheldPairingGateView.swift
git commit -m "feat(pos): iPhone-Pairing-Flow mit Warte-auf-Freigabe + Token"
```

---

## Task 9: Manuelle Sim-Integration + Akzeptanz

**Files:**
- Modify: `apps/pos/README.md` (Testschritte dokumentieren)

**Interfaces:**
- Consumes: gesamter Flow (Tasks 1–8).

- [ ] **Step 1: End-to-end im Simulator (Happy Path)**

1. iPad-Sim booten, App bauen & installieren, Hub enrollen (Setup-Code aus Dashboard, siehe frühere Session — `POST /api/pos/devices/enroll`).
2. iPhone-Sim booten, App installieren.
3. iPhone: Gate → Hub-Adresse `127.0.0.1:8787` → „Koppeln" → zeigt 6-stelligen Code + „Warte auf Freigabe".
4. iPad: Personen-Plus-Icon → „Handgeräte verbinden" → Anfrage sichtbar, Code stimmt überein → „Freigeben".
5. iPhone: wechselt automatisch in die Tische-UI (Snapshot geladen).

Erwartung: iPhone erreicht die Tische; kein 401 nach Freigabe.

- [ ] **Step 2: Negativfälle**

- Ungekoppelt: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/v1/snapshot` → `401`.
- Ablehnen: iPhone koppeln, am iPad „Ablehnen" → iPhone zeigt „Freigabe abgelehnt".
- Widerruf: nach erfolgreichem Pairing am iPad „Widerrufen" → nächster iPhone-Refresh (`runtime.refresh()`) fällt auf 401 → zurück zum Gate.
- Zweites iPhone (bzw. zweite installationId via curl) erzeugt eine eigene Anfrage/Freigabe.

- [ ] **Step 3: Dokumentation**

In `apps/pos/README.md` einen kurzen Abschnitt „iPhone-Pairing (Schritt 3, Sim-Test)" mit den Schritten aus Step 1–2 ergänzen (Hub-Adresse `127.0.0.1:8787`, Code-Abgleich, Freigabe am iPad).

- [ ] **Step 4: Full test run + commit**

Run: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -20`
Expected: `** TEST SUCCEEDED **` (alle Unit-Tests grün).

```bash
cd apps/pos
git add README.md
git commit -m "docs(pos): Sim-Testschritte iPhone-Pairing (Schritt 3)"
```

---

## Akzeptanzkriterien (Verifikation in Task 9)

- [ ] iPhone: Anfrage → wartet → iPad genehmigt (Code-Abgleich) → Tische-UI
- [ ] Zweites iPhone = eigene Freigabe
- [ ] Ungekoppeltes/abgelehntes Gerät: kein Datenzugriff (401)
- [ ] Token-Widerruf am iPad wirkt (nächster Request → 401 → Gate)
