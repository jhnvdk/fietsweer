import FietsweerCore
import SwiftUI

/// Compare two or three destinations for a trip period.
struct CompareView: View {
    @AppStorage("comparePeriod") private var period: TripPeriod = .next3
    @State private var destinations = ["", "", ""]
    @State private var entries: [Entry] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selected: SelectedDay?

    private let client = ForecastClient()
    private let placeholders = ["Bijv. Maastricht", "Bijv. Bouillon", "Bijv. Texel (optioneel)"]

    struct Entry: Identifiable {
        let id = UUID()
        let query: String
        let result: Result<ForecastResponse, Error>
    }

    struct SelectedDay: Identifiable {
        let day: Day
        let timeZone: TimeZone
        var id: TimeInterval { day.id }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Periode", selection: $period) {
                        ForEach(TripPeriod.allCases) { Text($0.title).tag($0) }
                    }
                    ForEach(0..<3, id: \.self, content: destinationField)
                    Button {
                        Task { await compare() }
                    } label: {
                        HStack {
                            Text("Vergelijk")
                            if isLoading { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(isLoading || filledDestinations.count < 2)
                } footer: {
                    Text("Plan je fietstocht: kies een periode en zie welke plek dan het beste fietsweer heeft.")
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(Theme.amber) }
                }

                if !entries.isEmpty {
                    results
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Vergelijk")
            .sheet(item: $selected) { DayDetailSheet(day: $0.day, timeZone: $0.timeZone) }
        }
    }

    private func destinationField(_ index: Int) -> some View {
        let isLast = index == destinations.count - 1
        return TextField(placeholders[index], text: $destinations[index])
            .placeNameInput()
            .submitLabel(isLast ? .search : .next)
            .onSubmit {
                if isLast { Task { await compare() } }
            }
    }

    private var filledDestinations: [String] {
        destinations.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    @ViewBuilder private var results: some View {
        let keys = period.dateKeys()
        let today = DateKeys.key(for: .now, in: .current)
        let rows = entries.map { entry in (entry, (try? entry.result.get()).map { PeriodSummary(forecast: $0, keys: keys) }) }
        let scored = rows.compactMap { entry, summary in summary?.averageScore.map { (entry, $0) } }
        let best = scored.max { $0.1 < $1.1 }

        Section {
            if let best {
                let name = (try? best.0.result.get())?.label ?? best.0.query
                Text(scored.count > 1
                     ? "Beste keuze voor \(period.phrase): \(name) met gemiddeld \(Display.value(best.1, digits: 1)) van 10"
                     : "Alleen \(name) heeft een weerbericht voor \(period.phrase).")
                    .font(.headline)
            } else {
                Text("Er is nog geen weerbericht voor \(period.phrase).")
            }
        }

        ForEach(rows, id: \.0.id) { entry, summary in
            Section {
                switch entry.result {
                case .failure(let error):
                    Text(error.localizedDescription).foregroundStyle(Theme.amber)
                case .success(let forecast):
                    if let summary {
                        HStack(spacing: 12) {
                            ScoreBadge(score: summary.averageScore, size: 52, digits: 1)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Max \(summary.averageHigh.map { Display.value($0, suffix: "°") } ?? "—") · Regen \(summary.averageRainProbability.map { Display.value($0 * 100, suffix: "%") } ?? "—") · Bft \(summary.beaufort.map(String.init) ?? "—")")
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                            }
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(Array(zip(keys, summary.days)), id: \.0) { key, day in
                                    VStack(spacing: 4) {
                                        Text(keyLabel(key)).font(.caption2).foregroundStyle(Theme.muted)
                                        if let day {
                                            Button { selected = SelectedDay(day: day, timeZone: forecast.timeZone) } label: {
                                                ScoreBadge(score: day.score.map(Double.init), uncertain: day.isUncertain, size: 36)
                                            }
                                            .buttonStyle(.plain)
                                        } else {
                                            Text("—").frame(width: 36, height: 36)
                                                .opacity(DateKeys.daysBetween(today, key) > 7 ? 0.55 : 1)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } header: {
                HStack {
                    Text((try? entry.result.get())?.label ?? entry.query)
                    if let best, best.0.id == entry.id, scored.count > 1 {
                        Image(systemName: "trophy.fill").foregroundStyle(Theme.green)
                    }
                }
            }
        }

        Section {
            if rows.contains(where: { $0.1?.days.contains { $0?.isUncertain == true } == true }) {
                UncertainNote()
            }
            SourceNote()
        }
        .listRowBackground(Color.clear)
    }

    private func keyLabel(_ key: DateKey) -> String {
        guard let date = DateKeys.date(from: key) else { return key }
        return Theme.dayText(date, timeZone: TimeZone(identifier: "UTC")!)
    }

    private func compare() async {
        let queries = filledDestinations
        guard queries.count >= 2 else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let client = client
        let results = await withTaskGroup(of: (Int, Result<ForecastResponse, Error>).self) { group in
            for (index, query) in queries.enumerated() {
                group.addTask {
                    do { return (index, .success(try await client.forecast(location: query))) }
                    catch { return (index, .failure(error)) }
                }
            }
            var collected: [(Int, Result<ForecastResponse, Error>)] = []
            for await item in group { collected.append(item) }
            return collected.sorted { $0.0 < $1.0 }.map(\.1)
        }

        let newEntries = zip(queries, results).map { Entry(query: $0, result: $1) }
        if newEntries.allSatisfy({ (try? $0.result.get()) == nil }) {
            entries = []
            errorMessage = "Geen van de bestemmingen kon worden geladen. Controleer de plaatsnamen."
        } else {
            entries = newEntries
        }
    }
}

private extension View {
    func placeNameInput() -> some View {
        #if os(iOS)
        textInputAutocapitalization(.words).autocorrectionDisabled()
        #else
        autocorrectionDisabled()
        #endif
    }
}
