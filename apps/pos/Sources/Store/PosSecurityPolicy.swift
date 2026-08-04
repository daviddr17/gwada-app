import Foundation

/// Security gates for lab vs production (Batch A — fiscal + hub collect).
enum PosSecurityPolicy {
    /// Fake TSE / Demo-Stammdaten auf Gastbelegen — nur DEBUG-Labor.
    static var allowsDemoFiscalTse: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    /// Lokales Kassieren ohne Staff-PIN/Cloud-Login — nur DEBUG-Labor.
    static var allowsUnsignedLocalCollect: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    /// Hub `POST /v1/collect` ohne Staff-Session am iPad — nur DEBUG-Labor.
    static var allowsHubCollectWithoutStaffSession: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    /// Cloud-Solo ohne iPad-Kasse — nur DEBUG-Labor (Hub-Offline Phase 1).
    static var allowsSoloMode: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    /// TLS Trust-on-first-use ohne Bonjour-Fingerprint — nur DEBUG (Simulator/manuell).
    static var allowsTlsTrustOnFirstUse: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    static let allowedCollectMethods: Set<String> = [
        PosPaymentMethodKind.cash.rawValue,
        PosPaymentMethodKind.card.rawValue,
        PosPaymentMethodKind.paypal.rawValue,
        PosPaymentMethodKind.voucher.rawValue,
    ]

    /// LAN `/v1/collect` darf offene Positionen nur für diese Methoden closingen (Review 2026-08-03).
    /// Gutschein/Unbar: nicht über Hub-Collect „bezahlt“ markieren ohne Validierung/Provider.
    static let hubLanSettleMethods: Set<String> = [
        PosPaymentMethodKind.cash.rawValue,
    ]

    static func isAllowedCollectMethod(_ raw: String) -> Bool {
        allowedCollectMethods.contains(raw)
    }

    static func isHubLanSettleMethod(_ raw: String) -> Bool {
        hubLanSettleMethods.contains(raw)
    }
}
