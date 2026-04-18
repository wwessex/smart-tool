import SwiftUI

struct SyncView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("The shell keeps sync-folder ownership in one AppKit edge service. SwiftUI triggers the action, while `NSOpenPanel` handles the actual folder chooser.")
                            .foregroundStyle(.secondary)

                        LabeledContent("Current folder") {
                            Text(model.syncFolderURL?.path ?? "None selected")
                                .textSelection(.enabled)
                        }

                        HStack {
                            Button("Choose Folder…") {
                                model.chooseSyncFolder()
                            }

                            Button("Open in Finder") {
                                model.openSyncFolderInFinder()
                            }
                            .disabled(model.syncFolderURL == nil)

                            Button("Clear Folder") {
                                model.clearSyncFolder()
                            }
                            .disabled(model.syncFolderURL == nil)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Folder Sync", systemImage: "folder.badge.gearshape")
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("AppKit interop boundary")
                            .font(.headline)

                        Text("SwiftUI owns the persistent sync state and command routing. AppKit is only used for the native panel surface and Finder handoff, which keeps the bridge narrow and explicit.")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } label: {
                    Label("Interop Notes", systemImage: "rectangle.on.rectangle.angled")
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
