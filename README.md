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

## Continuous integration

The GitHub Actions workflow runs application tests, dependency auditing,
Sentinel verification, TypeScript checks, the web build and Capacitor
synchronisation. Eligible branch and pull-request builds also produce an
Android debug APK artifact.

The workflow does not currently produce a signed production release APK.

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
