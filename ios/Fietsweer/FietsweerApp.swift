import SwiftUI

@main
struct FietsweerApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                SearchView()
                    .tabItem { Label("Fietsweer", systemImage: "bicycle") }
                CompareView()
                    .tabItem { Label("Vergelijk", systemImage: "arrow.left.arrow.right") }
                ScoreMapView()
                    .tabItem { Label("Kaart", systemImage: "map") }
            }
            .tint(Theme.green)
            .preferredColorScheme(.dark)
        }
    }
}
