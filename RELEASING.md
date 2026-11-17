# LifeOS branch and release process

## Branches

- `main` contains production-ready releases. Do not develop directly on it.
- `develop` is the integration branch for the next release.
- Start `feature/<name>` and `bugfix/<name>` from `develop`; merge them through pull requests.
- Create `release/<MAJOR.MINOR.PATCH>` from `develop` for release preparation and QA.
- Use `hotfix/<name>` from `main` only for urgent production corrections. After its reviewed production merge, merge the fix back into `develop` as well.

Keep branches current with their base before opening a pull request. Resolve conflicts on the topic branch; do not force-push shared branches.

## Versioning

`package.json` is the authoritative Semantic Version (`MAJOR.MINOR.PATCH`). `package-lock.json` is updated with it by npm. The Profile screen reads the package version, and Android Gradle reads the same package version for `versionName`.

Android `versionCode` uses `MAJOR * 1,000,000 + MINOR * 1,000 + PATCH + GITHUB_RUN_NUMBER`. Local builds without that environment value use the SemVer-derived base code. MINOR and PATCH must each remain below 1000. GitHub Actions APK builds are not used; build review artifacts locally with the isolated Dev signing identity.

Use a PATCH bump for compatible fixes, MINOR for backward-compatible features, and MAJOR for breaking changes. Do not change the Android application ID (`com.lifeos.personal`).

## Release checklist

1. Merge reviewed feature and bug-fix pull requests into `develop` only after the local verification steps below pass and the change has been reviewed.
2. Create `release/<version>` from the tested `develop` commit and push it.
3. Set the release version with `npm version <version> --no-git-tag-version` (this updates `package.json` and `package-lock.json`). Update `CHANGELOG.md` with the date and the `Added`, `Changed`, `Fixed`, `Security`, and `Removed` sections. Commit these release-preparation changes on the release branch.
4. Run the local verification steps below on the release branch. Build and inspect the isolated Dev APK. Complete release QA through the approved manual process; do not treat a local debug APK as a production release.
5. Open a pull request from the release branch to `main`. Merge only after review, required repository protections, and QA approval. GitHub Actions workflows are not present; repository protection settings are external and unchanged.
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

To create the signed development preview APK, configure the existing
`LIFEOS_DEBUG_KEYSTORE_PATH`, `LIFEOS_DEBUG_KEYSTORE_PASSWORD`,
`LIFEOS_DEBUG_KEY_ALIAS` and `LIFEOS_DEBUG_KEY_PASSWORD` values in the local
process environment without writing them to source files, then run:

```powershell
gradle -p android --no-daemon :app:assembleDebug
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk` and must identify
as `com.lifeos.personal.dev`. The local Gradle signing gate fails when the
isolated Dev signing credentials are unavailable. The repository contains no
GitHub Actions workflow automation; no branch protections or GitHub security
settings are changed by local builds.

## Recommended GitHub protection

Configure repository rulesets (or branch protection) for `main` and `develop`: require pull requests, require the `Automated checks` status, require `Android integration and release verification` for merges into `main` and `develop`, block force pushes and branch deletion, and require at least one approving review for `main` where the plan supports it. Consider requiring linear history and dismissing stale approvals after new commits. These are recommendations; repository settings must be checked separately and are not changed by this document.
