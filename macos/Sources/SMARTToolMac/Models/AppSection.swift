import Foundation

enum AppSection: String, CaseIterable, Hashable, Identifiable {
    case workspace
    case sync
    case diagnostics
    case about

    var id: Self { self }

    var title: String {
        switch self {
        case .workspace:
            "Workspace"
        case .sync:
            "Sync"
        case .diagnostics:
            "Diagnostics"
        case .about:
            "About"
        }
    }

    var systemImage: String {
        switch self {
        case .workspace:
            "sparkles.rectangle.stack"
        case .sync:
            "folder.badge.gearshape"
        case .diagnostics:
            "waveform.path.ecg.rectangle"
        case .about:
            "info.circle"
        }
    }

    var detail: String? {
        switch self {
        case .workspace:
            "Bundled SMART Tool web workspace"
        case .sync:
            "Native folder selection and Finder handoff"
        case .diagnostics:
            "OSLog telemetry and runtime state"
        case .about:
            "Architecture and bridge notes"
        }
    }
}
