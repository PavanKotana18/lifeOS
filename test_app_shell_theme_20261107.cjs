'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const render = (element) => renderToStaticMarkup(element);
const fsSource = fs.readFileSync('src/App.tsx', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');
const lockedStart = fsSource.indexOf('  // If App is Biometrically Locked');
const shellStart = fsSource.indexOf('className="lifeos-page app-shell"', lockedStart);
const shell = fsSource.slice(lockedStart, shellStart);
const startupStart = fsSource.indexOf('  if (!appReady) return');
const onboardingStart = fsSource.indexOf('  if (onboardingRequired', startupStart);
const startup = fsSource.slice(startupStart, onboardingStart);
const footerStart = fsSource.indexOf('      {showExitConfirmation &&');
const footer = fsSource.slice(footerStart, fsSource.indexOf('\n    </div>\n  );', footerStart));
assert.ok(lockedStart >= 0 && shellStart > lockedStart && startupStart >= 0 && onboardingStart > startupStart && footerStart >= 0, 'App shell regions remain identifiable');
assert.doesNotMatch(shell, /(?:text|bg|border)-(?:slate|gray|indigo|amber|rose|emerald)-\d+/, 'lock and header use semantic theme tokens');
assert.doesNotMatch(startup, /(?:text|bg|border)-(?:slate|gray|indigo|amber|rose|emerald)-\d+/, 'startup error and loading states use semantic theme tokens');
assert.match(shell, /onClick=\{triggerBiometricAuth\}/, 'lock screen retains the existing biometric callback');
assert.match(shell, /onClick=\{\(\) => \{ void openRecovery\(\); \}\}/, 'lock recovery opens through the protection gate');
assert.match(fsSource, /const openRecovery = async \(\) => \{\s*try \{\s*await setSensitiveScreenshotState\(true\);\s*setRecoveryOpen\(true\);/, 'recovery secrets are not rendered before native screenshot protection is acknowledged');
assert.doesNotMatch(shell, /theme-toggle-btn|onClick=\{toggleTheme\}/, 'header has no duplicate theme shortcut');
assert.match(fsSource, /id="color-theme-title"/, 'curated theme selection remains in Settings appearance');
assert.match(fsSource, /aria-label="Open profile and settings"/, 'profile remains the header settings entry point');
assert.match(fsSource, /lifeos-mark/, 'LifeOS mark uses its semantic shell class');
assert.match(fsSource, /BrandMark/, 'App shell renders the shared original vector brand mark');
assert.match(fsSource, /Daily consistency monitor<\/p>/, 'habit heading remains in the semantic palette');
assert.match(fsSource, /Reminder · \{h\.reminderTime\} local<\/p>/, 'habit reminder remains in the semantic palette');
assert.match(footer, /onClick=\{\(\) => void CapacitorApp\.exitApp\(\)\}/, 'exit action remains connected');
assert.match(footer, /role="status" aria-live="polite"/, 'toast remains announced to assistive technology');
assert.match(styles, /\.lifeos-warning \{ color: var\(--warning\); \}/, 'warning text maps to the active theme');

const SecureSetupDialog = require('./src/components/SecureSetupDialog.tsx').default;
const RecoveryDialog = require('./src/components/RecoveryDialog.tsx').default;
const BackupPassphraseDialog = require('./src/components/BackupPassphraseDialog.tsx').default;
const setup = render(React.createElement(SecureSetupDialog, {
  prepared: { recoveryCode: 'SYNTHETIC-RECOVERY-CODE', envelope: 'SYNTHETIC-ENVELOPE' }, onDecision: () => {},
}));
assert.match(setup, /role="dialog" aria-modal="true"/);
assert.match(setup, /SYNTHETIC-RECOVERY-CODE/);
assert.match(setup, /SYNTHETIC-ENVELOPE/);
assert.match(setup, /Confirm recovery kit and open encrypted storage/);
assert.match(setup, /disabled=""/, 'recovery confirmation remains disabled until user confirms saved kit and code');
assert.doesNotMatch(setup, /(?:text|bg|border)-(?:slate|gray|indigo|amber)-\d+/);
const recovery = render(React.createElement(RecoveryDialog, { onRecover: async () => {}, onClose: () => {} }));
assert.match(recovery, /role="dialog" aria-modal="true"/);
assert.match(recovery, /accept="application\/json,\.json"/);
const backup = render(React.createElement(BackupPassphraseDialog, { purpose: 'export', onComplete: () => {} }));
assert.match(backup, /role="dialog" aria-modal="true"/);
assert.match(backup, /minLength="12"/);
assert.match(backup, /lifeos-input/);
console.log('APP SHELL THEME: 23 source and production-render security/accessibility checks passed with synthetic recovery data.');
