import SwiftUI

struct DiagnosticsView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        LabeledContent("Last event") {
                            Text(model.lastTelemetryEvent)
                                .textSelection(.enabled)
                        }

                        LabeledContent("Web status") {
                            Text(model.webStatusSummary)
                                .textSelection(.enabled)
                        }

                        LabeledContent("Current page") {
                            Text(model.currentPageDescription)
                                .textSelection(.enabled)
                        }

                        LabeledContent("Last loaded") {
                            if let lastLoadedAt = model.lastLoadedAt {
                                Text(lastLoadedAt.formatted(date: .abbreviated, time: .standard))
                            } else {
                                Text("No successful load yet")
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Runtime State", systemImage: "waveform.path.ecg.rectangle")
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Telemetry commands")
                            .font(.headline)

                        Text("Use the project run script to stream focused unified logs while exercising the shell.")
                            .foregroundStyle(.secondary)

                        Text("./script/build_and_run.sh --telemetry")
                            .font(.system(.body, design: .monospaced))

                        Text("./script/build_and_run.sh --logs")
                            .font(.system(.body, design: .monospaced))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Verification", systemImage: "terminal")
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
