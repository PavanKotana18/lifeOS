/**
 * LifeOS Sentinel — Unified Autonomous QA Test Runner
 * Executes all mandatory Sentinel verification suites and strictly enforces exit codes:
 * - PASS (all suites completed successfully): process.exit(0)
 * - FAIL (one or more test assertions failed): process.exit(1)
 * - BLOCKED (mandatory dependencies or runtime missing): process.exit(1)
 *
 * Never swallows exceptions or converts BLOCKED into PASS.
 */

const { runDatabaseIntegrityTests } = require('./database/database_integrity_tests.js');
const { runAndroidResilienceTests } = require('./resilience/android_resilience_tests.js');
const { runSecurityTests } = require('./security/security_tests.js');
const { runDomainTests } = require('./unit_integration/domain_tests.js');
const { runCryptoRegressionTests } = require('./security/crypto_regression_tests.js');
const { runSafRegressionTests } = require('./security/saf_regression_tests.js');

async function runAllSentinelSuites() {
  console.log('===============================================================');
  console.log('  LIFEOS SENTINEL — AUTONOMOUS VERIFICATION & QA RUNNER        ');
  console.log('===============================================================\n');

  const suites = [
    { id: 'DB_INTEGRITY', name: 'Real Dexie Database Integrity Suite', fn: runDatabaseIntegrityTests, mandatory: true },
    { id: 'AND_RESILIENCE', name: 'Android Lifecycle & Resilience Suite', fn: runAndroidResilienceTests, mandatory: true },
    { id: 'APP_SECURITY', name: 'Application Security & Manifest Audit Suite', fn: runSecurityTests, mandatory: true },
    { id: 'DOMAIN_LOGIC', name: 'Domain Models & CSV Injection Defense Suite', fn: runDomainTests, mandatory: true },
    { id: 'CRYPTO_REGRESSION', name: 'Production Crypto & Backup Hardening Suite', fn: runCryptoRegressionTests, mandatory: true },
    { id: 'SAF_REGRESSION', name: 'Storage Access Framework Production Suite', fn: runSafRegressionTests, mandatory: true }
  ];

  const summary = {
    totalSuites: suites.length,
    passedSuites: 0,
    failedSuites: 0,
    blockedSuites: 0,
    results: []
  };

  for (const suite of suites) {
    try {
      const res = await suite.fn();

      if (!res || typeof res !== 'object') {
        throw new Error('Suite returned no valid result object');
      }

      if (res.status === 'BLOCKED') {
        summary.blockedSuites++;
        summary.results.push({
          id: suite.id, name: suite.name, status: 'BLOCKED',
          reason: res.reason || 'Mandatory dependency or runtime unavailable'
        });
        continue;
      }

      if (
        !Number.isInteger(res.total) || res.total <= 0 ||
        !Number.isInteger(res.passed) || res.passed < 0 ||
        !Number.isInteger(res.failed) || res.failed < 0 ||
        res.passed + res.failed !== res.total
      ) {
        throw new Error('Suite returned invalid or incomplete test counters');
      }

      if (res.failed > 0) {
        summary.failedSuites++;
        summary.results.push({
          id: suite.id, name: suite.name, status: 'FAIL',
          passed: res.passed, failed: res.failed, total: res.total
        });
      } else {
        summary.passedSuites++;
        summary.results.push({
          id: suite.id, name: suite.name, status: 'PASS',
          passed: res.passed, total: res.total
        });
      }
    } catch (err) {
      summary.failedSuites++;
      summary.results.push({ id: suite.id, name: suite.name, status: 'FAIL', error: err.message });
      console.error(`  ❌ SUITE ERROR: ${suite.name} encountered an unhandled exception: ${err.message}\n`);
    }
  }

  console.log('===============================================================');
  console.log('  SENTINEL EXECUTION SUMMARY                                   ');
  console.log('===============================================================');
  for (const r of summary.results) {
    const symbol = r.status === 'PASS' ? '✅' : (r.status === 'BLOCKED' ? '⚠️ ' : '❌');
    const extra = r.reason ? ` (${r.reason})` : (r.error ? ` (${r.error})` : '');
    console.log(`  ${symbol} ${r.status.padEnd(8)} : ${r.name}${extra}`);
  }
  console.log('---------------------------------------------------------------');
  console.log(`  Total Suites: ${summary.totalSuites} | Passed: ${summary.passedSuites} | Failed: ${summary.failedSuites} | Blocked: ${summary.blockedSuites}`);
  console.log('===============================================================\n');

  if (summary.failedSuites > 0) {
    console.error('CI GATE STATUS: FAILED — One or more mandatory suites reported failures.');
    process.exit(1);
  }

  if (summary.blockedSuites > 0) {
    console.error('CI GATE STATUS: FAILED — One or more mandatory suites are BLOCKED due to missing dependencies.');
    console.error('To resolve: Ensure "npm ci" completes successfully before running test:sentinel.');
    process.exit(1);
  }

  console.log('CI GATE STATUS: PASSED — All mandatory Sentinel suites verified successfully.');
  process.exit(0);
}

if (require.main === module) {
  runAllSentinelSuites().catch(err => {
    console.error('Fatal crash in Sentinel runner:', err);
    process.exit(1);
  });
}

module.exports = { runAllSentinelSuites };
