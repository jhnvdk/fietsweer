// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "FietsweerCore",
    defaultLocalization: "nl",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "FietsweerCore", targets: ["FietsweerCore"])],
    targets: [
        .target(name: "FietsweerCore"),
        .testTarget(name: "FietsweerCoreTests", dependencies: ["FietsweerCore"], resources: [.copy("Fixtures")]),
    ]
)
