import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// iPhone: 3 Schritte — Willkommen → Einrichtungs-Code → Fertig (Cloud, ohne iPad).
struct HandheldOnboardingWizardView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var enrollment = PosEnrollmentStore.shared

    enum Step: Int {
        case welcome
        case code
        case done
    }

    @State private var step: Step = .welcome
    @State private var setupCode = ""
    @State private var busy = false
    @State private var errorText = ""
    @State private var showLanPairing = false

    var body: some View {
        NavigationStack {
            Group {
                switch step {
                case .welcome: welcomeStep
                case .code: codeStep
                case .done: doneStep
                }
            }
            .animation(.snappy, value: step)
            .padding(24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(PosDesign.bg.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Handgerät einrichten")
                        .font(.headline)
                        .foregroundStyle(PosDesign.ink)
                }
            }
            .sheet(isPresented: $showLanPairing) {
                HandheldPairingGateView()
                    .environmentObject(runtime)
            }
        }
    }

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            Image(systemName: "iphone")
                .font(.system(size: 44))
                .foregroundStyle(PosDesign.brandAccent)
            Text("Gwada Service")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(PosDesign.ink)
            Text("Bestellen am Tisch — Speisekarte aus der Cloud.")
                .font(.title3.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text(
                "Einmal mit dem Code aus dem Dashboard verbinden. Danach läuft das iPhone auch ohne iPad; die Karte wird offline gespeichert."
            )
            .font(.body)
            .foregroundStyle(PosDesign.muted)
            Spacer()
            Button {
                step = .code
            } label: {
                Text("Weiter")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())

            Button("Stattdessen mit iPad-Kasse koppeln") {
                showLanPairing = true
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(PosDesign.ink)
            .frame(maxWidth: .infinity)

            #if DEBUG
            Button("DEBUG: Solo ohne Code") {
                Task { await runtime.startHandheldSolo(preferCloud: false) }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            #endif
        }
    }

    private var codeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Einrichtungs-Code")
                .font(.title2.weight(.semibold))
            Text("Web → POS → Geräte → Code erzeugen, hier eingeben.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            TextField("Code", text: $setupCode)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemGroupedBackground)))

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
                    Task { await submitCode() }
                } label: {
                    if busy {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Verbinden").frame(maxWidth: .infinity)
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
            Text("Bereit")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text(
                enrollment.restaurantDisplayName.isEmpty
                    ? "Speisekarte ist geladen. Tippe einen Tisch an, um zu bestellen."
                    : "„\(enrollment.restaurantDisplayName)“ — tippe einen Tisch an, um zu bestellen."
            )
            .foregroundStyle(PosDesign.muted)
            Text("Optional: unter Mehr → Gerät die iPad-Kasse koppeln (Live-Tische im WLAN).")
                .font(.footnote)
                .foregroundStyle(PosDesign.muted)
            Spacer()
            Button {
                Task { await runtime.finishHandheldCloudOnboarding() }
            } label: {
                Text("Zu den Tischen")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())
        }
    }

    private func submitCode() async {
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
            PosEnrollmentStore.shared.setRestaurantDisplayName(claim.restaurantName)
            await runtime.preloadHandheldCloudAfterEnroll(restaurantName: claim.restaurantName)
            step = .done
        } catch {
            errorText = error.localizedDescription
        }
    }
}
