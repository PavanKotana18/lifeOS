# LifeOS - AI Developer Instructions

## 1. Project Overview
LifeOS is an offline-first personal productivity and management application.

Technology stack:
- React
- TypeScript
- Vite
- Tailwind CSS
- Capacitor
- Dexie / IndexedDB

Target platform:
- Android
- Primary test device: iQOO Neo 9 Pro
- Android 16

Core modules:
- Home
- Finance
- Habits
- Goals
- Planner
- Profile

## 2. Mandatory Development Rules

- Understand the existing implementation before modifying code.
- Preserve all existing functionality unless explicitly requested.
- Do not introduce unrelated features or unnecessary refactoring.
- Avoid duplicate components, utilities, and business logic.
- Follow existing project conventions and architecture.
- Use TypeScript safely. Avoid `any` unless justified.
- Keep changes minimal, maintainable, and well documented.

## 3. Security and Privacy

- Follow privacy-by-design principles.
- Do not collect unnecessary personal information.
- Never introduce gender, religion, or other sensitive personal-data collection without explicit approval.
- Never expose secrets, tokens, credentials, or personal financial information.
- Do not add external analytics or tracking without approval.
- Validate imported backup data before restoring it.
- Protect local application data from accidental deletion.
- Do not weaken biometric authentication or application-lock controls.

## 4. Offline-First Architecture

- Core functionality must work without internet access.
- Use existing Dexie / IndexedDB storage patterns.
- Do not introduce cloud dependencies without approval.
- Preserve existing database schemas and migration compatibility.
- Never delete or overwrite existing user data during upgrades.
- Test backup and restore whenever data structures change.

## 5. UI / UX Standards

- Maintain consistent design across all six modules.
- Support dark, light, and system themes.
- Respect Android safe areas and navigation behavior.
- Maintain accessibility and readable contrast.
- Support reduced-motion preferences.
- Ensure responsive layouts for Android devices.
- Do not introduce unnecessary onboarding steps.

## 6. Performance

- Avoid unnecessary React re-renders.
- Use lazy loading and code splitting where appropriate.
- Avoid unnecessarily large dependencies.
- Optimize rendering for mobile devices.
- Do not sacrifice functionality for performance improvements.

## 7. Testing Requirements

Before considering any change complete:

1. Run `npm test`.
2. Run `npx tsc --noEmit`.
3. Run `npm run build`.
4. Run `git diff --check`.
5. Review all modified files.
6. Report test results and known limitations.

For relevant changes, also test:
- Backup and restore.
- Offline functionality.
- Theme persistence.
- Biometric authentication.
- Notifications.
- Android back navigation.
- Existing user-data integrity.

Never claim tests passed unless they were actually executed.

## 8. Git and Release Management

Branch strategy:

- main: stable production.
- develop: integration.
- feature/<name>: new features.
- bugfix/<name>: bug fixes.
- release/<version>: release preparation.
- hotfix/<name>: urgent production fixes.

Rules:

- Never develop directly on main.
- Never commit directly to develop.
- Work only on an explicitly approved feature or bugfix branch.
- Never force-push.
- Never delete branches without approval.
- Never merge pull requests without explicit approval.
- Never create production releases or tags without approval.
- Do not commit generated build files unless explicitly required.

## 9. Approval Boundaries

The agent may:
- Inspect files and architecture.
- Explain implementation options.
- Propose code changes.
- Modify files within the approved scope.
- Run tests and builds.

The agent must obtain explicit approval before:
- Adding or removing dependencies.
- Changing database schemas.
- Modifying authentication or encryption.
- Changing backup formats.
- Introducing network communication.
- Removing existing features.
- Committing or pushing changes.
- Merging pull requests.
- Publishing releases.

## 10. Task Execution Protocol

For every task:

1. Understand the requirement.
2. Inspect relevant existing code.
3. Identify impacted modules.
4. Explain the proposed approach.
5. Identify risks and compatibility concerns.
6. Implement only the approved scope.
7. Run applicable tests.
8. Review the final diff.
9. Summarize files changed, tests performed, and remaining risks.

If requirements are unclear, ask before making assumptions.

## 11. Important Final Rule

LifeOS is a personal application containing sensitive financial,
habit, planning, and personal information.

Data integrity, privacy, security, reliability, and backward
compatibility take priority over speed and visual improvements.
