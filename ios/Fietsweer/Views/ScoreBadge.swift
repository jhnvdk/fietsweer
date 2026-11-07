import FietsweerCore
import SwiftUI

/// Round coloured score, faded with a dashed ring when the day is uncertain.
struct ScoreBadge: View {
    let score: Double?
    var uncertain = false
    var size: CGFloat = 44
    var digits = 0

    var body: some View {
        ZStack {
            Circle().fill(score.map { Theme.color(for: ScoreLevel(score: $0)) } ?? Theme.panel)
            Text(score.map { Display.value($0, digits: digits) } ?? "—")
                .font(.system(size: size * (digits > 0 ? 0.36 : 0.5), weight: .bold, design: .rounded))
                .foregroundStyle(Theme.scoreText)
                .minimumScaleFactor(0.6)
        }
        .frame(width: size, height: size)
        .opacity(uncertain ? 0.55 : 1)
        .overlay {
            if uncertain {
                Circle().inset(by: -3).stroke(Theme.muted, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            }
        }
        .accessibilityLabel(score.map { "Fietsscore \(Display.value($0, digits: digits)) van 10\(uncertain ? ", onzeker" : "")" } ?? "Geen score")
    }
}
