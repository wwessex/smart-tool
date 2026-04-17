import SwiftUI

@main
struct SMARTToolMacApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup("SMART Tool") {
            ContentView(model: model)
                .frame(minWidth: 1180, minHeight: 760)
        }
        .defaultSize(width: 1480, height: 960)
        .commands {
            SmartToolCommands(model: model)
        }
    }
}
