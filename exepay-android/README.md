# ExePay Android App

Android companion app for ExePay. Receives payment requests from the Chrome extension and enables users to complete payments using their preferred UPI app.

See the main [README](../README.md) for full project documentation.

## Features

- Real-time payment request notifications via Firebase
- Dashboard showing pending and completed payments
- UPI deep link integration with any payment app
- Profile management with Cloudinary image support
- Dark theme with Material Design 3

## Requirements

- Android Studio Hedgehog or later
- JDK 17
- Android SDK 26+ (minimum), 34 (target)
- Firebase project with Authentication and Firestore enabled

## Setup

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your ExePay project
3. Navigate to Project Settings → Your apps → Android app
4. Download `google-services.json`
5. Place it in the `app/` directory

Package name must be: `com.exepay.app`

### 2. Build

```bash
# Open in Android Studio
# File → Open → select exepay-android folder

# Sync Gradle (click "Sync Now" when prompted)

# Build debug APK
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug
```

Or use Android Studio's Run button.

## Project Structure

```
app/src/main/java/com/exepay/app/
├── ExePayApp.kt                    # Application class
├── data/
│   ├── Models.kt                   # Data models
│   └── FirebaseRepository.kt       # Firebase operations
├── util/
│   └── NotificationHelper.kt       # Local notifications
└── ui/
    ├── splash/SplashActivity.kt    # Splash screen
    ├── auth/LoginActivity.kt       # Authentication
    └── dashboard/
        ├── DashboardActivity.kt    # Main dashboard
        └── PaymentsAdapter.kt      # Payment list adapter
```

## UPI Integration

The app uses standard UPI deep links:

```
upi://pay?pa={UPI_ID}&pn={NAME}&am={AMOUNT}&cu=INR
```

Compatible with Google Pay, PhonePe, Paytm, BHIM, and any UPI-compliant app.

## Permissions

- `INTERNET` - Firebase communication
- `POST_NOTIFICATIONS` - Push notifications (Android 13+)
- `VIBRATE` - Notification alerts

## Release Build

```bash
# Generate signing keystore
keytool -genkey -v -keystore exepay.keystore -alias exepay -keyalg RSA -keysize 2048 -validity 10000

# Build release APK
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`

## Tech Stack

- Kotlin 1.9
- Material Design 3
- Firebase Authentication
- Cloud Firestore
- Coil for image loading
- Coroutines for async operations

## License

This project is proprietary software. All rights reserved.
