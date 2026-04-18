import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        AppTelemetry.app.info("Application finished launching.")
    }

    func applicationWillTerminate(_ notification: Notification) {
        BundledWebServer.shared.stop()
        Task {
            await DesktopAcceleratorService.shared.shutdown()
        }
        AppTelemetry.app.info("Application will terminate.")
    }
}
