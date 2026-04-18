import CryptoKit
import Darwin
import Foundation

private struct DesktopAcceleratorManifest: Decodable {
    let version: Int
    let defaultModelId: String
    let models: [DesktopAcceleratorModel]
}

private struct DesktopAcceleratorModel: Decodable {
    let id: String
    let filename: String
    let downloadURL: String?
    let sha256: String?
    let sizeBytes: Int?
    let contextSize: Int?
    let runtime: DesktopAcceleratorRuntime?
}

private struct DesktopAcceleratorRuntime: Decodable {
    let threads: String?
    let gpuLayers: Int?
    let contextSize: Int?
    let platformOverrides: [String: DesktopAcceleratorRuntime]?
}

private struct DesktopAcceleratorState {
    var ok: Bool
    var status: String
    var ready: Bool
    var backend: String?
    var modelId: String?
    var message: String?
}

struct DesktopAcceleratorGenerationConfig: Sendable {
    let maxNewTokens: Int
    let temperature: Double
    let topP: Double
    let repetitionPenalty: Double

    static func from(dictionary: [String: Any]) -> DesktopAcceleratorGenerationConfig {
        DesktopAcceleratorGenerationConfig(
            maxNewTokens: DesktopAcceleratorService.intValue(dictionary["max_new_tokens"], default: 320),
            temperature: DesktopAcceleratorService.doubleValue(dictionary["temperature"], default: 0),
            topP: DesktopAcceleratorService.doubleValue(dictionary["top_p"], default: 1),
            repetitionPenalty: DesktopAcceleratorService.doubleValue(dictionary["repetition_penalty"], default: 1.1)
        )
    }
}

struct DesktopAcceleratorStatusPayload: Sendable {
    let ok: Bool
    let status: String
    let ready: Bool
    let backend: String?
    let modelId: String?
    let message: String?

    func dictionary() -> [String: Any] {
        [
            "ok": ok,
            "status": status,
            "ready": ready,
            "backend": backend ?? NSNull(),
            "model_id": modelId ?? NSNull(),
            "message": message ?? NSNull(),
        ]
    }
}

struct DesktopAcceleratorGeneratePayload: Sendable {
    let text: String
    let tokensGenerated: Int
    let timeMs: Int
    let backend: String

    func dictionary() -> [String: Any] {
        [
            "text": text,
            "tokens_generated": tokensGenerated,
            "time_ms": timeMs,
            "backend": backend,
        ]
    }
}

struct DesktopAcceleratorOKPayload: Sendable {
    let ok: Bool

    func dictionary() -> [String: Any] {
        ["ok": ok]
    }
}

enum DesktopAcceleratorServiceError: LocalizedError {
    case configuration(String)
    case request(String)
    case runtime(String)

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .request(let message), .runtime(let message):
            message
        }
    }
}

