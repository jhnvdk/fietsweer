import FietsweerCore
import SwiftUI

/// Colours from public/styles.css, so the app and the website look like one product.
enum Theme {
    static let background = Color(hex: 0x1B1D2C)
    static let panel = Color(hex: 0x222638)
    static let ink = Color(hex: 0xE7EAF4)
    static let muted = Color(hex: 0xA4ABC0)
    static let green = Color(hex: 0x10A538)
    static let greenSoft = Color(hex: 0x37B65C)
    static let amber = Color(hex: 0x93AA39)
    static let scoreText = Color(hex: 0x182332)

    static let locale = Display.locale

    static func color(for level: ScoreLevel) -> Color {
        switch level {
        case .high: green
        case .medium: greenSoft
        case .low: amber
        }
    }

    /// "za 7", "zaterdag 7 november" etc. in the place's own timezone.
    static func dayText(_ date: Date, timeZone: TimeZone, long: Bool = false) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let style = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: timeZone)
        let text = long
            ? date.formatted(style.weekday(.wide).day().month(.wide))
            : date.formatted(style.weekday(.abbreviated).day())
        return text.replacingOccurrences(of: ".", with: "")
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
