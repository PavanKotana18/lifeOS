const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const appearance = fs.readFileSync('src/appearance-init.ts', 'utf8');

assert(html.includes('http-equiv="Content-Security-Policy"'));
assert(html.includes("default-src 'self'"));
assert(html.includes("script-src 'self'"));
assert(html.includes("style-src 'self' 'unsafe-inline'"));
assert(html.includes("img-src 'self' data:"));
assert(html.includes("connect-src 'none'"));
assert(html.includes("object-src 'none'"));
assert(html.includes("base-uri 'self'"));
assert(html.includes("form-action 'self'"));
assert(!/<script>\s*[\s\S]*?<\/script>/i.test(html), 'Inline script remains in index.html');
assert(html.indexOf('Content-Security-Policy') < html.indexOf('/src/appearance-init.ts'));
assert(html.indexOf('/src/appearance-init.ts') < html.indexOf('/src/main.tsx'));
assert(appearance.includes("localStorage.getItem('lifeos-appearance')"));
assert(appearance.includes("window.matchMedia('(prefers-color-scheme: dark)')"));
assert(appearance.includes("document.documentElement.classList.toggle('dark'"));
assert(appearance.includes("document.documentElement.style.colorScheme"));

console.log('SEC-07 CSP regression tests: all passed');
