#!/usr/bin/env node
// Extract HIGH/CRITICAL finding IDs from npm audit / Trivy / OSV JSON and
// diff head vs an optional base (empty base = hard gate, used on main).
'use strict';

const fs = require('fs');

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function isHigh(sev) {
  const s = String(sev || '').toLowerCase();
  return s === 'high' || s === 'critical';
}

function ghsaFromUrl(url) {
  const m = String(url || '').match(/GHSA-[0-9a-z-]+/i);
  return m ? m[0].toLowerCase() : '';
}

function extractAudit(data) {
  const ids = new Set();
  for (const v of Object.values(data.vulnerabilities || {})) {
    for (const via of v.via || []) {
      if (!via || typeof via !== 'object') continue;
      if (!isHigh(via.severity || v.severity)) continue;
      const id = ghsaFromUrl(via.url);
      if (id) ids.add(id);
    }
  }
  return [...ids].sort();
}

function extractTrivy(data) {
  const ids = new Set();
  for (const result of data.Results || []) {
    for (const vuln of result.Vulnerabilities || []) {
      if (!isHigh(vuln.Severity)) continue;
      const id = String(vuln.VulnerabilityID || '').toLowerCase();
      if (id) ids.add(id);
    }
  }
  return [...ids].sort();
}

function extractOsv(data) {
  const ids = new Set();
  for (const result of data.results || []) {
    for (const pkg of result.packages || []) {
      for (const vuln of pkg.vulnerabilities || []) {
        const id = String(vuln.id || '').toLowerCase();
        if (id) ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

function diff(head, base) {
  const have = new Set(base);
  return head.filter((id) => !have.has(id));
}

function extractors() {
  return { audit: extractAudit, trivy: extractTrivy, osv: extractOsv };
}

function parseGateArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key || !key.startsWith('--') || val === undefined) {
      throw new Error(`usage: sca-ids.js gate --audit-head FILE [--audit-base FILE] ...`);
    }
    out[key.slice(2)] = val;
  }
  return out;
}

function gate(args) {
  const kinds = ['audit', 'trivy', 'osv'];
  const extract = extractors();
  let failed = false;
  for (const kind of kinds) {
    const headPath = args[`${kind}-head`];
    if (!headPath) throw new Error(`missing --${kind}-head`);
    const head = extract[kind](loadJson(headPath));
    const basePath = args[`${kind}-base`];
    const base = basePath ? extract[kind](loadJson(basePath)) : [];
    const added = diff(head, base);
    const mode = basePath ? 'vs base' : 'absolute';
    console.log(`sca ${kind} (${mode}): head=${head.length} base=${base.length} new=${added.length}`);
    if (added.length) {
      failed = true;
      console.error(`new ${kind} findings:\n${added.join('\n')}`);
    }
  }
  if (failed) process.exit(1);
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`${label}: expected ${e}, got ${a}`);
    process.exit(1);
  }
}

function selfcheck() {
  const audit = extractAudit({
    vulnerabilities: {
      multer: {
        severity: 'high',
        via: [
          {
            severity: 'high',
            url: 'https://github.com/advisories/GHSA-wc9g-mqfw-jrwm',
          },
          'nestjs',
        ],
      },
      hono: {
        severity: 'moderate',
        via: [
          {
            severity: 'moderate',
            url: 'https://github.com/advisories/GHSA-gqvv-2mrq-wpjv',
          },
        ],
      },
    },
  });
  assertEqual(audit, ['ghsa-wc9g-mqfw-jrwm'], 'extractAudit');

  const trivy = extractTrivy({
    Results: [
      {
        Vulnerabilities: [
          { VulnerabilityID: 'CVE-2026-1', Severity: 'HIGH' },
          { VulnerabilityID: 'CVE-2026-2', Severity: 'MEDIUM' },
          { VulnerabilityID: 'GHSA-aaaa-bbbb-cccc', Severity: 'CRITICAL' },
        ],
      },
    ],
  });
  assertEqual(trivy, ['cve-2026-1', 'ghsa-aaaa-bbbb-cccc'], 'extractTrivy');

  const osv = extractOsv({
    results: [
      {
        packages: [
          { vulnerabilities: [{ id: 'GHSA-1111-2222-3333' }, { id: 'CVE-2026-9' }] },
        ],
      },
    ],
  });
  assertEqual(osv, ['cve-2026-9', 'ghsa-1111-2222-3333'], 'extractOsv');

  assertEqual(diff(['a', 'b'], ['a']), ['b'], 'diff new');
  assertEqual(diff(['a'], ['a', 'b']), [], 'diff subset');
  assertEqual(diff(['a'], []), ['a'], 'diff no base');
  console.log('sca-ids selfcheck ok');
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'selfcheck' || cmd === '--selfcheck') {
  selfcheck();
} else if (cmd === 'gate') {
  gate(parseGateArgs(rest));
} else {
  console.error('usage: sca-ids.js selfcheck | gate --audit-head FILE ...');
  process.exit(2);
}
