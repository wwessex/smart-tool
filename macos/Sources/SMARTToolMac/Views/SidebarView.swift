import SwiftUI

struct SidebarView: View {
    @Binding var selection: AppSection?

    var body: some View {
        List(selection: $selection) {
            ForEach(AppSection.allCases) { section in
                HStack(spacing: 10) {
                    Image(systemName: section.systemImage)
                        .foregroundStyle(.secondary)
                        .frame(width: 16)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(section.title)
                            .lineLimit(1)

                        if let detail = section.detail {
                            Text(detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .tag(Optional(section))
            }
        }
        .listStyle(.sidebar)
    }
}
