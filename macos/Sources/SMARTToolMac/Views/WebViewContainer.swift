import AppKit
import SwiftUI
import WebKit

struct WebViewContainer: NSViewRepresentable {
    let source: URL
    let reloadToken: Int
    let platform: String
    let version: String
    let onDesktopHelperHealth: @MainActor () async -> [String: Any]
    let onDesktopHelperLoad: @MainActor (_ modelId: String) async throws -> [String: Any]
    let onDesktopHelperGenerate: @MainActor (_ prompt: String, _ config: [String: Any]) async throws -> [String: Any]
    let onDesktopHelperUnload: @MainActor () async -> [String: Any]
    let onSyncFolderState: () -> [String: Any]
    let onSyncFolderSelect: () -> [String: Any]?
    let onSyncFolderClear: () -> [String: Any]
    let onSyncWriteFile: (_ filename: String, _ content: String) throws -> [String: Any]
    let onLocationChange: (String?, URL?) -> Void
    let onEvent: (String, Date?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        userContentController.add(context.coordinator, name: Coordinator.messageHandlerName)
        userContentController.add(context.coordinator, name: Coordinator.bridgeHandlerName)
        userContentController.add(context.coordinator, name: Coordinator.diagnosticsHandlerName)
        userContentController.addUserScript(
            WKUserScript(
                source: Coordinator.desktopBridgeScript(platform: platform, version: version),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        userContentController.addUserScript(
            WKUserScript(
                source: Coordinator.stateRelayScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
        )
        userContentController.addUserScript(
            WKUserScript(
                source: Coordinator.diagnosticsScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.setValue(false, forKey: "drawsBackground")

        context.coordinator.attach(to: webView)
        context.coordinator.load(source: source, reloadToken: reloadToken)

        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.attach(to: nsView)

        if context.coordinator.needsReload(for: source, reloadToken: reloadToken) {
            context.coordinator.load(source: source, reloadToken: reloadToken)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        static let messageHandlerName = "shellState"
        static let bridgeHandlerName = "smartToolDesktop"
        static let diagnosticsHandlerName = "shellDiagnostics"

        static let stateRelayScript = """
        (() => {
          const emitState = () => {
            if (!window.webkit?.messageHandlers?.shellState) return;
            window.webkit.messageHandlers.shellState.postMessage({
              title: document.title || "",
              href: window.location.href || ""
            });
          };

          window.addEventListener("load", emitState);
          window.addEventListener("hashchange", emitState);
          document.addEventListener("DOMContentLoaded", emitState);

          const titleNode = document.querySelector("title") || document.documentElement;
          new MutationObserver(emitState).observe(titleNode, {
            childList: true,
            subtree: true,
            characterData: true
          });
        })();
        """

        static func desktopBridgeScript(platform: String, version: String) -> String {
            """
            (() => {
              if (window.smartToolDesktop) return;

              const pending = new Map();
              let nextRequestId = 1;

              const invokeNative = (kind, args = []) => new Promise((resolve, reject) => {
                const requestId = nextRequestId++;
                pending.set(requestId, { resolve, reject });
                window.webkit.messageHandlers.\(bridgeHandlerName).postMessage({ requestId, kind, args });
              });

              window.__smartToolDesktopResolve = (requestId, payload) => {
                const entry = pending.get(requestId);
                if (!entry) return;
                pending.delete(requestId);
                entry.resolve(payload);
              };

              window.__smartToolDesktopReject = (requestId, message) => {
                const entry = pending.get(requestId);
                if (!entry) return;
                pending.delete(requestId);
                entry.reject(new Error(String(message || "Desktop bridge request failed.")));
              };

              window.smartToolDesktop = Object.freeze({
                isDesktopApp: true,
                platform: "\(platform)",
                version: "\(version)",
                desktopHelper: Object.freeze({
                  health: () => invokeNative("desktopHelper.health"),
                  load: (modelId) => invokeNative("desktopHelper.load", [modelId]),
                  generate: (prompt, config = {}) => invokeNative("desktopHelper.generate", [prompt, config]),
                  unload: () => invokeNative("desktopHelper.unload"),
                }),
                syncFolder: Object.freeze({
                  getState: () => invokeNative("sync.getState"),
                  selectFolder: () => invokeNative("sync.selectFolder"),
                  clearFolder: () => invokeNative("sync.clearFolder"),
                  writeTextFile: (filename, content) => invokeNative("sync.writeTextFile", [filename, content]),
                }),
              });
            })();
            """
        }

        static let diagnosticsScript = """
        (() => {
          const handler = window.webkit?.messageHandlers?.shellDiagnostics;
          if (!handler) return;

          const post = (type, payload = {}) => {
            try {
              handler.postMessage({ type, ...payload });
            } catch {}
          };

          const stringifyArg = (arg) => {
            if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
            if (typeof arg === "string") return arg;
            try { return JSON.stringify(arg); } catch { return String(arg); }
          };

          ["log", "warn", "error"].forEach((level) => {
            const original = console[level];
            console[level] = (...args) => {
              post("console", {
                level,
                message: args.map(stringifyArg).join(" "),
              });
              return original.apply(console, args);
            };
          });

          window.addEventListener("error", (event) => {
            post("error", {
              message: event.message || "Unknown JavaScript error",
              source: event.filename || "",
              line: event.lineno || 0,
              column: event.colno || 0,
            });
          });

          window.addEventListener("unhandledrejection", (event) => {
            const reason = event.reason;
            post("rejection", {
              message: reason?.message || String(reason || "Unhandled rejection"),
            });
          });

          const postDomSnapshot = () => {
            const root = document.getElementById("root");
            const text = (root?.innerText || document.body?.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 220);
            post("dom", {
              message: text || "(empty)",
              title: document.title || "",
              href: window.location.href || "",
            });
          };

          window.addEventListener("load", () => {
            setTimeout(postDomSnapshot, 800);
          });

          setTimeout(postDomSnapshot, 1500);
        })();
        """

        var parent: WebViewContainer
        private weak var webView: WKWebView?
        private var lastSource: URL?
        private var lastReloadToken = -1

        init(parent: WebViewContainer) {
            self.parent = parent
        }

        func attach(to webView: WKWebView) {
            self.webView = webView
        }

        func needsReload(for source: URL, reloadToken: Int) -> Bool {
            lastSource != source || lastReloadToken != reloadToken
        }

        func load(source: URL, reloadToken: Int) {
            guard let webView else { return }

            lastSource = source
            lastReloadToken = reloadToken

            if source.isFileURL {
                let readAccessURL = source.deletingLastPathComponent()
                parent.onEvent("Loading bundled workspace from \(source.lastPathComponent).", nil)
                AppTelemetry.web.info("Loading bundled workspace from \(source.path, privacy: .public)")
                webView.loadFileURL(source, allowingReadAccessTo: readAccessURL)
            } else {
                parent.onEvent("Loading workspace from \(source.absoluteString).", nil)
                AppTelemetry.web.info("Loading workspace URL \(source.absoluteString, privacy: .public)")
                webView.load(URLRequest(url: source))
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case Self.messageHandlerName:
                guard let payload = message.body as? [String: Any] else {
                    return
                }

                let title = payload["title"] as? String
                let href = payload["href"] as? String
                let url = href.flatMap(URL.init(string:))

                parent.onLocationChange(title, url)
            case Self.bridgeHandlerName:
                handleBridgeMessage(message.body)
            case Self.diagnosticsHandlerName:
                handleDiagnosticsMessage(message.body)
            default:
                return
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.onEvent("Started loading web content.", nil)
            AppTelemetry.web.info("Started provisional navigation.")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.onLocationChange(webView.title, webView.url)
            parent.onEvent("Finished loading web content.", Date())
            AppTelemetry.web.info("Finished navigation.")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            let message = "Web content failed to load: \(error.localizedDescription)"
            parent.onEvent(message, nil)
            AppTelemetry.web.error("\(message, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
            let message = "Web content failed before navigation completed: \(error.localizedDescription)"
            parent.onEvent(message, nil)
            AppTelemetry.web.error("\(message, privacy: .public)")
        }

        @MainActor
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.navigationType == .linkActivated,
                  let targetURL = navigationAction.request.url,
                  !targetURL.isFileURL else {
                decisionHandler(.allow)
                return
            }

            NSWorkspace.shared.open(targetURL)
            AppTelemetry.web.info("Opened external link in default browser: \(targetURL.absoluteString, privacy: .public)")
            decisionHandler(.cancel)
        }

        private func handleBridgeMessage(_ body: Any) {
            guard
                let payload = body as? [String: Any],
                let requestId = payload["requestId"] as? Int,
                let kind = payload["kind"] as? String
            else {
                return
            }

            Task { @MainActor in
                do {
                    switch kind {
                    case "desktopHelper.health":
                        respondSuccess(requestId: requestId, payload: await parent.onDesktopHelperHealth())
                    case "desktopHelper.load":
                        let args = payload["args"] as? [Any] ?? []
                        let modelId = args.first as? String ?? ""
                        let response = try await parent.onDesktopHelperLoad(modelId)
                        respondSuccess(requestId: requestId, payload: response)
                    case "desktopHelper.generate":
                        let args = payload["args"] as? [Any] ?? []
                        let prompt = args.first as? String ?? ""
                        let config = args.dropFirst().first as? [String: Any] ?? [:]
                        let response = try await parent.onDesktopHelperGenerate(prompt, config)
                        respondSuccess(requestId: requestId, payload: response)
                    case "desktopHelper.unload":
                        respondSuccess(requestId: requestId, payload: await parent.onDesktopHelperUnload())
                    case "sync.getState":
                        respondSuccess(requestId: requestId, payload: parent.onSyncFolderState())
                    case "sync.selectFolder":
                        respondSuccess(requestId: requestId, payload: parent.onSyncFolderSelect())
                    case "sync.clearFolder":
                        respondSuccess(requestId: requestId, payload: parent.onSyncFolderClear())
                    case "sync.writeTextFile":
                        let args = payload["args"] as? [Any] ?? []
                        let filename = args.first as? String ?? ""
                        let content = args.dropFirst().first as? String ?? ""
                        let response = try parent.onSyncWriteFile(filename, content)
                        respondSuccess(requestId: requestId, payload: response)
                    default:
                        respondFailure(requestId: requestId, message: "Unsupported desktop bridge request: \(kind)")
                    }
                } catch {
                    respondFailure(requestId: requestId, message: error.localizedDescription)
                }
            }
        }

        private func handleDiagnosticsMessage(_ body: Any) {
            guard let payload = body as? [String: Any], let type = payload["type"] as? String else {
                return
            }

            let message = payload["message"] as? String ?? "(no message)"

            switch type {
            case "console":
                let level = payload["level"] as? String ?? "log"
                AppTelemetry.web.info("JS console [\(level, privacy: .public)]: \(message, privacy: .public)")
            case "error":
                let source = payload["source"] as? String ?? ""
                let line = payload["line"] as? Int ?? 0
                let column = payload["column"] as? Int ?? 0
                AppTelemetry.web.error("JS error: \(message, privacy: .public) @ \(source, privacy: .public):\(line, privacy: .public):\(column, privacy: .public)")
            case "rejection":
                AppTelemetry.web.error("Unhandled rejection: \(message, privacy: .public)")
            case "dom":
                let title = payload["title"] as? String ?? ""
                AppTelemetry.web.info("DOM snapshot [\(title, privacy: .public)]: \(message, privacy: .public)")
            default:
                AppTelemetry.web.info("Web diagnostics [\(type, privacy: .public)]: \(message, privacy: .public)")
            }
        }

        private func respondSuccess(requestId: Int, payload: [String: Any]?) {
            let json = serialize(payload) ?? "null"
            evaluateJavaScript("window.__smartToolDesktopResolve(\(requestId), \(json));")
        }

        private func respondFailure(requestId: Int, message: String) {
            let escapedMessage = jsStringLiteral(message)
            evaluateJavaScript("window.__smartToolDesktopReject(\(requestId), \(escapedMessage));")
        }

        private func evaluateJavaScript(_ script: String) {
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(script)
            }
        }

        private func serialize(_ payload: [String: Any]?) -> String? {
            guard let payload else { return nil }
            guard JSONSerialization.isValidJSONObject(payload) else { return nil }
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else {
                return nil
            }

            return json
        }

        private func jsStringLiteral(_ string: String) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: [string]),
                  let json = String(data: data, encoding: .utf8),
                  json.count >= 2 else {
                return "\"Desktop bridge error\""
            }

            return String(json.dropFirst().dropLast())
        }
    }
}
