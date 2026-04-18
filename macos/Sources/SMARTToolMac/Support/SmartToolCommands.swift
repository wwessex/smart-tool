import SwiftUI

struct SmartToolCommands: Commands {
    @ObservedObject var model: AppModel

    var body: some Commands {
        CommandMenu("SMART Tool") {
            Button("Reload Workspace") {
                model.requestReload()
            }
            .keyboardShortcut("r")

            Divider()

            Button("Choose Sync Folder…") {
                model.chooseSyncFolder()
            }
            .keyboardShortcut("o", modifiers: [.command, .shift])

            Button("Open Sync Folder in Finder") {
                model.openSyncFolderInFinder()
            }
            .disabled(model.syncFolderURL == nil)

            Button("Clear Sync Folder") {
                model.clearSyncFolder()
            }
            .disabled(model.syncFolderURL == nil)

            Divider()

            Button("Open Current Page in Browser") {
                model.openCurrentPageInBrowser()
            }
            .keyboardShortcut("b", modifiers: [.command, .shift])
            .disabled(model.currentPageURL == nil && model.launchURL == nil)
        }
    }
}
