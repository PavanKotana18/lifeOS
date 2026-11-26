# BusyDoo branch and release process

## Branches

- `main` contains production-ready releases. Do not develop directly on it.
- `develop` is the integration branch for the next release.
- Start `feature/<name>` and `bugfix/<name>` from `develop`; merge them through pull requests.
- Create `release/<MAJOR.MINOR.PATCH>` from `develop` for release preparation and QA.
- Use `hotfix/<name>` from `main` only for urgent production corrections. After its reviewed production merge, merge the fix back into `develop` as well.

Keep branches current with their base before opening a pull request. Resolve conflicts on the topic branch; do not force-push shared branches.

## Versioning

`package.json` is the authoritative Semantic Version (`MAJOR.MINOR.PATCH`). `package-lock.json` is updated with it by npm. The Profile screen reads the package version, and Android Gradle reads the same package version for `versionName`.

Android Release uses `MAJOR * 1,000,000 + MINOR * 1,000 + PATCH + GITHUB_RUN_NUMBER`. MINOR and PATCH must each remain below 1000.

The **Build BusyDoo Android APK** workflow owns the distributable Standard Debug version sequence. Its Debug code is the value in `android/debug-version-floor.txt` plus that workflow's run number. Emulator QA and ordinary local builds use the floor. A rebuild for owner review sets `LIFEOS_ANDROID_DEBUG_BUILD_NUMBER` to the reservation of the successful workflow run for the same source commit.

Use the established local Debug keystore when building an in-place owner update. The GitHub runner's Debug certificate is for its own artifacts. Compare the installed APK's certificate with the owner candidate before installation and preserve the existing installation if they differ.

Use a PATCH bump for compatible fixes, MINOR for backward-compatible features, and MAJOR for breaking changes. Do not change the Android application ID (`com.lifeos.personal`).

## Release checklist

1. Merge reviewed feature and bug-fix pull requests into `develop` only after the local verification steps below pass and the change has been reviewed.
2. Create `release/<version>` from the tested `develop` commit and push it.
3. Set the release version with `npm version <version> --no-git-tag-version` (this updates `package.json` and `package-lock.json`). Update `CHANGELOG.md` with the date and the `Added`, `Changed`, `Fixed`, `Security`, and `Removed` sections. Commit these release-preparation changes on the release branch.
4. Run the local verification steps below on the release branch. Build and inspect the Debug APK. Complete release QA through the approved manual process; do not treat a local debug APK as a production release.
5. Open a pull request from the release branch to `main`. Merge only after review, required repository protections, and QA approval.
6. On the resulting production commit, create an annotated tag `v<version>` (for example, `v1.2.0`) and push the tag. Publish a GitHub Release manually from that tag only after release signing and QA are completed.
7. Merge the release branch back into `develop` through a pull request so version and changelog updates are retained. Delete the release branch only after both merges and the published release are verified.

For a hotfix, use a PATCH release unless the correction requires a different SemVer increment; apply the production fix to `develop` after the main merge.

## Local verification and APK build

Run these checks from the repository root:

```powershell
npm test
npm run test:sentinel
npx tsc --noEmit
npm run build
npx cap sync android
```

Build the local development APK with:

```powershell
gradle -p android --no-daemon :app:assembleDebug
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. It must identify
as `com.lifeos.personal.debug` and `BusyDoo Debug`. Android's standard debug key
is used for this isolated package; no signing secret is stored in source
control. Do not install it over the old `.dev` or `.preview` packages.

Do not build a Release APK or AAB without explicit approval. Release uses only
the production signing identity (`ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). The
GitHub workflow builds Debug on ordinary checks; it builds and uploads Release
only when manually dispatched with `build_release` selected and valid
production signing secrets. It never falls back to a debug key.

## Recommended GitHub protection

Configure repository rulesets (or branch protection) for `main` and `develop`: require pull requests, require the `Automated checks` status, require `Android integration and release verification` for merges into `main` and `develop`, block force pushes and branch deletion, and require at least one approving review for `main` where the plan supports it. Consider requiring linear history and dismissing stale approvals after new commits. These are recommendations; repository settings must be checked separately and are not changed by this document.
