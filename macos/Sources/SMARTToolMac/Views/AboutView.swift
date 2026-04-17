import SwiftUI

struct AboutView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SMART Tool for macOS")
                            .font(.headline)

                        Text("This target adds a native SwiftUI shell around the existing web app so the repo can grow a proper macOS desktop surface without discarding the current React implementation.")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Overview", systemImage: "macwindow")
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        LabeledContent("SwiftUI structure") {
                            Text("`NavigationSplitView`, toolbar commands, and inspector")
                        }

                        LabeledContent("AppKit bridge") {
                            Text("`WKWebView` via `NSViewRepresentable` and `NSOpenPanel` for folder selection")
                        }

                        LabeledContent("Telemetry") {
                            Text("`OSLog` categories for windowing, sidebar, sync, commands, and web loading")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Architecture", systemImage: "square.3.layers.3d")
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
