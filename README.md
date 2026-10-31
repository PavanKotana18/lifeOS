# LifeOS — Personal Life Management Android Application

An offline-first, private personal management system engineered specifically for **iQOO Neo 9 Pro (Android 16)**.

---

## 📱 How to Build & Install the APK on Your Android Smartphone (Zero Computer Needed)

You do **not** need Android Studio or a computer to compile and install LifeOS. All remote compilation is automated using GitHub Actions.

### Step 1: Upload Project to GitHub from Your Smartphone
1. Open Chrome or your preferred mobile browser on your **iQOO Neo 9 Pro** and navigate to [github.com/new](https://github.com/new).
2. Name the repository `lifeos`, set it to **Private**, and tap **Create repository**.
3. Extract the downloaded `LifeOS-Android-Capacitor.zip` archive on your phone (using your phone's default Files app or ZArchiver).
4. On your new GitHub repository page, tap **Add file** &rarr; **Upload files**, select all the unzipped files and directories (including `.github`), and commit directly to the `main` branch.
   *(Or if using Termux / Git on Android: `git init`, `git add .`, `git commit -m "feat: complete LifeOS"`, `git push origin main`)*.

### Step 2: Automatic Cloud Compilation
1. In your GitHub repository, tap the **Actions** tab.
2. The **Build LifeOS Android APK** workflow will trigger automatically.
3. It installs Node 18, executes the automated LifeOS test suite (34 verification checks), compiles the React/TypeScript frontend, syncs Capacitor assets, and invokes Gradle 8.2 to build the Android debug APK.
4. Total build duration is ~2 to 3 minutes.

### Step 3: Download & Install on iQOO Neo 9 Pro
1. When the run finishes with a green checkmark ✅, tap on the completed workflow run.
2. Scroll to the **Artifacts** section at the bottom of the summary screen.
3. Tap **LifeOS-debug-apk** to download `app-debug.apk` directly to your phone.
4. Open the downloaded file from your Android notification bar or Files app and tap **Install**.
   *(If prompted by Android 16 to allow installs from your browser/files app, toggle 'Allow from this source')*.
5. Launch **LifeOS** from your phone's launcher!

---

## 🔒 Actual Android Biometric Security
- **Native Android BiometricPrompt**: LifeOS implements genuine biometric verification (`BiometricAuthPlugin.java`) using Android's `androidx.biometric.BiometricPrompt`.
- **Supported Biometrics**: In-display optical fingerprint scanner (standard on iQOO Neo 9 Pro) and device credentials (phone PIN/pattern fallback).
- **Auto-Relock**: If enabled in Settings, the application automatically locks whenever it is sent to the background and requires biometric authentication to reveal personal records upon resume.

---

## 💾 Offline Database & Zero-Telemetry Privacy
- **Dexie.js IndexedDB**: Your single source of truth on-device. Data survives device reboots, app restarts, and system updates.
- **Clean First Launch**: First run starts with a clean database and zero hardcoded demo data.
- **Optional Demo Data**: Sample records can be populated anytime via the clearly labelled **Load Sample Demo Data** button in Settings.
- **Complete JSON Backup**: Full export and verified import with schema validation and conflict warnings.
- **100% Offline**: No remote accounts, no cloud sync, no tracking, and no external analytics.
