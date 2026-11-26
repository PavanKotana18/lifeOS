# BusyDoo

**Life, in one place.**

BusyDoo uses the Feather interface and the Soft Ivory + Sage Feather palette by default. Other palettes and custom accents are available under **Profile ? Appearance**. Replay the approved A Life in Harmony launch under **Profile ? About BusyDoo**. The bundled Inter font is covered by the [SIL Open Font License](src/assets/fonts/OFL.txt).

Existing installations and backups retain their LifeOS package, database, recovery, and backup identifiers. The Standard app stays independent of the Private SMS experiment.

BusyDoo is an Android personal life-management application built with React,
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

## Android build types

Use the standard `:app:assembleDebug` variant for local development. It is
labelled **BusyDoo Debug**, uses the isolated package `com.lifeos.personal.debug`
and the standard Android debug signing key. It does not replace existing Dev,
Preview or production installations. Release keeps the production package
`com.lifeos.personal` and requires the production signing identity. Release
artifact builds are manual and require an explicit workflow dispatch choice.
See `RELEASING.md` for the commands and release controls.

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
