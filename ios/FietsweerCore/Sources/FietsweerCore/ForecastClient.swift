import Foundation

public enum ForecastError: LocalizedError, Equatable {
    /// Message sent by the server, already in Dutch or English.
    case server(String)
    case offline
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case .server(let message): message
        case .offline: "Geen internetverbinding. Probeer het opnieuw."
        case .invalidResponse: "Weerdata kon niet worden gelezen. Probeer het opnieuw."
        }
    }
}

/// Talks to the Fietsweer server, which holds the Infoplaza key and computes the scores.
public struct ForecastClient: Sendable {
    public static let productionURL = URL(string: "https://fietsweer.fly.dev")!

    private let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL = ForecastClient.productionURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func forecast(location: String) async throws -> ForecastResponse {
        try await fetch([URLQueryItem(name: "location", value: location)])
    }

    public func forecast(latitude: Double, longitude: Double) async throws -> ForecastResponse {
        try await fetch([
            URLQueryItem(name: "lat", value: String(latitude)),
            URLQueryItem(name: "lon", value: String(longitude)),
        ])
    }

    private func fetch(_ query: [URLQueryItem]) async throws -> ForecastResponse {
        var components = URLComponents(url: baseURL.appending(path: "api/v1/forecast"), resolvingAgainstBaseURL: false)!
        components.queryItems = query
        var request = URLRequest(url: components.url!, timeoutInterval: 20)
        request.setValue("fietsweer-ios", forHTTPHeaderField: "X-Client")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(error.code) {
            throw ForecastError.offline
        }
        return try Self.decode(data: data, statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
    }

    static func decode(data: Data, statusCode: Int) throws -> ForecastResponse {
        guard (200..<300).contains(statusCode) else {
            struct ServerError: Decodable { let error: String }
            if let message = try? JSONDecoder().decode(ServerError.self, from: data).error {
                throw ForecastError.server(message)
            }
            throw ForecastError.invalidResponse
        }
        guard let result = try? JSONDecoder().decode(ForecastResponse.self, from: data) else {
            throw ForecastError.invalidResponse
        }
        return result
    }
}