actor DesktopAcceleratorService {
    static let shared = DesktopAcceleratorService()

    private let host = "127.0.0.1"
    private let internalPort = 43118
    private let pollIntervalNs: UInt64 = 250_000_000
    private let readyTimeoutNs: UInt64 = 30_000_000_000
    private let shutdownGraceNs: UInt64 = 2_000_000_000
    private let session = URLSession.shared
    private let defaultSearchPaths = [
        "/opt/homebrew/bin/llama-server",
        "/usr/local/bin/llama-server",
        "/usr/bin/llama-server",
    ]

    private var state = DesktopAcceleratorState(
        ok: false,
        status: "not-installed",
        ready: false,
        backend: nil,
        modelId: nil,
        message: "Desktop Accelerator is not configured."
    )
    private var manifestCache: DesktopAcceleratorManifest?
    private var process: Process?
    private var stdoutTail: [String] = []
    private var stderrTail: [String] = []
    private var lastGPULayers = 0

    private init() {}

    func health() -> DesktopAcceleratorStatusPayload {
        let modelId = state.modelId ?? defaultModelId()
        if let configError = configurationError(modelId: modelId), state.status != "ready" {
            return payload(
                for: DesktopAcceleratorState(
                    ok: false,
                    status: "not-installed",
                    ready: false,
                    backend: nil,
                    modelId: modelId,
                    message: configError
                )
            )
        }

        if process == nil, state.status == "ready" {
            return payload(
                for: DesktopAcceleratorState(
                    ok: false,
                    status: "warming-up",
                    ready: false,
                    backend: state.backend ?? backendLabel(for: lastGPULayers),
                    modelId: modelId,
                    message: "Desktop Accelerator is idle. Call /load to warm it up again."
                )
            )
        }

        return payload(for: state)
    }

    func load(modelId: String) async throws -> DesktopAcceleratorStatusPayload {
        if process != nil, state.ready, state.modelId == modelId {
            return health()
        }

        if let configError = configurationError(modelId: modelId) {
            throw DesktopAcceleratorServiceError.configuration(configError)
        }

        let model = try resolveModel(for: modelId)
        let modelURL = try await ensureModel(for: model)
        let runtime = try await startServer(modelURL: modelURL, model: model)

        state = DesktopAcceleratorState(
            ok: true,
            status: "ready",
            ready: true,
            backend: runtime.backend,
            modelId: model.id,
            message: "Desktop Accelerator is ready."
        )

        return health()
    }

    func generate(prompt: String, config: DesktopAcceleratorGenerationConfig) async throws -> DesktopAcceleratorGeneratePayload {
        guard process != nil, state.ready else {
            throw DesktopAcceleratorServiceError.request("Desktop Accelerator is not ready. Call /load first.")
        }

        let start = Date()
        var request = URLRequest(url: URL(string: "http://\(host):\(internalPort)/completion")!)
        request.httpMethod = "POST"
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "prompt": prompt,
            "stream": false,
            "n_predict": config.maxNewTokens,
            "temperature": config.temperature,
            "top_p": config.topP,
            "repeat_penalty": config.repetitionPenalty,
        ])

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DesktopAcceleratorServiceError.runtime("Desktop Accelerator returned an invalid response.")
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "llama.cpp request failed (\(httpResponse.statusCode))."
            throw DesktopAcceleratorServiceError.runtime(message)
        }

        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        return DesktopAcceleratorGeneratePayload(
            text: payload["content"] as? String ?? payload["response"] as? String ?? "",
            tokensGenerated: payload["tokens_predicted"] as? Int ?? payload["tokens_evaluated"] as? Int ?? 0,
            timeMs: Int(Date().timeIntervalSince(start) * 1000),
            backend: state.backend ?? backendLabel(for: lastGPULayers)
        )
    }

    func unload() async -> DesktopAcceleratorOKPayload {
        await stopProcess()
        state = DesktopAcceleratorState(
            ok: false,
            status: configurationError(modelId: state.modelId ?? defaultModelId()) == nil ? "warming-up" : "not-installed",
            ready: false,
            backend: backendLabel(for: lastGPULayers),
            modelId: state.modelId ?? defaultModelId(),
            message: configurationError(modelId: state.modelId ?? defaultModelId()) ?? "Desktop Accelerator unloaded. Call /load to warm it up again."
        )
        AppTelemetry.accelerator.info("Desktop Accelerator unloaded.")
        return DesktopAcceleratorOKPayload(ok: true)
    }

    func shutdown() async {
        _ = await unload()
    }

    private func payload(for state: DesktopAcceleratorState) -> DesktopAcceleratorStatusPayload {
        DesktopAcceleratorStatusPayload(
            ok: state.ok,
            status: state.status,
            ready: state.ready,
            backend: state.backend,
            modelId: state.modelId,
            message: state.message
        )
    }

    private func defaultModelId() -> String {
        (try? manifest().defaultModelId) ?? "smart-tool-planner-gguf-v1"
    }

    private func manifest() throws -> DesktopAcceleratorManifest {
        if let manifestCache {
            return manifestCache
        }

        let manifestURL = try manifestFileURL()
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let manifest = try decoder.decode(DesktopAcceleratorManifest.self, from: Data(contentsOf: manifestURL))
        manifestCache = manifest
        return manifest
    }

    private func manifestFileURL() throws -> URL {
        if let bundled = Bundle.main.resourceURL?
            .appendingPathComponent("DesktopAccelerator", isDirectory: true)
            .appendingPathComponent("manifest.json"),
           FileManager.default.fileExists(atPath: bundled.path) {
            return bundled
        }

        let repoFallback = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("desktop-helper", isDirectory: true)
            .appendingPathComponent("desktop-accelerator.manifest.json")
        if FileManager.default.fileExists(atPath: repoFallback.path) {
            return repoFallback
        }

        throw DesktopAcceleratorServiceError.configuration("Desktop Accelerator manifest not found in app resources.")
    }

    private func resolveModel(for modelId: String) throws -> DesktopAcceleratorModel {
        let manifest = try manifest()
        guard let model = manifest.models.first(where: { $0.id == modelId }) else {
            throw DesktopAcceleratorServiceError.configuration("No model manifest entry configured for \(modelId).")
        }
        return applyEnvironmentOverrides(to: model)
    }

    private func applyEnvironmentOverrides(to model: DesktopAcceleratorModel) -> DesktopAcceleratorModel {
        let env = ProcessInfo.processInfo.environment
        return DesktopAcceleratorModel(
            id: model.id,
            filename: env["SMART_TOOL_HELPER_MODEL_FILENAME"]?.isEmpty == false ? env["SMART_TOOL_HELPER_MODEL_FILENAME"]! : model.filename,
            downloadURL: env["SMART_TOOL_HELPER_MODEL_URL"]?.isEmpty == false ? env["SMART_TOOL_HELPER_MODEL_URL"]! : model.downloadURL,
            sha256: env["SMART_TOOL_HELPER_MODEL_SHA256"]?.isEmpty == false ? env["SMART_TOOL_HELPER_MODEL_SHA256"]! : model.sha256,
            sizeBytes: Int(env["SMART_TOOL_HELPER_MODEL_SIZE_BYTES"] ?? "") ?? model.sizeBytes,
            contextSize: model.contextSize,
            runtime: model.runtime
        )
    }

    private func configurationError(modelId: String) -> String? {
        guard let model = try? resolveModel(for: modelId) else {
            return "No model manifest entry configured for \(modelId)."
        }
        guard let downloadURL = model.downloadURL, !downloadURL.isEmpty else {
            return "No download URL configured for \(model.id)."
        }
        guard URL(string: downloadURL) != nil else {
            return "Desktop Accelerator model URL is invalid."
        }
        guard llamaServerBinaryURL() != nil else {
            return "Desktop Accelerator could not find a local llama-server binary."
        }
        return nil
    }

    private func appSupportDirectoryURL() -> URL {
        if let override = ProcessInfo.processInfo.environment["SMART_TOOL_HELPER_MODEL_DIR"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }

        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Library", isDirectory: true)
                .appendingPathComponent("Application Support", isDirectory: true)
        return root
            .appendingPathComponent("Smart Tool", isDirectory: true)
            .appendingPathComponent("Desktop Helper", isDirectory: true)
    }

    private func modelFileURL(for model: DesktopAcceleratorModel) -> URL {
        appSupportDirectoryURL()
            .appendingPathComponent("models", isDirectory: true)
            .appendingPathComponent(model.filename, isDirectory: false)
    }

    private func contextSize(for model: DesktopAcceleratorModel) -> Int {
        if let override = Int(ProcessInfo.processInfo.environment["SMART_TOOL_HELPER_CTX"] ?? "") {
            return override
        }
        let runtime = runtimeSettings(for: model)
        return model.contextSize ?? runtime.contextSize ?? 4096
    }

    private func gpuLayers(for model: DesktopAcceleratorModel) -> Int {
        if let override = Int(ProcessInfo.processInfo.environment["SMART_TOOL_HELPER_GPU_LAYERS"] ?? "") {
            return max(0, override)
        }
        let runtime = runtimeSettings(for: model)
        return max(0, runtime.gpuLayers ?? 0)
    }

    private func runtimeSettings(for model: DesktopAcceleratorModel) -> DesktopAcceleratorRuntime {
        let runtime = model.runtime ?? DesktopAcceleratorRuntime(
            threads: nil,
            gpuLayers: nil,
            contextSize: nil,
            platformOverrides: nil
        )
        let platformKey = "\(platformIdentifier())-\(architectureIdentifier())"
        return runtime.platformOverrides?[platformKey] ?? runtime
    }

    private func backendLabel(for gpuLayers: Int) -> String {
        gpuLayers > 0 ? "llama.cpp-gpu" : "llama.cpp-cpu"
    }

    private func llamaServerBinaryURL() -> URL? {
        let env = ProcessInfo.processInfo.environment
        if let override = env["SMART_TOOL_LLAMA_SERVER_BIN"], !override.isEmpty {
            let url = URL(fileURLWithPath: override)
            if FileManager.default.isExecutableFile(atPath: url.path) {
                return url
            }
        }

        let bundledCandidates = [
            Bundle.main.resourceURL?.appendingPathComponent("DesktopAccelerator/llama-server", isDirectory: false),
            Bundle.main.resourceURL?.appendingPathComponent("DesktopAccelerator/llama-server.exe", isDirectory: false),
        ]

        for candidate in bundledCandidates.compactMap({ $0 }) where FileManager.default.isExecutableFile(atPath: candidate.path) {
            return candidate
        }

        for path in defaultSearchPaths where FileManager.default.isExecutableFile(atPath: path) {
            return URL(fileURLWithPath: path)
        }

        return nil
    }

    private func threadsCount() -> Int {
        if let override = Int(ProcessInfo.processInfo.environment["SMART_TOOL_HELPER_THREADS"] ?? "") {
            return max(1, override)
        }
        return max(1, ProcessInfo.processInfo.processorCount - 1)
    }

    private func validateModelFile(at fileURL: URL, model: DesktopAcceleratorModel) throws -> Bool {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return false
        }

        if let sizeBytes = model.sizeBytes {
            let values = try fileURL.resourceValues(forKeys: [.fileSizeKey])
            if values.fileSize != sizeBytes {
                return false
            }
        }

        if let sha256 = model.sha256, !sha256.isEmpty {
            return try sha256Hex(for: fileURL) == normalizedSHA256(sha256)
        }

        return true
    }

    private func ensureModel(for model: DesktopAcceleratorModel) async throws -> URL {
        let targetURL = modelFileURL(for: model)
        if try validateModelFile(at: targetURL, model: model) {
            return targetURL
        }

        try? FileManager.default.removeItem(at: targetURL)
        state = DesktopAcceleratorState(
            ok: false,
            status: "downloading-model",
            ready: false,
            backend: backendLabel(for: gpuLayers(for: model)),
            modelId: model.id,
            message: "Downloading planner model to local app data."
        )
        AppTelemetry.accelerator.info("Model download started for \(model.id, privacy: .public).")
        try await downloadModel(model, to: targetURL)
        AppTelemetry.accelerator.info("Model download finished for \(model.id, privacy: .public).")
        return targetURL
    }

    private func downloadModel(_ model: DesktopAcceleratorModel, to targetURL: URL) async throws {
        guard let downloadURLString = model.downloadURL, let downloadURL = URL(string: downloadURLString) else {
            throw DesktopAcceleratorServiceError.configuration("Desktop Accelerator model URL is invalid.")
        }

        let directoryURL = targetURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true, attributes: nil)

        let partURL = targetURL.appendingPathExtension("part")
        try? FileManager.default.removeItem(at: partURL)

        let (temporaryURL, response) = try await session.download(from: downloadURL)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw DesktopAcceleratorServiceError.runtime("Model download failed.")
        }

        try FileManager.default.moveItem(at: temporaryURL, to: partURL)
        guard try validateModelFile(at: partURL, model: model) else {
            try? FileManager.default.removeItem(at: partURL)
            throw DesktopAcceleratorServiceError.runtime("Downloaded model failed checksum or size validation.")
        }

        try? FileManager.default.removeItem(at: targetURL)
        try FileManager.default.moveItem(at: partURL, to: targetURL)
    }

    private func sha256Hex(for fileURL: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: fileURL)
        var hasher = SHA256()

        defer {
            try? handle.close()
        }

        while true {
            let data = try handle.read(upToCount: 1_048_576) ?? Data()
            if data.isEmpty {
                break
            }
            hasher.update(data: data)
        }

        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func normalizedSHA256(_ value: String) -> String {
        value
            .replacingOccurrences(of: "sha256:", with: "", options: [.caseInsensitive])
            .replacingOccurrences(of: "\"", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func startServer(modelURL: URL, model: DesktopAcceleratorModel) async throws -> (backend: String, gpuLayers: Int) {
        await stopProcess()
        stdoutTail = []
        stderrTail = []

        let preferredGPULayers = gpuLayers(for: model)
        let attempts = preferredGPULayers > 0 ? [preferredGPULayers, 0] : [0]
        var lastError: Error?

        for gpuLayers in Array(NSOrderedSet(array: attempts)) as? [Int] ?? attempts {
            let startedAt = Date()
            state = DesktopAcceleratorState(
                ok: false,
                status: "warming-up",
                ready: false,
                backend: backendLabel(for: gpuLayers),
                modelId: model.id,
                message: "Starting Desktop Accelerator runtime."
            )

            AppTelemetry.accelerator.info(
                "Runtime warm-up started for \(model.id, privacy: .public) via \(self.backendLabel(for: gpuLayers), privacy: .public)."
            )

            do {
                try launchProcess(modelURL: modelURL, model: model, gpuLayers: gpuLayers)
                try await waitForInternalReady()
                AppTelemetry.accelerator.info(
                    "Runtime warm-up finished for \(model.id, privacy: .public) in \(Int(Date().timeIntervalSince(startedAt) * 1000), privacy: .public) ms."
                )
                return (backendLabel(for: gpuLayers), gpuLayers)
            } catch {
                lastError = error
                AppTelemetry.accelerator.error(
                    "Runtime warm-up failed for \(model.id, privacy: .public): \(error.localizedDescription, privacy: .public)"
                )
                await stopProcess()
                if gpuLayers == 0 {
                    break
                }
            }
        }

        throw lastError ?? DesktopAcceleratorServiceError.runtime("Desktop Accelerator failed to start.")
    }

    private func launchProcess(modelURL: URL, model: DesktopAcceleratorModel, gpuLayers: Int) throws {
        guard let executableURL = llamaServerBinaryURL() else {
            throw DesktopAcceleratorServiceError.configuration("Desktop Accelerator could not find a local llama-server binary.")
        }

        let process = Process()
        process.executableURL = executableURL
        process.arguments = [
            "--host", host,
            "--port", String(internalPort),
            "-m", modelURL.path,
            "-c", String(contextSize(for: model)),
            "-t", String(threadsCount()),
            "-ngl", String(gpuLayers),
        ]
        process.environment = ProcessInfo.processInfo.environment

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else {
                return
            }
            Task {
                await self?.appendStdout(text)
            }
        }

        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else {
                return
            }
            Task {
                await self?.appendStderr(text)
            }
        }

        process.terminationHandler = { [weak self] terminatedProcess in
            Task {
                await self?.handleProcessExit(terminatedProcess, modelId: model.id, gpuLayers: gpuLayers)
            }
        }

        try process.run()
        self.process = process
        self.lastGPULayers = gpuLayers
    }

    private func appendStdout(_ text: String) {
        appendOutput(text, to: &stdoutTail)
    }

    private func appendStderr(_ text: String) {
        appendOutput(text, to: &stderrTail)
    }

    private func appendOutput(_ text: String, to target: inout [String]) {
        let lines = text
            .split(whereSeparator: \.isNewline)
            .map { String($0) }
            .filter { !$0.isEmpty }
        target.append(contentsOf: lines)
        if target.count > 20 {
            target.removeFirst(target.count - 20)
        }
    }

    private func handleProcessExit(_ terminatedProcess: Process, modelId: String, gpuLayers: Int) {
        guard process?.processIdentifier == terminatedProcess.processIdentifier else {
            return
        }

        process = nil
        state = DesktopAcceleratorState(
            ok: false,
            status: "error",
            ready: false,
            backend: backendLabel(for: gpuLayers),
            modelId: modelId,
            message: "llama.cpp exited with code \(terminatedProcess.terminationStatus)."
        )
        AppTelemetry.accelerator.error(
            "Runtime exited for \(modelId, privacy: .public) with code \(terminatedProcess.terminationStatus, privacy: .public)."
        )
    }

    private func waitForInternalReady() async throws {
        let deadline = DispatchTime.now().uptimeNanoseconds + readyTimeoutNs
        while DispatchTime.now().uptimeNanoseconds < deadline {
            do {
                let (_, response) = try await session.data(from: URL(string: "http://\(host):\(internalPort)/health")!)
                if let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) {
                    return
                }
            } catch {
                // Keep polling while llama.cpp warms up.
            }
            try await Task.sleep(nanoseconds: pollIntervalNs)
        }

        throw DesktopAcceleratorServiceError.runtime(
            stderrTail.last ?? stdoutTail.last ?? "llama.cpp server did not become ready in time."
        )
    }

    private func stopProcess() async {
        guard let process else {
            return
        }

        self.process = nil

        if process.isRunning {
            process.terminate()
            let deadline = DispatchTime.now().uptimeNanoseconds + shutdownGraceNs
            while process.isRunning, DispatchTime.now().uptimeNanoseconds < deadline {
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if process.isRunning {
                kill(process.processIdentifier, SIGKILL)
                while process.isRunning {
                    try? await Task.sleep(nanoseconds: 50_000_000)
                }
            }
        }

        if let stdoutPipe = process.standardOutput as? Pipe {
            stdoutPipe.fileHandleForReading.readabilityHandler = nil
        }
        if let stderrPipe = process.standardError as? Pipe {
            stderrPipe.fileHandleForReading.readabilityHandler = nil
        }
    }

    private func platformIdentifier() -> String {
        "darwin"
    }

    private func architectureIdentifier() -> String {
#if arch(arm64)
        "arm64"
#elseif arch(x86_64)
        "x64"
#else
        "unknown"
#endif
    }

    static func intValue(_ value: Any?, default defaultValue: Int) -> Int {
        switch value {
        case let value as Int:
            value
        case let value as Double:
            Int(value)
        case let value as NSNumber:
            value.intValue
        case let value as String:
            Int(value) ?? defaultValue
        default:
            defaultValue
        }
    }

    static func doubleValue(_ value: Any?, default defaultValue: Double) -> Double {
        switch value {
        case let value as Double:
            value
        case let value as Int:
            Double(value)
        case let value as NSNumber:
            value.doubleValue
        case let value as String:
            Double(value) ?? defaultValue
        default:
            defaultValue
        }
    }
}
