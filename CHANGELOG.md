# Changelog

Notable LifeOS changes are documented here. Versions follow Semantic Versioning.

## [Unreleased]

### Added

- Calendar-first Planner with selected-day task agendas and task details.
- Onboarding step persistence so interrupted setup resumes where it stopped.
- Android system appearance monitoring while LifeOS is open.
- Previous-page navigation history with modal-first Android Back handling.

### Changed

- Reordered the nested Planner around task ranges and the selected-day agenda, with the month calendar available on demand.
- Put Expense, Income and Transfer first in Money; clarified recorded cash flow and optional account tracking.
- Tightened Today spacing, simplified repeated empty states and kept its default sections focused on the day.
- Replaced app-level browser confirmations with accessible themed dialogs and protected dirty forms from accidental dismissal.
- Reduced empty Analytics space and avoid loading the chart module when there is no recorded financial history.
- Personalized time-of-day header greeting and a more readable light-theme palette.
- Profile notification preferences open as a nested settings view.

### Fixed

- Fresh-install onboarding detection no longer persists a default theme before checking for legacy data.
- Native startup no longer requests the optional AndroidX EmojiCompat downloadable-font provider; AndroidX Startup lifecycle initialization remains registered.

### Security

- _None._

### Removed

- _None._

## [1.0.0] - 2026-10-31

### Added

- Established the existing LifeOS application as the documented 1.0.0 baseline. Earlier history is preserved and is not reconstructed here.

### Changed

- _None recorded._

### Fixed

- _None recorded._

### Security

- _None recorded._

### Removed

- _None recorded._
