import SwiftUI

struct WorkspaceView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Group {
            if let launchURL = model.launchURL {
                WebViewContainer(
                    source: launchURL,
                    reloadToken: model.reloadToken,
                    platform: "macos",
                    version: model.desktopBridgeVersion,
                    onSyncFolderState: { model.desktopSyncStatePayload() },
                    onSyncFolderSelect: { model.selectSyncFolderFromWebView() },
                    onSyncFolderClear: { model.clearSyncFolderFromWebView() },
                    onSyncWriteFile: { filename, content in
                        try model.writeTextFileFromWebView(filename: filename, content: content)
                    },
                    onLocationChange: { title, url in
                        model.updateWebLocation(title: title, url: url)
                    },
                    onEvent: { message, loadedAt in
                        model.recordWebEvent(message, loadedAt: loadedAt)
                    }
                )
            } else if let launchFailureMessage = model.launchFailureMessage {
                ContentUnavailableView(
                    "SMART Tool Unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(launchFailureMessage)
                )
                .overlay(alignment: .bottom) {
                    Text(model.webStatusSummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 24)
                }
            } else {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Starting SMART Tool…")
                        .font(.headline)
                    Text(model.webStatusSummary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
