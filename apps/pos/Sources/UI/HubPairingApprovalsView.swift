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
