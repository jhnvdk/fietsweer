import Foundation

/// Display helpers, ported from public/app.js.
public enum Display {
    public static let locale = Locale(identifier: "nl_NL")

    /// Beaufort force 0–12 for a wind speed in km/h.
    public static func beaufort(_ speedKmh: Double?) -> Int? {
        guard let speed = speedKmh, speed.isFinite, speed >= 0 else { return nil }
        let thresholds: [Double] = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
        return thresholds.firstIndex { speed < $0 } ?? 12
    }

    /// ("ZW", "zuidwesten") for a bearing in degrees.
    public static func windDirection(_ bearing: Double?) -> (short: String, long: String)? {
        guard let bearing, bearing.isFinite else { return nil }
        let directions = [
            ("N", "noorden"), ("NO", "noordoosten"), ("O", "oosten"), ("ZO", "zuidoosten"),
            ("Z", "zuiden"), ("ZW", "zuidwesten"), ("W", "westen"), ("NW", "noordwesten"),
        ]
        let normalized = (bearing.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        return directions[Int((normalized / 45).rounded()) % directions.count]
    }

    /// Dutch number formatting: 12,5 °C. Returns "Onbekend" for missing values.
    public static func value(_ value: Double?, suffix: String = "", digits: Int = 0) -> String {
        guard let value, value.isFinite else { return "Onbekend" }
        return value.formatted(.number.precision(.fractionLength(0...digits)).locale(locale)) + suffix
    }
}

/// Colour band of a score, same thresholds as the web app.
public enum ScoreLevel: Sendable {
    case low, medium, high

    public init(score: Double) {
        self = score < 6 ? .low : score < 8 ? .medium : .high
    }
}
