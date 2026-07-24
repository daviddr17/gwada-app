import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// iPad: Kasse einrichten — Willkommen → Login/Code → Standort → Fertig.
struct HubOnboardingWizardView: View {
    @EnvironmentObject private var runtime: PosRuntime
    @StateObject private var enrollment = PosEnrollmentStore.shared

    enum Step: Int {
        case welcome
        case access
        case site
        case done
    }

    enum AccessMode: String {
        case password
        case setupCode
    }

    @State private var step: Step = .welcome
    @State private var accessMode: AccessMode = .password
    @State private var setupCode = ""
    @State private var restaurants: [PosCloudClient.PosRestaurantOption] = []
    @State private var selectedRestaurantId: String?
    @State private var busy = false
    @State private var errorText = ""

    var body: some View {
        NavigationStack {
            Group {
                switch step {
                case .welcome: welcomeStep
                case .access: accessStep
                case .site: siteStep
                case .done: doneStep
                }
            }
            .animation(.snappy, value: step)
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Kasse einrichten")
                        .font(.headline)
                }
            }
        }
    }

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Gwada")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Color.accentColor)
            Text("Dieses iPad wird deine Kasse.")
                .font(.title2.weight(.semibold))
            Text("Einmal einrichten — danach finden Handgeräte die Kasse im WLAN. Cloud: \(PosEnvironment.channelLabel).")
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                step = .access
            } label: {
                Text("Weiter")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())
        }
    }

    private var accessStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Zugang")
                .font(.title2.weight(.semibold))
            Picker("Modus", selection: $accessMode) {
                Text("E-Mail & Passwort").tag(AccessMode.password)
                Text("Einrichtungs-Code").tag(AccessMode.setupCode)
            }
            .pickerStyle(.segmented)

            if accessMode == .password {
                TextField("E-Mail", text: $runtime.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemGroupedBackground)))
                SecureField("Passwort", text: $runtime.password)
                    .textContentType(.password)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemGroupedBackground)))
            } else {
                TextField("Code aus dem Dashboard", text: $setupCode)
                    .textInputAutocapitalization(.characters)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemGroupedBackground)))
                Text("Web → POS → Geräte → Einrichtungs-Code. (API folgt in Schritt 2.)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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
                    Task { await submitAccess() }
                } label: {
                    if busy {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text(accessMode == .password ? "Anmelden" : "Code prüfen")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(busy)
            }
        }
    }

    private var siteStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Standort")
                .font(.title2.weight(.semibold))
            Text("Welches Restaurant soll diese Kasse bedienen?")
                .foregroundStyle(.secondary)

            if restaurants.isEmpty {
                ContentUnavailableView("Keine Standorte", systemImage: "building.2", description: Text("Kein aktives Mitarbeiter-Restaurant für dieses Konto."))
            } else {
                List(restaurants, selection: $selectedRestaurantId) { r in
                    HStack {
                        Text(r.name)
                        Spacer()
                        if selectedRestaurantId == r.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                    .tag(Optional(r.id))
                    .contentShape(Rectangle())
                    .onTapGesture { selectedRestaurantId = r.id }
                }
                .listStyle(.insetGrouped)
                .frame(minHeight: 220)
            }

            if !errorText.isEmpty {
                Text(errorText).font(.footnote).foregroundStyle(.red)
            }

            Spacer()
            HStack {
                Button("Zurück") { step = .access }
                    .buttonStyle(PosSecondaryButtonStyle())
                Button {
                    Task { await finishWithSite() }
                } label: {
                    if busy {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Kasse starten").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(PosPrimaryButtonStyle())
                .disabled(busy || selectedRestaurantId == nil)
            }
        }
    }

    private var doneStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)
            Text("Kasse bereit")
                .font(.title2.weight(.semibold))
            Text(enrollment.restaurantDisplayName.isEmpty
                ? "Handgeräte können sich jetzt verbinden."
                : "„\(enrollment.restaurantDisplayName)“ — Handgeräte können sich jetzt verbinden.")
                .foregroundStyle(.secondary)
            Text("Pairing per QR folgt im nächsten Schritt. Bis dahin: Gerät → Status.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    private func submitAccess() async {
        errorText = ""
        busy = true
        defer { busy = false }
        PosCloudConfig.applyEnvironmentDefaultsIfNeeded()

        if accessMode == .setupCode {
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
                PosDeviceCredential.store(deviceRowId: claim.deviceId, token: claim.deviceToken)
                PosCloudConfig.setRestaurantId(claim.restaurantId)
                runtime.restaurantIdInput = claim.restaurantId
                await runtime.completeHubOnboarding(restaurantName: claim.restaurantName)
            } catch {
                errorText = error.localizedDescription
            }
            return
        }

        do {
            try await PosAuthStore.shared.signIn(email: runtime.email, password: runtime.password)
            await runtime.noteSignedInFromWizard()
            guard let userId = PosAuthStore.shared.session?.userId else {
                errorText = "Anmeldung ohne User-ID."
                return
            }
            PosCloudConfig.setWaiterProfileId(userId)
            runtime.waiterProfileIdInput = userId
            restaurants = try await PosCloudClient.listStaffRestaurants(userId: userId)
            if restaurants.isEmpty {
                errorText = "Kein Restaurant für dieses Konto — im Web als Mitarbeiter hinterlegen."
                return
            }
            if restaurants.count == 1 {
                selectedRestaurantId = restaurants[0].id
            } else if let active = try? await PosCloudClient.resolveActiveRestaurantId(userId: userId),
                      restaurants.contains(where: { $0.id == active })
            {
                selectedRestaurantId = active
            }
            step = .site
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func finishWithSite() async {
        errorText = ""
        guard let rid = selectedRestaurantId,
              let site = restaurants.first(where: { $0.id == rid })
        else {
            errorText = "Bitte einen Standort wählen."
            return
        }
        busy = true
        defer { busy = false }
        PosCloudConfig.setRestaurantId(rid)
        runtime.restaurantIdInput = rid
        await runtime.completeHubOnboarding(restaurantName: site.name)
        // RootView wechselt auf Hub-UI sobald enrolled
    }
}
