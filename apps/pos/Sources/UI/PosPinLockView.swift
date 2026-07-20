import SwiftUI

/// 6-Stellen PIN-Lock (Kellner) — Lockout nach Fehlversuchen.
struct PosPinLockView: View {
    @StateObject private var lock = PosPinLockStore.shared
    @EnvironmentObject private var runtime: PosRuntime

    @State private var digits = ""
    @State private var setupMode = false
    @State private var setupConfirm = ""
    @State private var errorText = ""
    @State private var tick = Date()

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)

    var body: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 24)
            Image(systemName: "lock.fill")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(Color.accentColor)
            Text(setupMode ? "PIN festlegen" : "Kellner-PIN")
                .font(.title2.weight(.bold))
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            pinDots

            if !errorText.isEmpty {
                Text(errorText)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.red)
            }

            if lock.isInLockout {
                Text("Gesperrt noch \(lock.lockoutRemainingSeconds)s")
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { date in
                        tick = date
                        if !lock.isInLockout { errorText = "" }
                    }
            }

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(1 ... 9, id: \.self) { n in
                    keyButton("\(n)") { append("\(n)") }
                }
                Color.clear.frame(height: PosDesign.touchMin)
                keyButton("0") { append("0") }
                keyButton(systemImage: "delete.left") { backspace() }
            }
            .padding(.horizontal, 40)
            .disabled(lock.isInLockout)

            if !lock.hasPinConfigured {
                Button(setupMode ? "Abbrechen" : "PIN einrichten") {
                    setupMode.toggle()
                    digits = ""
                    setupConfirm = ""
                    errorText = ""
                }
                .font(.subheadline.weight(.semibold))
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .onAppear {
            if !lock.hasPinConfigured { setupMode = true }
        }
    }

    private var subtitle: String {
        if setupMode {
            return setupConfirm.isEmpty
                ? "6 Ziffern wählen (nur auf diesem Gerät)."
                : "PIN zur Bestätigung erneut eingeben."
        }
        let name = runtime.snapshot?.restaurantName ?? "Gwada POS"
        return "\(name) · entsperren"
    }

    private var pinDots: some View {
        HStack(spacing: 12) {
            ForEach(0 ..< 6, id: \.self) { i in
                Circle()
                    .fill(i < digits.count ? Color.accentColor : Color(.tertiarySystemFill))
                    .frame(width: 14, height: 14)
            }
        }
        .padding(.vertical, 8)
        .accessibilityLabel("\(digits.count) von 6 Ziffern")
    }

    private func keyButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.title.weight(.semibold).monospacedDigit())
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(PosDesign.cardBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func keyButton(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title2.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(PosDesign.cardBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func append(_ s: String) {
        guard digits.count < 6 else { return }
        digits.append(s)
        errorText = ""
        if digits.count == 6 {
            submit()
        }
    }

    private func backspace() {
        if !digits.isEmpty { digits.removeLast() }
    }

    private func submit() {
        if setupMode {
            if setupConfirm.isEmpty {
                setupConfirm = digits
                digits = ""
                return
            }
            if setupConfirm != digits {
                errorText = "PINs stimmen nicht überein."
                setupConfirm = ""
                digits = ""
                return
            }
            if lock.configurePin(digits) {
                setupMode = false
                digits = ""
                setupConfirm = ""
                errorText = ""
            } else {
                errorText = "PIN ungültig."
                digits = ""
            }
            return
        }

        if lock.unlock(with: digits) {
            digits = ""
            errorText = ""
        } else {
            errorText = lock.isInLockout ? "Zu viele Fehlversuche." : "Falsche PIN."
            digits = ""
        }
    }
}
