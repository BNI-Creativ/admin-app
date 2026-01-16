# Ghid: Generare APK pentru BNI Prezență

## Cerințe preliminare

1. **Android Studio** - descărcați de la: https://developer.android.com/studio
2. **Java JDK 17** - necesar pentru compilare
3. **Node.js** (v18+) și **Yarn**

---

## Pașii pentru generarea APK-ului

### Pasul 1: Pregătirea proiectului (pe PC-ul dvs.)

```bash
# Clonați/descărcați proiectul de pe GitHub

# Navigați în directorul frontend
cd frontend

# Instalați dependențele
yarn install

# Construiți versiunea de producție
yarn build

# Sincronizați cu Android
npx cap sync android
```

### Pasul 2: Deschiderea în Android Studio

```bash
# Deschideți proiectul Android în Android Studio
npx cap open android
```

Sau deschideți manual folderul `frontend/android` în Android Studio.

### Pasul 3: Configurarea serverului backend

**IMPORTANT**: Înainte de a construi APK-ul, trebuie să configurați URL-ul backend-ului.

Editați fișierul `frontend/.env.production`:
```
REACT_APP_BACKEND_URL=https://your-backend-server.com
```

Apoi reconstruiți:
```bash
yarn build
npx cap sync android
```

### Pasul 4: Generarea APK-ului în Android Studio

1. În Android Studio, așteptați finalizarea sincronizării Gradle
2. Din meniu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. APK-ul va fi generat în: `android/app/build/outputs/apk/debug/app-debug.apk`

### Pasul 5: Generarea APK-ului semnat (pentru Play Store)

1. Din meniu: **Build → Generate Signed Bundle / APK**
2. Selectați **APK**
3. Creați un nou keystore sau folosiți unul existent:
   - Key store path: alegeți o locație
   - Password: alegeți o parolă sigură
   - Alias: `bni-prezenta`
   - Validity: 25 ani
4. Selectați **release** ca build variant
5. APK-ul semnat va fi în: `android/app/release/app-release.apk`

---

## Generare APK din linia de comandă (fără Android Studio)

```bash
# Navigați în directorul android
cd frontend/android

# APK Debug (pentru testare)
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# APK Release (pentru producție)
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## Structura proiectului Android

```
frontend/android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── assets/public/     # Fișierele web (React build)
│   │       ├── java/.../          # Codul Java/Kotlin
│   │       ├── res/               # Resurse Android (iconițe, etc.)
│   │       └── AndroidManifest.xml
│   └── build.gradle
├── variables.gradle               # Versiuni SDK
└── build.gradle
```

---

## Configurări importante

### Android Manifest (`android/app/src/main/AndroidManifest.xml`)
```xml
<!-- Permisiuni necesare -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Versiunea minimă Android
- **minSdkVersion**: 29 (Android 10)
- **targetSdkVersion**: 34 (Android 14)

---

## Comenzi utile Capacitor

```bash
# Sincronizare după modificări în codul React
yarn build && npx cap sync android

# Copiere doar a fișierelor web
npx cap copy android

# Deschidere Android Studio
npx cap open android

# Rulare pe dispozitiv/emulator
npx cap run android
```

---

## Troubleshooting

### Eroare: "SDK location not found"
Creați fișierul `frontend/android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk  # macOS
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk  # Windows
```

### Eroare: "Could not resolve all dependencies"
```bash
cd frontend/android
./gradlew clean
./gradlew build --refresh-dependencies
```

### Eroare de conexiune la backend
Verificați că backend-ul este accesibil și că URL-ul este corect în `.env.production`

---

## Note

- APK-ul debug poate fi instalat direct pe telefon pentru testare
- APK-ul release trebuie semnat pentru distribuție
- Pentru Play Store, se recomandă folosirea AAB (Android App Bundle) în loc de APK
