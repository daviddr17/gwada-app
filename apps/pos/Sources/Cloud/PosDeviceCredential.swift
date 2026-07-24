import Foundation

/// Device-Token nach Einrichtungs-Code (Keychain).
enum PosDeviceCredential {
    private static let tokenAccount = "gwada_pos_device_token"
    private static let deviceRowIdKey = "gwada_pos_enrolled_device_row_id"

    static var deviceToken: String? {
        PosKeychain.get(account: tokenAccount)
    }

    static var enrolledDeviceRowId: String? {
        UserDefaults.standard.string(forKey: deviceRowIdKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func store(deviceRowId: String, token: String) {
        PosKeychain.set(token, account: tokenAccount)
        UserDefaults.standard.set(deviceRowId, forKey: deviceRowIdKey)
    }

    static func clear() {
        PosKeychain.delete(account: tokenAccount)
        UserDefaults.standard.removeObject(forKey: deviceRowIdKey)
    }

    static var hasCredential: Bool {
        guard let t = deviceToken, !t.isEmpty,
              let id = enrolledDeviceRowId, !id.isEmpty
        else { return false }
        return true
    }
}
