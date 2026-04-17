import Foundation
import Network

final class BundledWebServer: @unchecked Sendable {
    static let shared = BundledWebServer()

    private let queue = DispatchQueue(label: "uk.smarttool.macos.webserver")
    private var listener: NWListener?
    private var rootDirectory: URL?
    private var baseURL: URL?

    private init() {}

    func start(rootDirectory: URL) async throws -> URL {
        if let baseURL, self.rootDirectory == rootDirectory {
            return baseURL
        }

        stop()

        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        self.rootDirectory = rootDirectory

        let resumeState = ResumeState()
        let port = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<UInt16, Error>) in
            listener.stateUpdateHandler = { [weak self, weak listener] state in
                switch state {
                case .ready:
                    guard resumeState.claim(), let listener, let port = listener.port?.rawValue else { return }
                    continuation.resume(returning: port)
                    AppTelemetry.web.info("Bundled web server ready on port \(port, privacy: .public)")
                    self?.listener = listener
                case .failed(let error):
                    guard resumeState.claim() else { return }
                    continuation.resume(throwing: error)
                case .cancelled:
                    guard resumeState.claim() else { return }
                    continuation.resume(throwing: CancellationError())
                default:
                    break
                }
            }

            listener.newConnectionHandler = { [weak self] connection in
                self?.handle(connection)
            }

            listener.start(queue: self.queue)
        }

        let baseURL = URL(string: "http://127.0.0.1:\(port)")!
        self.baseURL = baseURL
        return baseURL
    }

    func stop() {
        listener?.cancel()
        listener = nil
        baseURL = nil
    }

    private func handle(_ connection: NWConnection) {
        guard let rootDirectory else {
            connection.cancel()
            return
        }

        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, _, error in
            guard let self else { return }

            if let error {
                AppTelemetry.web.error("Bundled web server receive failed: \(error.localizedDescription, privacy: .public)")
                connection.cancel()
                return
            }

            guard let data, !data.isEmpty else {
                connection.cancel()
                return
            }

            self.respond(to: connection, requestData: data, rootDirectory: rootDirectory)
        }
    }

    private func respond(to connection: NWConnection, requestData: Data, rootDirectory: URL) {
        guard
            let request = String(data: requestData, encoding: .utf8),
            let requestLine = request.components(separatedBy: "\r\n").first
        else {
            send(status: 400, reason: "Bad Request", body: nil, mimeType: "text/plain", over: connection)
            return
        }

        let parts = requestLine.split(separator: " ", omittingEmptySubsequences: true)
        guard parts.count >= 2 else {
            send(status: 400, reason: "Bad Request", body: nil, mimeType: "text/plain", over: connection)
            return
        }

        let method = String(parts[0])
        let rawPath = String(parts[1])

        guard method == "GET" || method == "HEAD" else {
            send(status: 405, reason: "Method Not Allowed", body: nil, mimeType: "text/plain", over: connection)
            return
        }

        guard let fileURL = resolveFileURL(for: rawPath, rootDirectory: rootDirectory) else {
            send(status: 404, reason: "Not Found", body: nil, mimeType: "text/plain", over: connection)
            return
        }

        do {
            let body = try Data(contentsOf: fileURL)
            let mimeType = mimeType(for: fileURL.pathExtension)
            send(
                status: 200,
                reason: "OK",
                body: method == "HEAD" ? nil : body,
                mimeType: mimeType,
                over: connection,
                contentLength: body.count
            )
        } catch {
            AppTelemetry.web.error("Bundled web server failed to read \(fileURL.path, privacy: .public): \(error.localizedDescription, privacy: .public)")
            send(status: 500, reason: "Internal Server Error", body: nil, mimeType: "text/plain", over: connection)
        }
    }

    private func resolveFileURL(for rawPath: String, rootDirectory: URL) -> URL? {
        let pathWithoutQuery = rawPath.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? "/"
        let decodedPath = pathWithoutQuery.removingPercentEncoding ?? pathWithoutQuery
        let relativePath = decodedPath == "/" ? "index.html" : String(decodedPath.drop(while: { $0 == "/" }))

        let pathComponents = relativePath.split(separator: "/")
        guard !pathComponents.contains("..") else {
            return nil
        }

        let candidate = rootDirectory.appendingPathComponent(relativePath)
        var isDirectory: ObjCBool = false

        if FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory) {
            if isDirectory.boolValue {
                let indexURL = candidate.appendingPathComponent("index.html")
                return FileManager.default.fileExists(atPath: indexURL.path) ? indexURL : nil
            }

            return candidate
        }

        if candidate.pathExtension.isEmpty {
            let spaIndex = rootDirectory.appendingPathComponent("index.html")
            return FileManager.default.fileExists(atPath: spaIndex.path) ? spaIndex : nil
        }

        return nil
    }

    private func send(
        status: Int,
        reason: String,
        body: Data?,
        mimeType: String,
        over connection: NWConnection,
        contentLength: Int? = nil
    ) {
        var headers = [
            "HTTP/1.1 \(status) \(reason)",
            "Content-Type: \(mimeType)",
            "Connection: close",
            "Cross-Origin-Opener-Policy: same-origin",
            "Cross-Origin-Embedder-Policy: credentialless",
            "Cache-Control: no-store",
        ]

        let bodyLength = contentLength ?? body?.count ?? 0
        headers.append("Content-Length: \(bodyLength)")

        let headerData = Data((headers.joined(separator: "\r\n") + "\r\n\r\n").utf8)
        connection.send(content: headerData, completion: .contentProcessed { [weak self] headerError in
            if let headerError {
                AppTelemetry.web.error("Bundled web server failed to send headers: \(headerError.localizedDescription, privacy: .public)")
                connection.cancel()
                return
            }

            guard let body else {
                connection.cancel()
                return
            }

            self?.sendBody(body, over: connection)
        })
    }

    private func sendBody(_ body: Data, over connection: NWConnection) {
        connection.send(content: body, completion: .contentProcessed { bodyError in
            if let bodyError {
                AppTelemetry.web.error("Bundled web server failed to send body: \(bodyError.localizedDescription, privacy: .public)")
            }

            connection.cancel()
        })
    }

    private func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html":
            "text/html; charset=utf-8"
        case "css":
            "text/css; charset=utf-8"
        case "js", "mjs":
            "text/javascript; charset=utf-8"
        case "json":
            "application/json; charset=utf-8"
        case "svg":
            "image/svg+xml"
        case "png":
            "image/png"
        case "jpg", "jpeg":
            "image/jpeg"
        case "ico":
            "image/x-icon"
        case "wasm":
            "application/wasm"
        case "map":
            "application/json; charset=utf-8"
        case "txt":
            "text/plain; charset=utf-8"
        default:
            "application/octet-stream"
        }
    }
}

private final class ResumeState: @unchecked Sendable {
    private let lock = NSLock()
    private var didResume = false

    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }

        if didResume {
            return false
        }

        didResume = true
        return true
    }
}
