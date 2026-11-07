import FietsweerCore
import SwiftUI

/// Main screen: pick a place, see the cycling score for up to 15 days.
struct SearchView: View {
    @AppStorage("lastLocation") private var lastLocation = ""
    @State private var query = ""
    @State private var result: ForecastResponse?
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var selectedDay: Day?
    @State private var locationService = LocationService()

    private let client = ForecastClient()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Button {
                        Task { await loadCurrentLocation() }
                    } label: {
                        Label("Gebruik mijn locatie", systemImage: "location.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoading)

                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if let errorMessage {
                        Text(errorMessage).foregroundStyle(Theme.amber)
                    } else if let result {
                        ForecastSection(result: result) { selectedDay = $0 }
                    } else {
                        ContentUnavailableView("Kies een plaats", systemImage: "bicycle",
                                               description: Text("Zoek een plaats of gebruik je locatie om de fietsscore voor de komende 15 dagen te zien."))
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle("Fietsweer")
            .searchable(text: $query, prompt: "Plaats of stad")
            .onSubmit(of: .search) {
                Task { await load(location: query) }
            }
            .refreshable {
                if let name = result?.place.name ?? (lastLocation.isEmpty ? nil : lastLocation) {
                    await load(location: name)
                }
            }
            .sheet(item: $selectedDay) { day in
                DayDetailSheet(day: day, timeZone: result?.timeZone ?? .current)
            }
            .task {
                if result == nil, !lastLocation.isEmpty {
                    await load(location: lastLocation)
                }
            }
        }
    }

    private func load(location: String) async {
        let location = location.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !location.isEmpty else { return }
        await run { try await client.forecast(location: location) }
        if result != nil { lastLocation = location }
    }

    private func loadCurrentLocation() async {
        await run {
            let location = try await locationService.currentLocation()
            return try await client.forecast(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
        }
    }

    private func run(_ fetch: () async throws -> ForecastResponse) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            result = try await fetch()
        } catch {
            result = nil
            errorMessage = error.localizedDescription
        }
    }
}

private struct ForecastSection: View {
    let result: ForecastResponse
    let onSelect: (Day) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(result.label).font(.title2.bold())
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(result.forecast.daily) { day in
                        Button { onSelect(day) } label: {
                            DayColumn(day: day, timeZone: result.timeZone)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 6)
            }
            if result.forecast.daily.contains(where: \.isUncertain) {
                UncertainNote()
            }
            SourceNote()
        }
    }
}

private struct DayColumn: View {
    let day: Day
    let timeZone: TimeZone

    var body: some View {
        let direction = Display.windDirection(day.windBearing)
        VStack(spacing: 8) {
            Text(Theme.dayText(day.date, timeZone: timeZone))
                .font(.caption.weight(.semibold))
                .foregroundStyle(day.isUncertain ? Theme.muted : Theme.ink)
            ScoreBadge(score: day.score.map(Double.init), uncertain: day.isUncertain, size: 48)
            VStack(spacing: 3) {
                Text("\(direction?.short ?? "—") · Bft \(Display.beaufort(day.windSpeed).map(String.init) ?? "—")")
                Text("☂ \(day.precipProbability.map { Display.value($0 * 100) } ?? "—")%")
                Text(day.temperatureHigh.map { Display.value($0, suffix: "°") } ?? "—")
            }
            .font(.caption2)
            .foregroundStyle(Theme.muted)
        }
        .frame(width: 70)
        .padding(.vertical, 10)
        .background(Theme.panel, in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Toont het volledige weerbericht")
    }
}
