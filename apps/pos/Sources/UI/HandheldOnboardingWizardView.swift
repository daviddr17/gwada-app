import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// iPhone: Willkommen → Einrichtungs-Code → Hub-Koppeln (Hub Pflicht nach Phase 1).
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
            .onChange(of: enrollment.isHandheldPaired) { _, paired in
                if paired {
                    showLanPairing = false
                }
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
            Text("Bestellen am Tisch — mit der iPad-Kasse im WLAN.")
                .font(.title3.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text(
                "Zuerst Einrichtungs-Code aus dem Dashboard, danach die Kasse koppeln. Ohne Freigabe am iPad kein Service."
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

            Button("Bereits Cloud — Kasse koppeln") {
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
            .foregroundStyle(PosDesign.muted)
            .frame(maxWidth: .infinity)
            #endif
        }
    }

    private var codeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Einrichtungs-Code")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text("Web → POS → Geräte → Code erzeugen, hier eingeben.")
                .font(.footnote)
                .foregroundStyle(PosDesign.muted)
            TextField("Code", text: $setupCode)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(PosDesign.surface2)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 12).strokeBorder(PosDesign.line, lineWidth: 1)
                }
                .onChange(of: setupCode) { _, _ in
                    // Tippen zählt als Aktivität — sonst greift der PIN-Auto-Lock und reißt den Wizard weg.
                    PosPinLockStore.shared.noteUserActivity()
                }

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
            Text("Cloud bereit")
                .font(.title2.weight(.semibold))
                .foregroundStyle(PosDesign.ink)
            Text(
                enrollment.restaurantDisplayName.isEmpty
                    ? "Speisekarte ist geladen. Als Nächstes die iPad-Kasse koppeln."
                    : "„\(enrollment.restaurantDisplayName)“ — jetzt iPad-Kasse koppeln."
            )
            .foregroundStyle(PosDesign.muted)
            Text("Ohne Kassen-Freigabe im WLAN startet der Service nicht.")
                .font(.footnote)
                .foregroundStyle(PosDesign.muted)
            Spacer()
            Button {
                showLanPairing = true
            } label: {
                Text("Kasse koppeln")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())

            #if DEBUG
            Button("DEBUG: Zu den Tischen (Solo)") {
                Task { await runtime.finishHandheldCloudOnboarding() }
            }
            .font(.caption)
            .foregroundStyle(PosDesign.muted)
            .frame(maxWidth: .infinity)
            #endif
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
            PosEnrollmentStore.shared.markHandheldCloudReady(restaurantName: claim.restaurantName)
            step = .done
        } catch {
            errorText = error.localizedDescription
        }
    }
}
