import FietsweerCore
import MapKit
import SwiftUI

/// Cycling scores in the province capitals of the Netherlands or Belgium.
struct ScoreMapView: View {
    @State private var country: MapCountry = .netherlands
    @State private var forecasts: [String: ForecastResponse] = [:]
    @State private var dayIndex = 0
    @State private var selected: Capital?
    @State private var isLoading = false
    @State private var position: MapCameraPosition = .region(ScoreMapView.region(for: .netherlands))

    private let client = ForecastClient()

    var body: some View {
        NavigationStack {
            Map(position: $position, selection: $selected) {
                ForEach(country.capitals) { capital in
                    let day = day(for: capital)
                    Annotation(capital.name, coordinate: CLLocationCoordinate2D(latitude: capital.latitude, longitude: capital.longitude)) {
                        ScoreBadge(score: day?.score.map(Double.init), uncertain: day?.isUncertain ?? false, size: 38)
                            .shadow(radius: 3)
                    }
                    .tag(capital)
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .safeAreaInset(edge: .top) { controls }
            .safeAreaInset(edge: .bottom) { detailCard }
            .navigationTitle("Kaart")
            .toolbarTitleDisplayMode(.inline)
            .task(id: country) { await load() }
            .onChange(of: country) {
                selected = nil
                withAnimation { position = .region(Self.region(for: country)) }
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 8) {
            Picker("Land", selection: $country) {
                ForEach(MapCountry.allCases) { Text("\($0.flag) \($0.name)").tag($0) }
            }
            .pickerStyle(.segmented)
            HStack {
                if isLoading { ProgressView().controlSize(.small) }
                Text(status).font(.caption).foregroundStyle(Theme.muted)
                Spacer()
                if !days.isEmpty {
                    Picker("Dag", selection: $dayIndex) {
                        ForEach(days.indices, id: \.self) { index in
                            Text(Theme.dayText(days[index].date, timeZone: timeZone, long: false) + (days[index].isUncertain ? " (onzeker)" : ""))
                                .tag(index)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    @ViewBuilder private var detailCard: some View {
        if let selected, let day = day(for: selected) {
            HStack(spacing: 12) {
                ScoreBadge(score: day.score.map(Double.init), uncertain: day.isUncertain, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(selected.name) · \(selected.province)").font(.headline)
                    Text(Theme.dayText(day.date, timeZone: timeZone, long: true)).font(.caption).foregroundStyle(Theme.muted)
                    Text("\(day.summary ?? "") · maximaal \(Display.value(day.temperatureHigh, suffix: " °C"))").font(.caption)
                }
                Spacer()
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    private func key(_ capital: Capital) -> String { "\(country.rawValue):\(capital.province)" }

    private func day(for capital: Capital) -> Day? {
        guard let daily = forecasts[key(capital)]?.forecast.daily, daily.indices.contains(dayIndex) else { return nil }
        return daily[dayIndex]
    }

    private var firstForecast: ForecastResponse? {
        country.capitals.lazy.compactMap { forecasts[key($0)] }.first
    }

    private var days: [Day] { firstForecast?.forecast.daily ?? [] }
    private var timeZone: TimeZone { firstForecast?.timeZone ?? TimeZone(identifier: "Europe/Amsterdam")! }

    private var status: String {
        let loaded = country.capitals.filter { forecasts[key($0)] != nil }.count
        if isLoading { return "Weer ophalen…" }
        if loaded == 0 { return "De weerscores konden niet worden geladen." }
        return "Fietsscore in \(loaded) van de \(country.capitals.count) hoofdsteden"
    }

    private func load() async {
        let missing = country.capitals.filter { forecasts[key($0)] == nil }
        guard !missing.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        let client = client
        let countryKey = country.rawValue
        await withTaskGroup(of: (String, ForecastResponse?).self) { group in
            for capital in missing {
                group.addTask {
                    let result = try? await client.forecast(latitude: capital.latitude, longitude: capital.longitude)
                    return ("\(countryKey):\(capital.province)", result)
                }
            }
            for await (key, result) in group {
                if let result { forecasts[key] = result }
            }
        }
        dayIndex = min(dayIndex, max(days.count - 1, 0))
    }

    static func region(for country: MapCountry) -> MKCoordinateRegion {
        let lats = country.capitals.map(\.latitude)
        let lons = country.capitals.map(\.longitude)
        let center = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lons.min()! + lons.max()!) / 2)
        let span = MKCoordinateSpan(latitudeDelta: (lats.max()! - lats.min()!) * 1.6, longitudeDelta: (lons.max()! - lons.min()!) * 1.6)
        return MKCoordinateRegion(center: center, span: span)
    }
}
