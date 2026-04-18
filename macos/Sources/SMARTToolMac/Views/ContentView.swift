import SwiftUI

struct ContentView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        WorkspaceView(model: model)
            .navigationTitle("SMART Tool")
        .onAppear {
            AppTelemetry.window.info("Main content view appeared.")
        }
    }
}
