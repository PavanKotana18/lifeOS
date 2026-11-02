# Changelog

All notable LifeOS changes are documented here. Versions follow Semantic Versioning.

## [Unreleased]

### Added
- Release process documentation describing the intended main, develop, and testing branch workflow.

### Changed
- Release guidance aligned with the current CI workflow and documented branch roles.

### Fixed
- Corrected outdated CI job and branch-protection guidance without assuming protections are enabled.

### Security
- No security behavior changes in this documentation update.

## [1.0.0] - 2026-10-31

### Added
- Calendar-first Planner with selected-day task agendas and task details.
- Resumable onboarding with persisted setup progress.
- System appearance monitoring, including native Android theme updates.
- Nested tab navigation and modal-first Android Back handling.
- Finance analytics, category budgets, and user display preferences.

### Changed
- Personalized time-of-day greeting and improved light-theme presentation.
- Profile notification preferences use a nested settings view.

### Fixed
- Fresh-install onboarding detection and theme bootstrap behavior.
- Biometric startup coordination for overlapping and stale authentication attempts.
- Finance budget analytics resolve stored category IDs to category names.

### Security
- Existing biometric and native security integrations retained; no new security claims.

### Removed
- Gender collection from onboarding.
