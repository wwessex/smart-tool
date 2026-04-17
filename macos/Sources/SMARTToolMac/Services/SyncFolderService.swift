import AppKit
import Foundation

@MainActor
enum SyncFolderService {
    static func chooseFolder(currentFolderURL: URL?) -> URL? {
        let panel = NSOpenPanel()
        panel.title = "Choose a SMART Tool sync folder"
        panel.message = "Pick a folder for exports, diagnostics, or review material."
        panel.prompt = "Choose Folder"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        panel.directoryURL = currentFolderURL

        return panel.runModal() == .OK ? panel.url : nil
    }
}
