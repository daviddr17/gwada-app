import SwiftUI

@main
struct GwadaPOSApp: App {
    @StateObject private var runtime = PosRuntime()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(runtime)
                .task {
                    await runtime.start()
                }
        }
    }
}
