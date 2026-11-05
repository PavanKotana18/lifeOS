const fs = require('fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const checks = [
  ['Biometric prompt transition guard',
    app.includes('pendingBackgroundLock.current = window.setTimeout(') &&
    app.includes('if (disposed || appIsActive.current) return;') &&
    app.includes('authCoordinator.resetForBackground()') &&
    app.includes('if (biometricAuthInFlight.current) return biometricAuthInFlight.current;')],
  ['Exact-alarm permission check',
    app.includes('NotificationService.checkExactAlarmPermission()')],
  ['Exact-alarm permission request',
    app.includes('NotificationService.requestExactAlarmPermission()')],
  ['Central task completion handler',
    app.includes('const handleTaskCompletion = async (task: Task)')],
  ['Dashboard uses guarded handler',
    app.includes('onChange={() => { void handleTaskCompletion(t); }}')],
  ['Planner uses guarded handler',
    app.includes('onChange={() => { void handleTaskCompletion(t); }}')],
  ['Task detail uses guarded handler',
    app.includes('void handleTaskCompletion(plannerDetailTask)')],
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
