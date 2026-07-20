import SwiftUI

/// Formale Buchführungs-Rechnung aus einer POS-Quittung (nur online am Hub).
struct FormalInvoiceSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss

    let paymentId: String
    var onFinished: (() -> Void)?

    @State private var loading = true
    @State private var saving = false
    @State private var stornoBusy = false
    @State private var errorText = ""
    @State private var draft: PosCloudClient.FormalInvoiceDraftDto?

    @State private var companyName = ""
    @State private var personName = ""
    @State private var street = ""
    @State private var zip = ""
    @State private var city = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var voucherDate = ""

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Lade Entwurf …")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let draft {
                    Form {
                        if !errorText.isEmpty {
                            Section {
                                Text(errorText)
                                    .foregroundStyle(.red)
                            }
                        }

                        if draft.alreadyInvoiced && !draft.isStornoed {
                            alreadyInvoicedSection(draft)
                        } else {
                            if draft.isStornoed {
                                Section {
                                    Text(stornoHint(draft))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            summarySection(draft)
                            addressSection
                        }
                    }
                } else {
                    ContentUnavailableView {
                        Label("Entwurf nicht verfügbar", systemImage: "doc.text")
                    } description: {
                        Text(errorText.isEmpty
                            ? "Formale Rechnung konnte nicht geladen werden."
                            : errorText)
                    }
                }
            }
            .navigationTitle("Formale Rechnung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                if let draft, !draft.alreadyInvoiced || draft.isStornoed {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Erstellen") {
                            Task { await createInvoice() }
                        }
                        .disabled(saving || !canCreate)
                    }
                }
            }
            .task { await loadDraft() }
        }
    }

    @ViewBuilder
    private func alreadyInvoicedSection(_ draft: PosCloudClient.FormalInvoiceDraftDto) -> some View {
        Section {
            Text("Für diese Quittung gibt es schon eine formale Rechnung\(draft.existingInvoiceNumber.map { " (\($0))" } ?? "").")
                .foregroundStyle(.secondary)
            Button(role: .destructive) {
                Task { await stornoInvoice() }
            } label: {
                if stornoBusy {
                    Label("Storniere …", systemImage: "hourglass")
                } else {
                    Label("Rechnung stornieren", systemImage: "xmark.circle")
                }
            }
            .disabled(stornoBusy)
        } header: {
            Text("Bereits verrechnet")
        }
    }

    @ViewBuilder
    private func summarySection(_ draft: PosCloudClient.FormalInvoiceDraftDto) -> some View {
        Section("Bon") {
            HStack {
                Text("#\(draft.orderNumber)")
                Spacer()
                Text(PosMoney.format(draft.amountCents + draft.tipCents))
                    .font(.body.monospacedDigit().weight(.semibold))
            }
            ForEach(draft.lineItems) { line in
                HStack {
                    Text("\(formatQty(line.quantity))× \(line.name)")
                        .lineLimit(1)
                    Spacer()
                    Text(formatEuro(line.lineAmount))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var addressSection: some View {
        Section("Empfänger") {
            TextField("Firmenname (optional)", text: $companyName)
                .textInputAutocapitalization(.words)
            TextField("Name / Ansprechpartner", text: $personName)
                .textInputAutocapitalization(.words)
            TextField("Straße", text: $street)
                .textInputAutocapitalization(.words)
            HStack {
                TextField("PLZ", text: $zip)
                    .keyboardType(.numberPad)
                    .frame(maxWidth: 120)
                TextField("Ort", text: $city)
                    .textInputAutocapitalization(.words)
            }
            TextField("E-Mail", text: $email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Telefon", text: $phone)
                .keyboardType(.phonePad)
            TextField("Rechnungsdatum (JJJJ-MM-TT)", text: $voucherDate)
                .keyboardType(.numbersAndPunctuation)
                .textInputAutocapitalization(.never)
        }
    }

    private var canCreate: Bool {
        let hasName = !companyName.trimmingCharacters(in: .whitespaces).isEmpty
            || !personName.trimmingCharacters(in: .whitespaces).isEmpty
        return hasName
            && !street.trimmingCharacters(in: .whitespaces).isEmpty
            && !zip.trimmingCharacters(in: .whitespaces).isEmpty
            && !city.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func stornoHint(_ draft: PosCloudClient.FormalInvoiceDraftDto) -> String {
        var parts = ["Vorherige Rechnung"]
        if let n = draft.existingInvoiceNumber { parts.append(n) }
        parts.append("ist storniert")
        if let c = draft.existingCorrectionNumber {
            parts.append("(Korrektur \(c))")
        }
        parts.append("— neue Rechnung möglich.")
        return parts.joined(separator: " ")
    }

    private func loadDraft() async {
        loading = true
        errorText = ""
        defer { loading = false }
        if PosAuthStore.shared.isOfflineSession {
            errorText = "Formale Rechnung nur online am Hub."
            draft = nil
            return
        }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            let d = try await PosCloudClient.fetchFormalInvoiceDraft(
                restaurantId: restaurantId,
                paymentId: paymentId
            )
            draft = d
            if let paid = d.paidAt, paid.count >= 10 {
                voucherDate = String(paid.prefix(10))
            } else {
                voucherDate = Self.todayYmd()
            }
        } catch {
            draft = nil
            errorText = Self.friendlyError(error)
        }
    }

    private func createInvoice() async {
        guard canCreate else {
            runtime.announce("Bitte Name und Adresse vollständig ausfüllen.")
            return
        }
        saving = true
        errorText = ""
        defer { saving = false }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            let invoice = try await PosCloudClient.createFormalInvoice(
                restaurantId: restaurantId,
                paymentId: paymentId,
                companyName: trimmedOrNil(companyName),
                personName: trimmedOrNil(personName),
                street: street.trimmingCharacters(in: .whitespacesAndNewlines),
                zip: zip.trimmingCharacters(in: .whitespacesAndNewlines),
                city: city.trimmingCharacters(in: .whitespacesAndNewlines),
                email: trimmedOrNil(email),
                phone: trimmedOrNil(phone),
                voucherDate: trimmedOrNil(voucherDate)
            )
            if let number = invoice.voucher_number, !number.isEmpty {
                runtime.announce("Rechnung \(number) erstellt.")
            } else {
                runtime.announce("Formale Rechnung erstellt.")
            }
            onFinished?()
            dismiss()
        } catch {
            errorText = Self.friendlyError(error)
            runtime.announce("Rechnung fehlgeschlagen: \(errorText)")
        }
    }

    private func stornoInvoice() async {
        stornoBusy = true
        errorText = ""
        defer { stornoBusy = false }
        let restaurantId = PosHubState.shared.restaurantId
        do {
            let storno = try await PosCloudClient.stornoFormalInvoice(
                restaurantId: restaurantId,
                paymentId: paymentId
            )
            if storno.mode == "correction" {
                if let n = storno.correctionNumber, !n.isEmpty {
                    runtime.announce("Korrektur \(n) erstellt.")
                } else {
                    runtime.announce("Rechnungs-Korrektur erstellt.")
                }
            } else if let n = storno.invoiceNumber, !n.isEmpty {
                runtime.announce("Rechnung \(n) storniert.")
            } else {
                runtime.announce("Formale Rechnung storniert.")
            }
            onFinished?()
            dismiss()
        } catch {
            errorText = Self.friendlyError(error)
            runtime.announce("Rechnungsstorno fehlgeschlagen: \(errorText)")
        }
    }

    private func trimmedOrNil(_ value: String) -> String? {
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func formatQty(_ q: Double) -> String {
        if q == floor(q) { return String(Int(q)) }
        return String(format: "%g", q)
    }

    private func formatEuro(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.locale = Locale(identifier: "de_DE")
        return formatter.string(from: NSNumber(value: amount)) ?? String(format: "%.2f €", amount)
    }

    private static func todayYmd() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private static func friendlyError(_ error: Error) -> String {
        guard let cloud = error as? PosCloudError else {
            return error.localizedDescription
        }
        switch cloud {
        case .offline:
            return "Keine Verbindung — formale Rechnung nur online."
        case .httpStatus(let code, let body):
            if code == 403 {
                return "Keine Berechtigung für Rechnungen (Buchführung)."
            }
            if let body, body.contains("payment_not_paid") {
                return "Zahlung ist nicht (mehr) bezahlt."
            }
            if let body, !body.isEmpty { return body }
            return "HTTP \(code)"
        case .unauthorized:
            return "Bitte erneut am Hub anmelden."
        case .missingConfig, .invalidResponse, .missingRestaurant:
            return cloud.localizedDescription
        }
    }
}
