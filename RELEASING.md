# LifeOS development and release process

## Protected branches

- `main`: production-ready baseline.
- `develop`: integration branch for the next release.
- `testing`: validation branch for candidate changes.
- `archive/develop-pre-sanitization-20261102`: preserved historical branch; never use as an integration base.

All three active branches require pull requests, the `Automated checks` and `Android debug build` status checks, and up-to-date branches. Force pushes and branch deletion are disabled. The current rules require zero approving reviews, so maintainers must still perform their own code review.

## Feature workflow

1. Create `feature/<name>` or `bugfix/<name>` from `develop`.
2. Implement one focused change and add regression tests.
3. Push the topic branch and wait for CI.
4. Use a pull request into `testing` when device or integration validation is needed.
5. Promote validated changes into `develop` through a pull request.
6. Promote release-ready changes from `develop` to `main` through a pull request after release QA.

Recover archived work selectively after comparing it with current code and tests. Never merge the archived branch wholesale.

## Versioning

`package.json` is the authoritative Semantic Version (`MAJOR.MINOR.PATCH`); keep `package-lock.json` synchronized. Android Gradle derives `versionName` and `versionCode` from this version and the GitHub Actions run number. Keep MINOR and PATCH below 1000. Do not change the Android application ID (`com.lifeos.personal`) without a migration plan.

Use PATCH for compatible fixes, MINOR for backward-compatible features, and MAJOR for breaking changes.

## Release checklist

1. Confirm the target commit passed CI on `develop` and complete functional, security, backup/restore, and physical-device QA.
2. Create `release/<MAJOR.MINOR.PATCH>` from validated `develop`.
3. Update `package.json`, `package-lock.json`, and this changelog on the release branch.
4. Run CI and inspect the debug APK on a physical Android device.
5. Open a pull request from the release branch to `main`. Merge only after checks and release QA pass.
6. Tag the production commit `v<MAJOR.MINOR.PATCH>`. Publish a GitHub Release manually only after distributable review and signing requirements are satisfied.
7. Merge release changes back into `develop` through a pull request.

For an urgent production fix, branch from `main`, validate and merge through a pull request, then port the fix back into `develop` and `testing` as appropriate.

## CI behavior

The current `.github/workflows/build-apk.yml` runs `Automated checks` on pushes to `main`, `develop`, `testing`, and configured `feature/**`, `bugfix/**`, `release/**`, and `hotfix/**` branches. It also runs for pull requests targeting `main`, `develop`, or `testing`.

Checks include project tests, dependency audit, Sentinel verification, TypeScript checking, web build, and Capacitor sync. The `Android debug build` job builds and uploads a debug APK for configured branch and pull-request events. Artifacts are retained for 30 days.

The workflow does not sign production APKs, publish GitHub Releases, create tags, or automatically merge branches. The executable workflow takes precedence over this document.
