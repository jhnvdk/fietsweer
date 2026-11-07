import CoreLocation

/// One-shot "where am I" with the when-in-use permission.
@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {
    enum LocationError: LocalizedError {
        case denied, unavailable

        var errorDescription: String? {
            switch self {
            case .denied: "Geef Fietsweer toegang tot je locatie via Instellingen › Privacy › Locatievoorzieningen."
            case .unavailable: "Je locatie kon niet worden bepaald. Probeer het opnieuw."
            }
        }
    }

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func currentLocation() async throws -> CLLocation {
        if let pending = continuation {
            pending.resume(throwing: LocationError.unavailable)
            continuation = nil
        }
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .denied, .restricted:
                finish(.failure(LocationError.denied))
            default:
                manager.requestLocation()
            }
        }
    }

    private func finish(_ result: Result<CLLocation, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            guard continuation != nil else { return }
            switch status {
            case .notDetermined: break
            case .denied, .restricted: finish(.failure(LocationError.denied))
            default: self.manager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in finish(.success(location)) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in finish(.failure(LocationError.unavailable)) }
    }
}
