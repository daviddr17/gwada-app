import SwiftUI

/// 4-Augen Schichtübergabe (Prototyp) — Nest `POST /v1/shifts/transfer` wenn konfiguriert.
struct HandoverSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    @State private var toProfileId = ""
    @State private var displayPin = ""
    @State private var busy = false
    @State private var message = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Übernehmer bestätigen (Profil-ID + Display-PIN). In Release kein Demo-Bypass.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Übernehmer") {
                    TextField("Profil-ID (UUID)", text: $toProfileId)
                        .textInputAutocapitalization(.never)
                    SecureField("Display-PIN", text: $displayPin)
                        .keyboardType(.numberPad)
                }
                if !message.isEmpty {
                    Section {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(message.contains("fehl") || message.contains("Fehler") ? .red : .secondary)
                    }
                }
            }
            .navigationTitle("Übergabe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Übergeben") {
                        Task { await submit() }
                    }
                    .disabled(busy || toProfileId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        let toId = toProfileId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard PosCloudConfig.nestSyncEnabled, let nestBase = PosCloudConfig.nestApiBaseURL else {
            message = "Nest-URL fehlt — Übergabe nur mit Nest Sync."
            return
        }
        guard let restaurantId = PosCloudConfig.restaurantId else {
            message = "Restaurant-ID fehlt."
            return
        }
        let fromId = PosCloudConfig.waiterProfileId
            ?? PosAuthStore.shared.session?.userId
            ?? ""
        guard !fromId.isEmpty else {
            message = "Waiter-Profil fehlt."
            return
        }

        var request = URLRequest(
            url: nestBase
                .appendingPathComponent("v1")
                .appendingPathComponent("shifts")
                .appendingPathComponent("transfer")
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(restaurantId, forHTTPHeaderField: "X-Restaurant-Id")
        request.setValue(fromId, forHTTPHeaderField: "X-Waiter-Profile-Id")
        request.setValue(PosDeviceIdentity.id, forHTTPHeaderField: "X-Device-Id")
        let body: [String: Any] = [
            "toProfileId": toId,
            "displayPin": displayPin,
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                message = "Ungültige Antwort."
                return
            }
            if (200 ... 299).contains(http.statusCode) {
                message = "Übergabe erfolgreich."
                runtime.announce("Schicht übergeben.")
                try? await Task.sleep(nanoseconds: 600_000_000)
                dismiss()
            } else {
                let body = String(data: data, encoding: .utf8) ?? ""
                message = "Fehler HTTP \(http.statusCode): \(body.prefix(80))"
            }
        } catch {
            message = "Netzwerkfehler: \(error.localizedDescription)"
        }
    }
}
