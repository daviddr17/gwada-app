import SwiftUI

/// iPhone: optional LAN-Kopplung mit iPad (Cloud läuft ohne Hub).
struct HandheldPairingGateView: View {
    @EnvironmentObject private var runtime: PosRuntime
    #if DEBUG
    @State private var host = "127.0.0.1:8787"
    #else
    @State private var host = ""
    #endif
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "ipad.and.iphone")
                    .font(.system(size: 48))
                    .foregroundStyle(PosDesign.brandAccent)

                if runtime.phase == .awaitingApproval, let challenge = runtime.pairingChallenge {
                    Text("Warte auf Freigabe am iPad")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(PosDesign.ink)
                    Text("Vergleiche diesen Code auf dem iPad und tippe dort „Freigeben“.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(PosDesign.muted)
                        .padding(.horizontal)
                    Text(challenge.verificationCode)
                        .font(.system(size: 40, weight: .bold, design: .monospaced))
                        .foregroundStyle(PosDesign.ink)
                    ProgressView()
                    Button("Abbrechen") { runtime.cancelHandheldPairing() }
                        .font(.caption)
                } else {
                    Text("iPad-Kasse koppeln")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(PosDesign.ink)
                    Text(
                        "Optional: Live-Tische im WLAN. Speisekarte kommt weiter aus der Cloud — Freigabe bleibt bis zum Widerruf."
                    )
                    .multilineTextAlignment(.center)
                    .foregroundStyle(PosDesign.muted)
                    .padding(.horizontal)

                    if !runtime.statusMessage.isEmpty {
                        Text(runtime.statusMessage)
                            .font(.footnote)
                            .foregroundStyle(PosDesign.muted)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        Task { await runtime.searchOrPairHandheld(manualHost: host) }
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
                        Task {
                            await runtime.startHandheldSolo(preferCloud: false)
                            dismiss()
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(PosDesign.muted)
                    #endif
                }
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(PosDesign.bg.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Schließen") { dismiss() }
                }
            }
            .onChange(of: runtime.phase) { _, phase in
                if phase == .connected, !runtime.isSoloMode {
                    dismiss()
                }
            }
        }
    }
}
