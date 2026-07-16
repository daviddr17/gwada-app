import SwiftUI
import VisionKit

/// Kamera-Scan für Gutschein-QR (DataScanner, iOS 17+).
struct PosGiftVoucherScannerView: View {
    var onCode: (String) -> Void
    var onCancel: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if DataScannerViewController.isSupported,
                   DataScannerViewController.isAvailable
                {
                    DataScannerRepresentable(onCode: onCode)
                } else {
                    ContentUnavailableView(
                        "Kamera-Scan nicht verfügbar",
                        systemImage: "qrcode.viewfinder",
                        description: Text("Bitte den Gutscheincode manuell eingeben.")
                    )
                }
            }
            .navigationTitle("Gutschein scannen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen", action: onCancel)
                }
            }
        }
    }
}

private struct DataScannerRepresentable: UIViewControllerRepresentable {
    var onCode: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        vc.delegate = context.coordinator
        try? vc.startScanning()
        return vc
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCode: onCode)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCode: (String) -> Void
        private var handled = false

        init(onCode: @escaping (String) -> Void) {
            self.onCode = onCode
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didTapOn item: RecognizedItem
        ) {
            handle(item)
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            if let first = addedItems.first {
                handle(first)
            }
        }

        private func handle(_ item: RecognizedItem) {
            guard !handled else { return }
            if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
                handled = true
                onCode(value)
            }
        }
    }
}
