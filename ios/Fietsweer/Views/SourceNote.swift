import SwiftUI

struct SourceNote: View {
    var body: some View {
        HStack(spacing: 4) {
            Text("Weerdata door Infoplaza ·")
            Link("Privacy", destination: URL(string: "https://fietsweer.fly.dev/privacy")!)
        }
        .font(.caption2)
        .foregroundStyle(Theme.muted)
        .tint(Theme.muted)
    }
}

struct UncertainNote: View {
    var body: some View {
        Text("Vervaagde scores liggen meer dan 7 dagen vooruit en zijn onzeker.")
            .font(.caption)
            .foregroundStyle(Theme.muted)
    }
}
