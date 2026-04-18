import SwiftUI

struct InspectorView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Inspector")
                .font(.title3.weight(.semibold))

            LabeledContent("Page title") {
                Text(model.currentPageTitle)
                    .textSelection(.enabled)
            }

            LabeledContent("Current page") {
                Text(model.currentPageDescription)
                    .textSelection(.enabled)
            }

            LabeledContent("Sync folder") {
                Text(model.syncFolderURL?.path ?? "None selected")
                    .textSelection(.enabled)
            }

            LabeledContent("Last event") {
                Text(model.lastTelemetryEvent)
                    .textSelection(.enabled)
            }

            Spacer()
        }
        .padding()
        .frame(minWidth: 280, idealWidth: 320, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
