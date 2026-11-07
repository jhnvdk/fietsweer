import Foundation

/// Response of GET /api/v1/forecast on the Fietsweer server.
/// Every field is optional except what the app cannot work without, so new or missing server fields never break decoding.
public struct ForecastResponse: Decodable, Sendable {
    public let place: Place
    public let forecast: Forecast

    public init(place: Place, forecast: Forecast) {
        self.place = place
        self.forecast = forecast
    }

    /// Timezone of the place, used to turn day timestamps into calendar dates.
    public var timeZone: TimeZone {
        [forecast.timezone, place.timezone].compactMap { $0 }.compactMap(TimeZone.init(identifier:)).first
            ?? TimeZone(identifier: "Europe/Amsterdam")!
    }

    /// "Utrecht, Nederland" — same as locationLabel in the web app.
    public var label: String {
        var parts: [String] = []
        for part in [place.name, place.country].compactMap({ $0 }) where !part.isEmpty && !parts.contains(part) {
            parts.append(part)
        }
        return parts.joined(separator: ", ")
    }
}

public struct Place: Decodable, Sendable {
    public let name: String?
    public let country: String?
    public let timezone: String?

    public init(name: String?, country: String? = nil, timezone: String? = nil) {
        self.name = name
        self.country = country
        self.timezone = timezone
    }
}

public struct Forecast: Decodable, Sendable {
    public let timezone: String?
    public let daily: [Day]

    public init(timezone: String?, daily: [Day]) {
        self.timezone = timezone
        self.daily = daily
    }
}

public struct Day: Decodable, Sendable, Identifiable, Hashable {
    /// Unix timestamp (seconds) of the start of the day.
    public let time: TimeInterval
    public let temperatureHigh: Double?
    public let temperatureLow: Double?
    public let apparentTemperature: Double?
    public let windSpeed: Double?
    public let windGust: Double?
    public let windBearing: Double?
    public let precipProbability: Double?
    public let precipIntensity: Double?
    public let precipType: String?
    public let cloudCover: Double?
    public let humidity: Double?
    public let dewPoint: Double?
    public let pressure: Double?
    public let uvIndex: Double?
    public let globalRadiationSum: Double?
    /// Cycling score 1–10, computed by the server.
    public let score: Int?
    /// More than 7 days ahead, so less reliable.
    public let uncertain: Bool?
    /// Short Dutch description, e.g. "Regen mogelijk".
    public let summary: String?

    public var id: TimeInterval { time }
    public var date: Date { Date(timeIntervalSince1970: time) }
    public var isUncertain: Bool { uncertain ?? false }

    public init(
        time: TimeInterval, temperatureHigh: Double? = nil, temperatureLow: Double? = nil, apparentTemperature: Double? = nil,
        windSpeed: Double? = nil, windGust: Double? = nil, windBearing: Double? = nil, precipProbability: Double? = nil,
        precipIntensity: Double? = nil, precipType: String? = nil, cloudCover: Double? = nil, humidity: Double? = nil,
        dewPoint: Double? = nil, pressure: Double? = nil, uvIndex: Double? = nil, globalRadiationSum: Double? = nil,
        score: Int? = nil, uncertain: Bool? = nil, summary: String? = nil
    ) {
        self.time = time
        self.temperatureHigh = temperatureHigh
        self.temperatureLow = temperatureLow
        self.apparentTemperature = apparentTemperature
        self.windSpeed = windSpeed
        self.windGust = windGust
        self.windBearing = windBearing
        self.precipProbability = precipProbability
        self.precipIntensity = precipIntensity
        self.precipType = precipType
        self.cloudCover = cloudCover
        self.humidity = humidity
        self.dewPoint = dewPoint
        self.pressure = pressure
        self.uvIndex = uvIndex
        self.globalRadiationSum = globalRadiationSum
        self.score = score
        self.uncertain = uncertain
        self.summary = summary
    }
}
