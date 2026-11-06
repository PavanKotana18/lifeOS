'use strict';
// A known-defect allowance covers acceptance assertions only, never exceptions,
// missing dependencies, zero assertions, malformed reports or fixture failures.
function classify({ known, completed, assertions, error }) {
  if (!Number.isInteger(assertions) || assertions <= 0 || (!completed && !error)) return 'HARNESS_FAILURE';
  if (error) return known && error.code === 'WP0_CONTRACT_FAILURE' ? 'KNOWN_DEFECT' : 'HARNESS_FAILURE';
  return known ? 'UNEXPECTED_PASS' : 'PASS';
}
function failsGate(status, strict = false) {
  return status === 'HARNESS_FAILURE' || status === 'UNEXPECTED_PASS'
    || (strict && (status === 'KNOWN_DEFECT' || status === 'BLOCKED'));
}
module.exports = { classify, failsGate };
