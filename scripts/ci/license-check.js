#!/usr/bin/env node
// Fail when a production dependency (anything shipped in the images) uses a
// license outside the allow-list. Open Garden is AGPL-3.0-or-later; these
// licenses can all be combined with it. Development-only packages are skipped.
// Run after `npm ci` so packages missing a license in the lockfile can be read
// from node_modules (older packages use a `licenses` array the lockfile omits).
'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'LGPL-3.0-or-later',
  'GPL-3.0-or-later',
  'AGPL-3.0-or-later',
]);

function licenseOf(meta) {
  if (typeof meta.license === 'string') return meta.license;
  if (meta.license && typeof meta.license.type === 'string') return meta.license.type;
  if (Array.isArray(meta.licenses) && meta.licenses.length) {
    return meta.licenses.map((l) => (typeof l === 'string' ? l : l.type)).join(' OR ');
  }
  return null;
}

/** An SPDX expression is acceptable when one side of every OR is allowed and every AND part is. */
function allowed(expression) {
  const clean = expression.replace(/[()]/g, ' ').trim();
  return clean
    .split(/\s+OR\s+/i)
    .some((alt) => alt.split(/\s+AND\s+/i).every((part) => ALLOWED.has(part.trim())));
}

function check(lock, readInstalled) {
  const problems = [];
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (!key || entry.dev) continue;
    const name = key.replace(/^.*node_modules\//, '');
    const license = licenseOf(entry) ?? licenseOf(readInstalled(key) ?? {});
    if (!license) problems.push(`${name}@${entry.version}: no license found`);
    else if (!allowed(license)) problems.push(`${name}@${entry.version}: ${license}`);
  }
  return problems;
}

function selfcheck() {
  const lock = {
    packages: {
      '': { license: 'AGPL-3.0-or-later' },
      'node_modules/a': { version: '1.0.0', license: 'MIT' },
      'node_modules/b': { version: '1.0.0', license: '(MIT OR GPL-2.0-only)' },
      'node_modules/c': { version: '1.0.0' },
      'node_modules/d': { version: '1.0.0', license: 'SSPL-1.0' },
      'node_modules/e': { version: '1.0.0', license: 'BUSL-1.1', dev: true },
    },
  };
  const installed = { 'node_modules/c': { licenses: [{ type: 'MIT' }] } };
  const problems = check(lock, (key) => installed[key]);
  if (problems.length !== 1 || !problems[0].startsWith('d@1.0.0: SSPL-1.0')) {
    console.error('license-check selfcheck failed', problems);
    process.exit(1);
  }
  console.log('license-check selfcheck ok');
}

if (process.argv[2] === 'selfcheck') {
  selfcheck();
} else {
  const root = process.cwd();
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const readInstalled = (key) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, key, 'package.json'), 'utf8'));
    } catch {
      return null;
    }
  };
  const problems = check(lock, readInstalled);
  if (problems.length) {
    console.error('Production dependencies with licenses outside the allow-list:');
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      'Add the license to ALLOWED in scripts/ci/license-check.js only if it is compatible with AGPL-3.0-or-later.',
    );
    process.exit(1);
  }
  console.log('All production dependency licenses are on the allow-list.');
}
