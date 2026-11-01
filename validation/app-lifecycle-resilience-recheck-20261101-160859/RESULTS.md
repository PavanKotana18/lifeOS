PATCH_EXIT=0
NPM_TEST_EXIT=0
TYPECHECK_EXIT=0
BUILD_EXIT=0
DIFF_CHECK_EXIT=0

PASS: App passes frequency into streak calculation
PASS: App passes frequency into weekly rate calculation
PASS: Productivity score respects unscheduled days
PASS: Habit UI displays scheduled-day denominator
PASS: Habit completion writes are centralised in one UI handler
PASS: Habit persistence failures are visible to the user
PASS: Successful saves with failed UI refresh are reported accurately
PASS: Notification refresh failures do not misreport the habit save as failed
PASS: Dashboard and Habits tab use the shared completion handler
PASS: Habit deletion is centralised in one UI handler
PASS: Habit deletion failures are visible to the user
PASS: Habits tab uses the shared deletion handler
PASS: Application database is Dexie-backed local IndexedDB
PASS: Application bootstrap reads local settings before rendering
PASS: Application initial data loading uses local StorageService and Dexie tables
PASS: Connectivity state initializes from navigator.onLine
PASS: Online and offline browser events update connectivity state
PASS: Offline indicator explains local data availability
PASS: Connectivity indicator does not gate local database operations
PASS: Capacitor app is configured to use packaged local web assets
PASS: No application-level fetch dependency exists in bootstrap or database layer
PASS: Capacitor app-state listener removes itself if registration resolves after cleanup
PASS: Capacitor back-button listener removes itself if registration resolves after cleanup
PASS: Resume processing prevents overlapping recovery runs
PASS: Resume and listener-registration failures are handled explicitly
PASS: Disposed lifecycle callbacks do not continue updating app state
OFFLINE RESILIENCE SOURCE CHECKS: 14/14 PASSED
PASS: January 31 advances to February 29 in a leap year
PASS: February 29 advances to March 29 without date overflow
PASS: December 31 advances correctly across the year boundary
PASS: A 30th-of-month recurrence remains on the 30th when possible
PASS: May 31 clamps to June 30
PASS: Editing a generated occurrence does not modify its source task
PASS: Deleting a generated occurrence preserves its completed source task
PASS: Repeated completion after database reopen does not duplicate the occurrence

computing gzip size...
dist/index.html                   1.11 kB │ gzip:   0.56 kB
dist/assets/index-C9Ts8MIQ.css   28.68 kB │ gzip:   6.43 kB
dist/assets/web-BpxMKtnv.js       0.67 kB │ gzip:   0.33 kB
dist/assets/web-D0tlfZfe.js       3.44 kB │ gzip:   1.10 kB
dist/assets/index-CYLApL49.js   830.44 kB │ gzip: 234.58 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.47s
