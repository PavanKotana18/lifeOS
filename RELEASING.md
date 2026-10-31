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

Android `versionCode` uses `MAJOR * 1,000,000 + MINOR * 1,000 + PATCH + GITHUB_RUN_NUMBER`. The workflow run number increases for each run of this workflow, so distributable APKs from later runs receive higher codes. MINOR and PATCH must each remain below 1000. Produce distributable APKs through GitHub Actions; local Gradle builds without a run number use only the SemVer-derived base code.

Use a PATCH bump for compatible fixes, MINOR for backward-compatible features, and MAJOR for breaking changes. Do not change the Android application ID (`com.lifeos.personal`).

## Release checklist

1. Merge reviewed feature and bug-fix pull requests into `develop`; wait for its integration build and tests.
2. Create `release/<version>` from the tested `develop` commit and push it.
3. Set the release version with `npm version <version> --no-git-tag-version` (this updates `package.json` and `package-lock.json`). Update `CHANGELOG.md` with the date and the `Added`, `Changed`, `Fixed`, `Security`, and `Removed` sections. Commit these release-preparation changes on the release branch.
4. Run and review the `Automated checks` and `Android integration and release verification` jobs on the release branch. Confirm Debug and Release APK artifacts exist, inspect them on the target device, and complete release QA. Do not publish merely because CI passed.
5. Open a pull request from the release branch to `main`. Merge only after review, required checks, and QA approval.
6. On the resulting production commit, create an annotated tag `v<version>` (for example, `v1.2.0`) and push the tag. Publish a GitHub Release manually from that tag, attach the reviewed APKs, and use the changelog entry as release notes. The current workflow builds artifacts; it does not automatically publish releases or sign APKs.
7. Merge the release branch back into `develop` through a pull request so version and changelog updates are retained. Delete the release branch only after both merges and the published release are verified.

For a hotfix, use a PATCH release unless the correction requires a different SemVer increment; apply the production fix to `develop` after the main merge.

## CI behavior

`.github/workflows/build-apk.yml` runs checks (tests, TypeScript, web build, and Capacitor sync) on `feature/**`, `bugfix/**`, `develop`, `release/**`, `hotfix/**`, and `main` pushes. Pull requests targeting `develop` or `main` run checks. Android Debug and Release builds run on `develop`, `release/**`, `hotfix/**`, and `main`, and for pull requests into `develop` or `main`. Artifacts are uploaded for 30 days. No job merges branches, creates tags, or publishes a release.

## Recommended GitHub protection

Configure repository rulesets (or branch protection) for `main` and `develop`: require pull requests, require the `Automated checks` status, require `Android integration and release verification` for merges into `main` and `develop`, block force pushes and branch deletion, and require at least one approving review for `main` where the plan supports it. Consider requiring linear history and dismissing stale approvals after new commits. These are recommendations; repository settings must be checked separately and are not changed by this document.
