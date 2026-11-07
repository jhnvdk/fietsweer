import Foundation

/// A calendar date as "YYYY-MM-DD", so days of different places line up.
public typealias DateKey = String

public enum DateKeys {
    static let utc = TimeZone(identifier: "UTC")!

    public static func key(for date: Date, in timeZone: TimeZone) -> DateKey {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    public static func date(from key: DateKey) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return utcCalendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    public static func adding(_ days: Int, to key: DateKey) -> DateKey {
        let date = utcCalendar.date(byAdding: .day, value: days, to: date(from: key)!)!
        return Self.key(for: date, in: utc)
    }

    public static func daysBetween(_ from: DateKey, _ to: DateKey) -> Int {
        utcCalendar.dateComponents([.day], from: date(from: from)!, to: date(from: to)!).day!
    }

    /// 0 = Sunday … 6 = Saturday, like JavaScript's getUTCDay.
    public static func weekday(of key: DateKey) -> Int {
        utcCalendar.component(.weekday, from: date(from: key)!) - 1
    }

    private static var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc
        return calendar
    }
}

/// Trip periods for the comparison, ported from comparePresets in public/app.js.
public enum TripPeriod: String, CaseIterable, Identifiable, Sendable {
    case next3, weekend, nextWeek, nextWeekend

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .next3: "Komende 3 dagen"
        case .weekend: "Komend weekend"
        case .nextWeek: "Volgende week"
        case .nextWeekend: "Volgend weekend"
        }
    }

    /// Used in sentences: "Beste keuze voor komend weekend".
    public var phrase: String {
        switch self {
        case .next3: "de komende 3 dagen"
        case .weekend: "komend weekend"
        case .nextWeek: "volgende week"
        case .nextWeekend: "volgend weekend"
        }
    }

    /// All dates in the period, inclusive, counted from `today`.
    public func dateKeys(today: DateKey) -> [DateKey] {
        let weekday = DateKeys.weekday(of: today)
        let (start, end): (DateKey, DateKey)
        switch self {
        case .next3:
            (start, end) = (today, DateKeys.adding(2, to: today))
        case .weekend:
            if weekday == 0 {
                (start, end) = (today, today)
            } else {
                let saturday = DateKeys.adding(6 - weekday, to: today)
                (start, end) = (saturday, DateKeys.adding(1, to: saturday))
            }
        case .nextWeek:
            let offset = (8 - weekday) % 7
            let monday = DateKeys.adding(offset == 0 ? 7 : offset, to: today)
            (start, end) = (monday, DateKeys.adding(6, to: monday))
        case .nextWeekend:
            let comingSaturday = DateKeys.adding(weekday == 0 ? -1 : 6 - weekday, to: today)
            (start, end) = (DateKeys.adding(7, to: comingSaturday), DateKeys.adding(8, to: comingSaturday))
        }
        return (0...DateKeys.daysBetween(start, end)).map { DateKeys.adding($0, to: start) }
    }

    public func dateKeys(now: Date = .now, timeZone: TimeZone = .current) -> [DateKey] {
        dateKeys(today: DateKeys.key(for: now, in: timeZone))
    }
}

/// One destination's forecast for a trip period.
public struct PeriodSummary: Sendable {
    /// One entry per date in the period; nil when the forecast doesn't reach that far.
    public let days: [Day?]
    public let averageScore: Double?
    public let averageHigh: Double?
    public let averageRainProbability: Double?
    public let beaufort: Int?

    public init(forecast: ForecastResponse, keys: [DateKey]) {
        let timeZone = forecast.timeZone
        let byDate = Dictionary(forecast.forecast.daily.map { (DateKeys.key(for: $0.date, in: timeZone), $0) }, uniquingKeysWith: { first, _ in first })
        days = keys.map { byDate[$0] }
        let present = days.compactMap { $0 }
        averageScore = Self.average(present.map { $0.score.map(Double.init) })
        averageHigh = Self.average(present.map(\.temperatureHigh))
        averageRainProbability = Self.average(present.map(\.precipProbability))
        beaufort = Display.beaufort(Self.average(present.map(\.windSpeed)))
    }

    static func average(_ values: [Double?]) -> Double? {
        let finite = values.compactMap { $0 }.filter(\.isFinite)
        return finite.isEmpty ? nil : finite.reduce(0, +) / Double(finite.count)
    }
}
