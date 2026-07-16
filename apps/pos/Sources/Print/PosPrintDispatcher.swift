import Foundation

/// Druckt pending Jobs sofort im Hintergrund — parallel, UI bleibt frei.
actor PosPrintDispatcher {
    static let shared = PosPrintDispatcher()

    private var draining = false

    func kick() async {
        await drain()
    }

    private func drain() async {
        guard !draining else { return }
        draining = true
        defer { draining = false }

        for _ in 0 ..< 8 {
            let jobs = PosHubState.shared.dequeuePendingPrintJobs(limit: 12)
            guard !jobs.isEmpty else { return }

            await withTaskGroup(of: Void.self) { group in
                for job in jobs {
                    group.addTask {
                        await Self.printOne(job)
                    }
                }
            }
        }
    }

    private static func printOne(_ job: PosPrintJobSnapshot) async {
        let restaurant = PosHubState.shared.restaurantName

        if job.connectionType == "virtual" {
            PosHubState.shared.markPrintJob(id: job.id, status: "printed", error: nil)
            return
        }

        guard !job.host.isEmpty else {
            PosHubState.shared.markPrintJob(
                id: job.id,
                status: "failed",
                error: "Keine Drucker-IP"
            )
            return
        }

        let payload = EscPosTicketBuilder.kitchenTicket(
            restaurantName: restaurant,
            orderNumber: job.orderNumber,
            printerName: job.printerName,
            lines: job.lines
        )

        do {
            try await PosNetworkPrinterClient.send(
                host: job.host,
                port: job.port,
                payload: payload
            )
            PosHubState.shared.markPrintJob(id: job.id, status: "printed", error: nil)
        } catch {
            PosHubState.shared.markPrintJob(
                id: job.id,
                status: "failed",
                error: error.localizedDescription
            )
        }
    }
}
