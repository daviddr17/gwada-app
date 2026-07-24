import SwiftUI

/// iPhone: ohne Pairing kein Betrieb (Kundenpfad — kein Solo).
struct HandheldPairingGateView: View {
    @EnvironmentObject private var runtime: PosRuntime

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "ipad.and.iphone")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)
            Text("Mit der Kasse verbinden")
                .font(.title2.weight(.semibold))
            Text("Schalte die iPad-Kasse ein und scanne den QR-Code (folgt) — oder warte, bis die Kasse im WLAN gefunden wird.")
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
                Text("Erneut nach Kasse suchen")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PosPrimaryButtonStyle())
            .padding(.horizontal, 32)

            #if DEBUG
            Button("DEBUG: Solo ohne Kasse") {
                Task { await runtime.startHandheldSolo(preferCloud: false) }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            #endif
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
    }
}
