import SwiftUI

@main
struct GwadaPOSApp: App {
    @StateObject private var runtime = PosRuntime()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(runtime)
                .tint(runtime.brandTint)
                .task {
                    await runtime.start()
                }
        }
    }
}
