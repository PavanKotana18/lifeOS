'use strict';

const fs = require('node:fs');
const path = require('node:path');

const cliPackage = require.resolve('@capacitor/cli/package.json');
const templateFile = path.join(
  path.dirname(cliPackage),
  'dist',
  'util',
  'template.js'
);

if (!fs.existsSync(templateFile)) {
  throw new Error('Capacitor template.js not found. Patch aborted.');
}

const source = fs.readFileSync(templateFile, 'utf8');

if (source.includes('tar_1.extract(')) {
  console.log('Capacitor tar compatibility patch already applied.');
} else if (source.includes('tar_1.default.extract(')) {
  fs.writeFileSync(
    templateFile,
    source.replace('tar_1.default.extract(', 'tar_1.extract(')
  );
  console.log('Capacitor tar compatibility patch applied.');
} else {
  throw new Error('Unexpected Capacitor CLI source. Patch aborted safely.');
}
