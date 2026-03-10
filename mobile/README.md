# Food Rescue Platform - Mobile App

The primary interface for **Donors**, **Volunteers**, and **NGO staff** in the Food Rescue Platform. Built with **Flutter**, this cross-platform application (Android & iOS) facilitates food donation, real-time logistics, and successful delivery verification.

## 🌟 Key Features

### 👤 For Donors (Households/Restaurants)
- **Easy Donation**: Create donation listings with food type, quantity, and photos.
- **Location Tracking**: Auto-fetch pickup address via GPS or manual entry.
- **History**: Track past donations and view impact stats.

### 🚴 For Volunteers (Logistics)
- **Task Discovery**: View nearby pickup/delivery tasks on a map.
- **Route Optimization**: Integrated Google Maps navigation.
- **QR Verification**: Scan recipient QR codes to verify successful delivery.
- **Real-time Status**: Toggle "Online/Offline" status for availability.

### 🏢 For NGOs (Recipients)
- **Claim Donations**: Browse and claim available food donations.
- **verification**: Generate secure QR codes for volunteers to scan upon delivery.
- **Profile Management**: Update branch locations and capacity.

## 🛠️ Tech Stack

- **Framework**: [Flutter](https://flutter.dev/) (Dart) 
- **State Management**: [Riverpod](https://riverpod.dev/)
- **Networking**: [Dio](https://pub.dev/packages/dio) for API requests
- **Geolocation**: Geolocator & Geocoding packages
- **Maps**: google_maps_flutter
- **Real-time**: socket_io_client (WebSockets)
- **Secure Storage**: flutter_secure_storage (JWT handling)

## 🚀 Getting Started

### Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.16.0 or later)
- Android Studio / Xcode (for simulators)
- VS Code (recommended IDE)

### Installation

1. **Navigate to the mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   flutter pub get
   ```

3. **Configure API Endpoints:**
   Update `lib/services/api_service.dart` (or environment config) to point to your backend:
   ```dart
   static const String baseUrl = 'http://10.0.2.2:8000/api/v1'; // For Android Emulator
   // OR
   static const String baseUrl = 'http://localhost:8000/api/v1'; // For iOS Simulator
   ```

4. **Add API Keys:**
   Ensure your `android/app/src/main/AndroidManifest.xml` and `ios/Runner/AppDelegate.swift` have valid Google Maps API keys configured.

### Running the App

Connect a device or start an emulator/simulator, then run:

```bash
flutter run
```

### Building for Production

**Android APK:**
```bash
flutter build apk --release
```

**iOS Archive:**
```bash
flutter build ipa --release
```

## 📱 Troubleshooting

- **Location Issues**: Ensure location permissions are granted on the device.
- **Connection Refused**: If using an Android Emulator, ensure the backend URL is `10.0.2.2` instead of `localhost`.
- **Map Not Loading**: Verify your Google Maps API key is enabled in the Google Cloud Console and has correct restrictions.

## 🤝 Contributing

Please follow the standard Flutter contribution guidelines.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
