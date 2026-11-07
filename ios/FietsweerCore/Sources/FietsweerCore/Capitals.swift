import Foundation

public struct Capital: Identifiable, Sendable, Hashable {
    public let province: String
    public let name: String
    public let latitude: Double
    public let longitude: Double
    public var id: String { province }
}

/// Province capitals shown on the score map, same list as the web app.
public enum MapCountry: String, CaseIterable, Identifiable, Sendable {
    case netherlands, belgium

    public var id: String { rawValue }

    public var name: String {
        switch self {
        case .netherlands: "Nederland"
        case .belgium: "België"
        }
    }

    public var flag: String {
        switch self {
        case .netherlands: "🇳🇱"
        case .belgium: "🇧🇪"
        }
    }

    public var capitals: [Capital] {
        switch self {
        case .netherlands: [
            Capital(province: "Groningen", name: "Groningen", latitude: 53.2194, longitude: 6.5665),
            Capital(province: "Friesland", name: "Leeuwarden", latitude: 53.2012, longitude: 5.7999),
            Capital(province: "Drenthe", name: "Assen", latitude: 52.9925, longitude: 6.5642),
            Capital(province: "Overijssel", name: "Zwolle", latitude: 52.5168, longitude: 6.0830),
            Capital(province: "Flevoland", name: "Lelystad", latitude: 52.5185, longitude: 5.4714),
            Capital(province: "Gelderland", name: "Arnhem", latitude: 51.9851, longitude: 5.8987),
            Capital(province: "Utrecht", name: "Utrecht", latitude: 52.0907, longitude: 5.1214),
            Capital(province: "Noord-Holland", name: "Haarlem", latitude: 52.3874, longitude: 4.6462),
            Capital(province: "Zuid-Holland", name: "Den Haag", latitude: 52.0705, longitude: 4.3007),
            Capital(province: "Zeeland", name: "Middelburg", latitude: 51.4988, longitude: 3.6100),
            Capital(province: "Noord-Brabant", name: "'s-Hertogenbosch", latitude: 51.6978, longitude: 5.3037),
            Capital(province: "Limburg", name: "Maastricht", latitude: 50.8514, longitude: 5.6910),
        ]
        case .belgium: [
            Capital(province: "Antwerpen", name: "Antwerpen", latitude: 51.2194, longitude: 4.4025),
            Capital(province: "Limburg", name: "Hasselt", latitude: 50.9307, longitude: 5.3325),
            Capital(province: "Oost-Vlaanderen", name: "Gent", latitude: 51.0543, longitude: 3.7174),
            Capital(province: "Vlaams-Brabant", name: "Leuven", latitude: 50.8798, longitude: 4.7005),
            Capital(province: "West-Vlaanderen", name: "Brugge", latitude: 51.2093, longitude: 3.2247),
            Capital(province: "Waals-Brabant", name: "Waver", latitude: 50.7172, longitude: 4.6120),
            Capital(province: "Henegouwen", name: "Bergen", latitude: 50.4542, longitude: 3.9523),
            Capital(province: "Luik", name: "Luik", latitude: 50.6326, longitude: 5.5797),
            Capital(province: "Luxemburg", name: "Aarlen", latitude: 49.6833, longitude: 5.8167),
            Capital(province: "Namen", name: "Namen", latitude: 50.4674, longitude: 4.8718),
        ]
        }
    }
}
