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
assert.doesNotMatch(setup, /SYNTHETIC-ENVELOPE/, 'the key envelope is exported, not rendered in the page');
assert.match(setup, /Save complete recovery kit/);
assert.match(setup, /Paste your recovery code to confirm/);
assert.match(setup, /Continue to LifeOS/);
assert.match(setup, /aria-live="polite"/);
assert.doesNotMatch(setup, /I saved the complete recovery kit|Complete private recovery kit|type="checkbox"/);
const lockedSetup = render(React.createElement(SecureSetupDialog, {
  prepared: { recoveryCode: 'SYNTHETIC-RECOVERY-CODE', envelope: 'SYNTHETIC-ENVELOPE' },
  recoveryExportResumeReady: false, onDecision: () => {}, onRetryRecoveryExportResume: () => {},
}));
assert.match(lockedSetup, /Unlock to continue/);
assert.doesNotMatch(lockedSetup, /SYNTHETIC-RECOVERY-CODE|SYNTHETIC-ENVELOPE/, 'recovery material is hidden until native unlock succeeds after the picker');
assert.doesNotMatch(setup, /(?:text|bg|border)-(?:slate|gray|indigo|amber)-\d+/);
const setupSource = fs.readFileSync('src/components/SecureSetupDialog.tsx', 'utf8');
const appStateLifecycle = fs.readFileSync('src/App.tsx', 'utf8');
const clipboardService = fs.readFileSync('src/services/sensitiveClipboardService.ts', 'utf8');
const clipboardNative = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/LifeOSClipboardPlugin.java', 'utf8');
const backupExport = fs.readFileSync('src/services/backupExportService.ts', 'utf8');
const backupNative = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/LifeOSBackupPlugin.java', 'utf8');
const cryptoNative = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java', 'utf8');
const mainActivity = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/MainActivity.java', 'utf8');
assert.match(setupSource, /contents:\s*JSON\.stringify\(file\)/);
assert.match(setupSource, /recoveryCode:\s*prepared\.recoveryCode/);
assert.match(setupSource, /envelope:\s*prepared\.envelope/);
assert.match(setupSource, /result\.status === 'cancelled'/, 'a cancelled file-save does not count as exported');
assert.match(setupSource, /if \(result\.status === 'cancelled'\) \{\s*announce\('Save cancelled\. Save the complete kit to continue\.'\);\s*\} else if \(result\.status === 'saved'\)/, 'file-picker cancellation keeps continuation locked');
assert.match(setupSource, /matchesRecoveryCode\(code, prepared\.recoveryCode\)/, 'only a format-valid normalized exact match confirms recovery');
assert.match(setupSource, /kitExportState === 'saved'/, 'only a completed native save enables recovery continuation');
assert.match(setupSource, /preservePendingRecovery: true/, 'the Android recovery-kit save uses the narrowly scoped lifecycle marker');
assert.match(setupSource, /!kitExported \|\| !exactMatch/, 'continuation requires complete-kit export and exact code confirmation');
assert.match(setupSource, /Copy failed\. You can select and copy the code manually\./);
assert.doesNotMatch(setupSource, /console\.(?:log|error).*prepared|console\.(?:log|error).*recoveryCode/);
assert.match(clipboardService, /nativeClipboard\.copyRecoveryCode\(\{ code \}\)/);
assert.match(clipboardService, /clearRecoveryCodeIfMatches/);
assert.match(clipboardNative, /android\.content\.extra\.IS_SENSITIVE/);
assert.match(clipboardNative, /clipboard\.clearPrimaryClip\(\)/);
assert.match(clipboardNative, /code\.contentEquals\(current\.getItemAt\(0\)\.coerceToText/);
assert.doesNotMatch(clipboardNative, /Log\.|printStackTrace|call\.reject\([^\n]*,\s*error|error\.getMessage/);
assert.match(backupExport, /Intent\.ACTION_CREATE_DOCUMENT|saveFile/);
assert.match(backupExport, /preservePendingRecovery[\s\S]*fileName\.startsWith\('lifeos-recovery-kit-'/, 'only a recovery kit export requests the native lifecycle window');
assert.match(backupNative, /fileName\.startsWith\("lifeos-recovery-kit-"\)/, 'native preservation is limited to recovery JSON exports');
assert.match(backupNative, /finishRecoveryExport\(call\)/, 'picker success, cancellation, and failure release the native marker');
assert.match(cryptoNative, /clearDataKey\(\);\s*recoveryDeferralAllowed = false;\s*if \(!isRecoveryExportRetentionActive\(\)\) clearPendingRecovery\(\)/, 'native security locks wipe the unlocked data key but retain the volatile envelope only during a marked picker');
assert.match(cryptoNative, /isRecoveryExportRetentionActive\(\)[\s\S]*RecoveryExportActivityGuard\.isActive\(\)[\s\S]*SystemClock\.elapsedRealtime\(\) >= recoveryPickerPreserveUntil/, 'pending-envelope preservation has a hard monotonic-time expiry');
assert.match(cryptoNative, /cancelPendingRecovery\(PluginCall call\)[\s\S]*prefs\.contains\("recovery_wrapped"\)[\s\S]*clearPendingRecovery\(\)/, 'cancel only discards an unconfirmed volatile recovery envelope, never a confirmed kit');
assert.match(appStateLifecycle, /recoveryExportLifecycle\.markInactive\(\)[\s\S]*if \(recoveryPicker === null\) secureSetupResolver\.current\?\.\(false\)/, 'only a marked save-picker round trip avoids cancelling the pending recovery dialog');
assert.match(appStateLifecycle, /pendingResume\(\)[\s\S]*resumeRecoveryAfterPicker\(\)/, 'return from a marked picker must authenticate before recovery can continue');
assert.match(mainActivity, /registerPlugin\(LifeOSClipboardPlugin\.class\)/);
const recovery = render(React.createElement(RecoveryDialog, { onRecover: async () => {}, onClose: () => {} }));
assert.match(recovery, /role="dialog" aria-modal="true"/);
assert.match(recovery, /accept="application\/json,\.json"/);
const backup = render(React.createElement(BackupPassphraseDialog, { purpose: 'export', onComplete: () => {} }));
assert.match(backup, /role="dialog" aria-modal="true"/);
assert.match(backup, /minLength="12"/);
assert.match(backup, /lifeos-input/);
console.log('APP SHELL AND RECOVERY SCREEN: source, render, export, and clipboard safety assertions passed with synthetic recovery data.');
