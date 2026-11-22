#!/usr/bin/env node
// Checks .trivyignore (ADR 0041): every skipped vulnerability has a tracking
// issue and an expiry at most 30 days ahead, so an exception is deliberate,
// recorded, and runs out.
//
//   node scripts/ci/trivyignore-check.js check [file]   fails on a bad entry
//   node scripts/ci/trivyignore-check.js selfcheck
'use strict';

const fs = require('fs');

const MAX_DAYS = 30;
const ENTRY = /^(CVE-\d{4}-\d{4,}|GHSA(?:-[0-9a-z]{4}){3})\s+exp:(\d{4}-\d{2}-\d{2})$/;
const ISSUE = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/;

/** Problems with the file's entries, as messages; empty when it is fine. */
function problems(text, today) {
  const out = [];
  const limit = addDays(today, MAX_DAYS);
  let issueAbove = false;
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const where = `.trivyignore line ${index + 1}`;
    if (!line) return;
    if (line.startsWith('#')) {
      // A blank line between the issue comment and its entries is fine.
      if (ISSUE.test(line)) issueAbove = true;
      return;
    }
    const match = ENTRY.exec(line);
    if (!match) {
      out.push(`${where}: use "<CVE or GHSA id> exp:YYYY-MM-DD", got "${line}"`);
      return;
    }
    const expires = match[2];
    if (!issueAbove)
      out.push(`${where}: ${match[1]} needs a tracking issue URL in a comment above it`);
    if (Number.isNaN(Date.parse(`${expires}T00:00:00Z`))) {
      out.push(`${where}: ${expires} is not a date`);
    } else if (expires > limit) {
      out.push(
        `${where}: ${match[1]} expires ${expires}; at most ${MAX_DAYS} days ahead (${limit})`,
      );
    } else if (expires < today) {
      out.push(
        `${where}: ${match[1]} expired ${expires}; the scan checks it again, so remove the entry`,
      );
    }
  });
  return out;
}

function addDays(day, days) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function selfcheck() {
  const today = '2026-11-22';
  const assert = (ok, message) => {
    if (!ok) {
      console.error(`trivyignore selfcheck failed: ${message}`);
      process.exit(1);
    }
  };
  const issue = '# https://github.com/thedude459/open-garden/issues/1';
  assert(problems('# only comments\n', today).length === 0, 'comments only');
  assert(
    problems(`${issue}\nCVE-2026-113425 exp:2026-12-20\nCVE-2026-121810 exp:2026-12-22\n`, today)
      .length === 0,
    'two entries under one issue',
  );
  assert(
    problems('CVE-2026-113425 exp:2026-12-20\n', today)[0]?.includes('tracking issue'),
    'needs an issue',
  );
  assert(
    problems(`${issue}\nCVE-2026-113425 exp:2027-02-01\n`, today)[0]?.includes('at most 30 days'),
    'too far ahead',
  );
  assert(
    problems(`${issue}\nCVE-2026-113425 exp:2026-11-01\n`, today)[0]?.includes('expired'),
    'expired',
  );
  assert(problems(`${issue}\nCVE-2026-113425\n`, today)[0]?.includes('exp:'), 'no expiry');
  assert(problems(`${issue}\nGHSA-aaaa-bbbb-cccc exp:2026-12-01\n`, today).length === 0, 'GHSA id');
  console.log('trivyignore selfcheck ok');
}

function main() {
  const [command, file = '.trivyignore'] = process.argv.slice(2);
  if (command === 'selfcheck') return selfcheck();
  if (command !== 'check') {
    console.error('usage: trivyignore-check.js check [file] | selfcheck');
    process.exit(2);
  }
  const found = problems(fs.readFileSync(file, 'utf8'), new Date().toISOString().slice(0, 10));
  for (const p of found) console.error(p);
  if (found.length) process.exit(1);
  console.log('.trivyignore: every entry has a tracking issue and an expiry within 30 days.');
}

if (require.main === module) main();

module.exports = { problems };
