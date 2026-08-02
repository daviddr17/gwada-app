import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// iPad: Kasse einrichten — Willkommen → Einrichtungs-Code → Fertig.
struct HubOnboardingWizardView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var enrollment = PosEnrollmentStore.shared

    enum Step: Int {
        case welcome
        case access
        case done
    }

    @State private var step: Step = .welcome
    @State private var setupCode = ""
    @State private var busy = false
    @State private var errorText = ""

    var body: some View {
        NavigationStack {
            Group {
                switch step {
                case .welcome: welcomeStep
                case .access: accessStep
                case .done: doneStep
                }
            }
            .animation(.snappy, value: step)
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(PosDesign.bg.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Kasse einrichten")
                        .font(.headline)
                        .foregroundStyle(PosDesign.ink)
                }
            }
        }
    }

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Gwada")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(PosDesign.ink)
            Text("Dieses iPad wird deine Kasse.")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text("Einmal einrichten — danach finden Handgeräte die Kasse im WLAN. Cloud: \(PosEnvironment.channelLabel).")
                .font(.body)
                .foregroundStyle(PosDesign.muted)
            Spacer()
            Button {
                step = .access
            } label: {
                Text("Weiter")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())

            #if DEBUG
            Button("DEBUG: Lokal ohne Cloud starten") {
                Task {
                    await runtime.completeHubOnboarding(restaurantName: "Demo-Kasse")
                }
            }
            .font(.caption)
            .foregroundStyle(PosDesign.muted)
            .frame(maxWidth: .infinity)
            #endif
        }
    }

    private var accessStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Zugang")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            TextField("Code aus dem Dashboard", text: $setupCode)
                .textInputAutocapitalization(.characters)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(PosDesign.surface2))
                .overlay {
                    RoundedRectangle(cornerRadius: 12).strokeBorder(PosDesign.line, lineWidth: 1)
                }
            Text("Web → POS → Geräte → Einrichtungs-Code.")
                .font(.footnote)
                .foregroundStyle(PosDesign.muted)

            if !errorText.isEmpty {
                Text(errorText)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Spacer()
            HStack {
                Button("Zurück") { step = .welcome }
                    .buttonStyle(PosSecondaryButtonStyle())
                Button {
                    Task { await submitAccess() }
                } label: {
                    if busy {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Code prüfen")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(busy)
            }
        }
    }

    private var doneStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(PosDesign.brandAccent)
            Text("Kasse bereit")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text(enrollment.restaurantDisplayName.isEmpty
                ? "Handgeräte können sich jetzt verbinden."
                : "„\(enrollment.restaurantDisplayName)“ — Handgeräte können sich jetzt verbinden.")
                .foregroundStyle(PosDesign.muted)
            Text("Pairing per QR folgt im nächsten Schritt. Bis dahin: Gerät → Status.")
                .font(.footnote)
                .foregroundStyle(PosDesign.muted)
            Spacer()
        }
    }

    private func submitAccess() async {
        errorText = ""
        busy = true
        defer { busy = false }
        PosCloudConfig.applyEnvironmentDefaultsIfNeeded()

        let code = setupCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else {
            errorText = "Bitte Einrichtungs-Code eingeben."
            return
        }
        do {
            let claim = try await PosCloudClient.claimDeviceEnrollment(
                code: code,
                preferredName: UIDevice.current.name
            )
            PosEnrollmentCredential.store(deviceRowId: claim.deviceId, token: claim.deviceToken)
            PosCloudConfig.setRestaurantId(claim.restaurantId)
            runtime.restaurantIdInput = claim.restaurantId
            await runtime.completeHubOnboarding(restaurantName: claim.restaurantName)
        } catch {
            errorText = error.localizedDescription
        }
    }
}
