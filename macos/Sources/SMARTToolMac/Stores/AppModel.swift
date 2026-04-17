import AppKit
import Foundation

@MainActor
final class AppModel: ObservableObject {
    private static let syncFolderDefaultsKey = "SMARTToolMac.syncFolderPath"

    @Published var reloadToken = 0
    @Published var syncFolderPath: String?
    @Published private(set) var launchURL: URL?
    @Published private(set) var currentPageURL: URL?
    @Published private(set) var currentPageTitle = "SMART Tool"
    @Published private(set) var webStatusSummary = "Starting SMART Tool…"
    @Published private(set) var lastTelemetryEvent = "Native shell ready."
    @Published private(set) var lastLoadedAt: Date?
    @Published private(set) var launchFailureMessage: String?

    init() {
        syncFolderPath = UserDefaults.standard.string(forKey: Self.syncFolderDefaultsKey)
        Task { [weak self] in
            await self?.configureLaunchURL()
        }
    }

    var syncFolderURL: URL? {
        guard let syncFolderPath, !syncFolderPath.isEmpty else {
            return nil
        }

        return URL(fileURLWithPath: syncFolderPath, isDirectory: true)
    }

    var currentPageDescription: String {
        if let currentPageURL {
            return currentPageURL.absoluteString
        }

        return "Not loaded yet"
    }

    var desktopBridgeVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1"
    }

    func requestReload() {
        reloadToken += 1
        AppTelemetry.commands.info("Requested workspace reload.")
        lastTelemetryEvent = "Requested workspace reload."
        Task { [weak self] in
            await self?.configureLaunchURL()
        }
    }

    func chooseSyncFolder() {
        guard let chosenFolder = SyncFolderService.chooseFolder(currentFolderURL: syncFolderURL) else {
            AppTelemetry.sync.info("Sync folder selection cancelled.")
            lastTelemetryEvent = "Cancelled sync folder selection."
            return
        }

        updateSyncFolder(chosenFolder)
    }

    func updateSyncFolder(_ folderURL: URL?) {
        syncFolderPath = folderURL?.path
        UserDefaults.standard.set(syncFolderPath, forKey: Self.syncFolderDefaultsKey)

        if let folderURL {
            AppTelemetry.sync.info("Selected sync folder: \(folderURL.path, privacy: .public)")
            lastTelemetryEvent = "Selected sync folder."
        } else {
            AppTelemetry.sync.info("Cleared sync folder.")
            lastTelemetryEvent = "Cleared sync folder."
        }
    }

    func clearSyncFolder() {
        updateSyncFolder(nil)
    }

    func openSyncFolderInFinder() {
        guard let syncFolderURL else { return }

        NSWorkspace.shared.activateFileViewerSelecting([syncFolderURL])
        AppTelemetry.sync.info("Opened sync folder in Finder.")
        lastTelemetryEvent = "Opened sync folder in Finder."
    }

    func openCurrentPageInBrowser() {
        guard let url = currentPageURL ?? launchURL else { return }

        NSWorkspace.shared.open(url)
        AppTelemetry.commands.info("Opened current page in browser: \(url.absoluteString, privacy: .public)")
        lastTelemetryEvent = "Opened current page in browser."
    }

    func updateWebLocation(title: String?, url: URL?) {
        if let title, !title.isEmpty {
            currentPageTitle = title
        }

        if let url {
            currentPageURL = url
        }
    }

    func recordWebEvent(_ message: String, loadedAt: Date? = nil) {
        lastTelemetryEvent = message

        if let loadedAt {
            lastLoadedAt = loadedAt
        }

        webStatusSummary = message
    }

    func desktopSyncStatePayload() -> [String: Any] {
        [
            "folderPath": syncFolderPath ?? NSNull(),
            "folderName": syncFolderURL?.lastPathComponent ?? NSNull(),
        ]
    }

    func selectSyncFolderFromWebView() -> [String: Any]? {
        guard let chosenFolder = SyncFolderService.chooseFolder(currentFolderURL: syncFolderURL) else {
            AppTelemetry.sync.info("Web view sync folder selection cancelled.")
            lastTelemetryEvent = "Cancelled sync folder selection."
            return nil
        }

        updateSyncFolder(chosenFolder)
        return desktopSyncStatePayload()
    }

    func clearSyncFolderFromWebView() -> [String: Any] {
        clearSyncFolder()
        return ["ok": true]
    }

    func writeTextFileFromWebView(filename: String, content: String) throws -> [String: Any] {
        guard let syncFolderURL else {
            throw NSError(domain: "SMARTToolMac", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "No sync folder is configured.",
            ])
        }

        let safeFilename = URL(fileURLWithPath: filename).lastPathComponent
        guard !safeFilename.isEmpty else {
            throw NSError(domain: "SMARTToolMac", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "A filename is required.",
            ])
        }

        let targetURL = syncFolderURL.appendingPathComponent(safeFilename)
        try FileManager.default.createDirectory(at: syncFolderURL, withIntermediateDirectories: true)
        try String(content).write(to: targetURL, atomically: true, encoding: .utf8)

        AppTelemetry.sync.info("Wrote sync export to \(targetURL.path, privacy: .public)")
        lastTelemetryEvent = "Wrote sync export."
        return ["path": targetURL.path]
    }

    private func configureLaunchURL() async {
        launchFailureMessage = nil

        if let developmentServerURL = WebArchiveLocator.developmentServerURL() {
            launchURL = developmentServerURL
            currentPageURL = developmentServerURL
            webStatusSummary = "Using development server at \(developmentServerURL.absoluteString)."
            AppTelemetry.web.info("Using development server URL \(developmentServerURL.absoluteString, privacy: .public)")
            return
        }

        guard let webRoot = WebArchiveLocator.bundledWebRootURL() ?? WebArchiveLocator.repoFallbackWebRootURL() else {
            launchURL = nil
            currentPageURL = nil
            launchFailureMessage = "The native macOS shell could not find a bundled SMART Tool build."
            webStatusSummary = "No bundled web build found yet. Run `./script/build_and_run.sh` first."
            AppTelemetry.web.error("Bundled SMART Tool build was not found.")
            return
        }

        do {
            let baseURL = try await BundledWebServer.shared.start(rootDirectory: webRoot)
            let workspaceURL = baseURL.appending(path: "index.html")
            launchURL = workspaceURL
            currentPageURL = workspaceURL
            webStatusSummary = "Serving bundled workspace from \(baseURL.absoluteString)."
            AppTelemetry.web.info("Serving bundled workspace from \(baseURL.absoluteString, privacy: .public)")
        } catch {
            launchURL = nil
            currentPageURL = nil
            launchFailureMessage = "SMART Tool could not start its local web content server."
            webStatusSummary = error.localizedDescription
            AppTelemetry.web.error("Failed to start bundled web server: \(error.localizedDescription, privacy: .public)")
        }
    }
}
