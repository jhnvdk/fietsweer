import Foundation
import Testing
@testable import FietsweerCore

@Test func decodesServerResponse() throws {
    let url = try #require(Bundle.module.url(forResource: "utrecht", withExtension: "json", subdirectory: "Fixtures"))
    let result = try ForecastClient.decode(data: Data(contentsOf: url), statusCode: 200)
    #expect(result.label == "Utrecht, Nederland")
    #expect(result.timeZone.identifier == "Europe/Amsterdam")
    #expect(result.forecast.daily.count == 15)
    #expect(result.forecast.daily.allSatisfy { ($0.score ?? 0) >= 1 && ($0.score ?? 0) <= 10 })
    #expect(result.forecast.daily.last?.isUncertain == true)
}

@Test func serverErrorMessageIsShown() {
    let body = Data(#"{"error":"We couldn't find that place. Try a nearby city."}"#.utf8)
    #expect(throws: ForecastError.server("We couldn't find that place. Try a nearby city.")) {
        try ForecastClient.decode(data: body, statusCode: 404)
    }
}

@Test func beaufortMatchesWebThresholds() {
    #expect(Display.beaufort(0) == 0)
    #expect(Display.beaufort(5.9) == 1)
    #expect(Display.beaufort(20) == 4)
    #expect(Display.beaufort(120) == 12)
    #expect(Display.beaufort(nil) == nil)
}

@Test func windDirection() {
    #expect(Display.windDirection(225)?.short == "ZW")
    #expect(Display.windDirection(-10)?.short == "N")
    #expect(Display.windDirection(350)?.long == "noorden")
}

@Test func scoreLevels() {
    #expect(ScoreLevel(score: 5.9) == .low)
    #expect(ScoreLevel(score: 6) == .medium)
    #expect(ScoreLevel(score: 8) == .high)
}

// 2026-11-07 is a Saturday, 2026-11-08 a Sunday, 2026-11-09 a Monday.
@Test func tripPeriodsOnSaturday() {
    #expect(TripPeriod.next3.dateKeys(today: "2026-11-07") == ["2026-11-07", "2026-11-08", "2026-11-09"])
    #expect(TripPeriod.weekend.dateKeys(today: "2026-11-07") == ["2026-11-07", "2026-11-08"])
    #expect(TripPeriod.nextWeek.dateKeys(today: "2026-11-07").first == "2026-11-09")
    #expect(TripPeriod.nextWeek.dateKeys(today: "2026-11-07").count == 7)
    #expect(TripPeriod.nextWeekend.dateKeys(today: "2026-11-07") == ["2026-11-14", "2026-11-15"])
}

@Test func tripPeriodsOnSundayAndMonday() {
    #expect(TripPeriod.weekend.dateKeys(today: "2026-11-08") == ["2026-11-08"])
    #expect(TripPeriod.nextWeekend.dateKeys(today: "2026-11-08") == ["2026-11-14", "2026-11-15"])
    #expect(TripPeriod.nextWeek.dateKeys(today: "2026-11-09").first == "2026-11-16")
    #expect(TripPeriod.weekend.dateKeys(today: "2026-11-09") == ["2026-11-14", "2026-11-15"])
}

@Test func periodSummaryAveragesScores() {
    let amsterdam = TimeZone(identifier: "Europe/Amsterdam")!
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = amsterdam
    func day(_ d: Int, score: Int) -> Day {
        Day(time: calendar.date(from: DateComponents(year: 2026, month: 11, day: d))!.timeIntervalSince1970,
            temperatureHigh: 10, windSpeed: 20, precipProbability: 0.5, score: score)
    }
    let response = ForecastResponse(place: Place(name: "Test"), forecast: Forecast(timezone: "Europe/Amsterdam", daily: [day(7, score: 6), day(8, score: 8)]))
    let summary = PeriodSummary(forecast: response, keys: ["2026-11-07", "2026-11-08", "2026-11-09"])
    #expect(summary.averageScore == 7)
    #expect(summary.days.compactMap { $0 }.count == 2)
    #expect(summary.days[2] == nil)
    #expect(summary.beaufort == 4)
}
