PATCH_EXIT=0
NPM_TEST_EXIT=1
TYPECHECK_EXIT=0
BUILD_EXIT=0
DIFF_CHECK_EXIT=0

=== Lifecycle regression summary ===
PASS: Sunday scheduled for weekends
PASS: Monday excluded from weekends
PASS: Daily frequency remains scheduled independent of weekday
PASS: Impossible date rejected
PASS: Invalid date format rejected
PASS: Weekday rate uses five scheduled days
PASS: Weekend rate uses two scheduled days
PASS: Weekday streak crosses Saturday and Sunday
PASS: Weekend streak counts Saturday and Sunday
PASS: Weekly frequency accepts one completion in the current calendar week
PASS: Previous Sunday does not count in the new Monday-Sunday week
PASS: Next Monday does not count in the current calendar week
PASS: Weekly streak counts consecutive Monday-start weeks
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

=== Build summary ===

> lifeos-personal@1.0.0 build
> vite build

vite v6.4.5 building for production...
transforming...
✓ 2213 modules transformed.
rendering chunks...
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
✓ built in 6.07s
