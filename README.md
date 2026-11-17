# LifeOS

LifeOS is an Android personal life-management application built with React,
TypeScript, Vite and Capacitor.

The application includes personal planning and tracking features, local data
persistence, backup and restore functionality, and native Android security
integrations.

## Technology

- React and TypeScript
- Vite
- Capacitor 6
- Dexie / IndexedDB
- Native Android Java plugins
- Android BiometricPrompt and Android Keystore integration

## Repository

- `main`: production baseline
- `develop`: integration branch
- `testing`: dedicated QA and release-candidate validation
- `feature/*`, `bugfix/*`, `hotfix/*`: isolated development work

Changes should be submitted through pull requests. Do not push directly to
protected branches.

## Local development

Requirements:

- Node.js 20
- npm
- Java 17
- Android SDK and Gradle for Android builds

Install dependencies:

    npm ci

Run the application:

    npm run dev

Run application regression tests:

    npm test

Run Sentinel verification:

    npm run test:sentinel

Run all test suites:

    npm run test:all

Type-check:

    npx tsc --noEmit

Build the web application:

    npm run build

Synchronise the Android project:

    npx cap sync android

Build a debug APK:

    cd android
    gradle assembleDebug

## Local verification

LifeOS development checks run locally. Before sharing a change, run
`npm test`, `npm run test:sentinel`, `npx tsc --noEmit` and `npm run build`.
GitHub Actions workflow automation is not configured in this repository.

Android debug APKs are built locally with the isolated Dev signing identity.
Keep its keystore and password values outside the repository; see
`RELEASING.md` for the local build steps.

## Security

- Never commit credentials, signing keys, personal databases, backups or
  private user data.
- Keep Android signing credentials outside the repository.
- Review changes to cryptography, backup/restore, authentication and native
  Android plugins carefully.
- Report suspected security issues privately to the repository maintainer.

## Licensing

This repository currently has no open-source licence. Public visibility does
not itself grant permission to reuse, distribute or modify its contents.
