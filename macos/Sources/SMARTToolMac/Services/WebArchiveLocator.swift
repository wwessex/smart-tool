import Foundation

enum WebArchiveLocator {
    static func developmentServerURL() -> URL? {
        guard
            let devServer = ProcessInfo.processInfo.environment["SMART_TOOL_DEV_SERVER_URL"],
            let url = URL(string: devServer),
            url.scheme != nil
        else {
            return nil
        }

        return url
    }

    static func bundledWebRootURL() -> URL? {
        guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("WebApp", isDirectory: true) else {
            return nil
        }

        let indexURL = webRoot.appendingPathComponent("index.html")
        return FileManager.default.fileExists(atPath: indexURL.path) ? webRoot : nil
    }

    static func repoFallbackWebRootURL() -> URL? {
        let webRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("dist", isDirectory: true)
        let indexURL = webRoot.appendingPathComponent("index.html")

        return FileManager.default.fileExists(atPath: indexURL.path) ? webRoot : nil
    }
}
