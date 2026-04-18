import Foundation
import OSLog

enum AppTelemetry {
    static let subsystem = Bundle.main.bundleIdentifier ?? "uk.smarttool.macos"

    static let app = Logger(subsystem: subsystem, category: "AppLifecycle")
    static let window = Logger(subsystem: subsystem, category: "Windowing")
    static let sidebar = Logger(subsystem: subsystem, category: "Sidebar")
    static let commands = Logger(subsystem: subsystem, category: "Commands")
    static let sync = Logger(subsystem: subsystem, category: "Sync")
    static let web = Logger(subsystem: subsystem, category: "WebView")
}
