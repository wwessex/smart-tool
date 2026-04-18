// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "SMARTToolMac",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(
            name: "SMARTToolMac",
            targets: ["SMARTToolMac"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "SMARTToolMac",
            path: "Sources/SMARTToolMac",
            sources: [
                "App",
                "Models",
                "Services",
                "Stores",
                "Support",
                "Views",
            ]
        ),
    ]
)
