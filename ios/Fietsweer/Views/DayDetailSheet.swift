import FietsweerCore
import SwiftUI

/// Full weather for one day, same fields as the dialog on the website.
struct DayDetailSheet: View {
    let day: Day
    let timeZone: TimeZone
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 16) {
                        ScoreBadge(score: day.score.map(Double.init), uncertain: day.isUncertain, size: 56)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(day.summary ?? "").font(.headline)
                            if day.isUncertain {
                                Text("Meer dan 7 dagen vooruit, dus onzeker").font(.caption).foregroundStyle(Theme.muted)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    ForEach(metrics, id: \.0) { label, value in
                        LabeledContent(label, value: value)
                    }
                }
                Section { SourceNote() }
                    .listRowBackground(Color.clear)
            }
            .navigationTitle(Theme.dayText(day.date, timeZone: timeZone, long: true))
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klaar") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var metrics: [(String, String)] {
        let direction = Display.windDirection(day.windBearing)
        let force = Display.beaufort(day.windSpeed)
        var rows: [(String, String)] = [
            ("Maximumtemperatuur", Display.value(day.temperatureHigh, suffix: " °C")),
            ("Minimumtemperatuur", Display.value(day.temperatureLow, suffix: " °C")),
            ("Gevoelstemperatuur", Display.value(day.apparentTemperature, suffix: " °C", digits: 1)),
            ("Wind", "\(direction.map { "Uit het \($0.long)" } ?? "Richting onbekend") · \(force.map { "Beaufort \($0)" } ?? "Beaufort onbekend")"),
            ("Neerslagkans", Display.value(day.precipProbability.map { $0 * 100 }, suffix: "%")),
            ("Neerslagintensiteit", Display.value(day.precipIntensity, suffix: " mm/u", digits: 1)),
            ("Bewolking", Display.value(day.cloudCover.map { $0 * 100 }, suffix: "%")),
            ("Luchtvochtigheid", Display.value(day.humidity.map { $0 * 100 }, suffix: "%")),
            ("Dauwpunt", Display.value(day.dewPoint, suffix: " °C", digits: 1)),
            ("Luchtdruk", Display.value(day.pressure, suffix: " hPa", digits: 1)),
            ("UV-index", Display.value(day.uvIndex, digits: 1)),
            ("Zonnestraling", Display.value(day.globalRadiationSum, suffix: " Wh/m²")),
        ]
        if let gust = Display.beaufort(day.windGust) {
            rows.insert(("Windstoten", "Beaufort \(gust)"), at: 4)
        }
        return rows
    }
}
