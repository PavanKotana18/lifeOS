'use strict';

// Read a bounded diagnostic stream, redact common direct identifiers and
// bearer-like values, then emit only the first 256 KiB.
const chunks = [];
let size = 0;
const limit = 256 * 1024;
process.stdin.on('data', chunk => {
  if (size >= limit) return;
  const kept = chunk.subarray(0, limit - size);
  chunks.push(kept);
  size += kept.length;
});
process.stdin.on('end', () => {
  const input = Buffer.concat(chunks).toString('utf8');
  const sanitized = input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{40,}\b/g, '[redacted-token]')
    .replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, '[redacted-number]');
  process.stdout.write(sanitized);
  if (size >= limit) process.stdout.write('\n[truncated at 262144 bytes]\n');
});
