#!/usr/bin/env node
// Summarize coverage/all/coverage-summary.json by Nx project as a Markdown table.
// Prints to stdout and, in GitHub Actions, appends to the job summary.
'use strict';

const fs = require('fs');
const path = require('path');

function summarize(summary, root) {
  const areas = new Map();
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') continue;
    const rel = path.relative(root, file);
    const match = rel.match(/^(apps|libs)\/[^/]+/);
    const area = match ? match[0] : 'other';
    const entry = areas.get(area) ?? { covered: 0, total: 0 };
    entry.covered += metrics.lines.covered;
    entry.total += metrics.lines.total;
    areas.set(area, entry);
  }
  const pct = (c, t) => (t === 0 ? '—' : `${((100 * c) / t).toFixed(0)}%`);
  const rows = [...areas.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([area, { covered, total }]) => `| \`${area}\` | ${total} | ${pct(covered, total)} |`);
  const t = summary.total.lines;
  return [
    '### Whole-codebase coverage (report only)',
    '',
    `**${pct(t.covered, t.total)} of ${t.total} lines.** The 80% gate covers the domain libraries only; this table shows everything.`,
    '',
    '| Area | Lines | Covered |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function selfcheck() {
  const root = '/r';
  const sample = {
    total: { lines: { covered: 3, total: 4 } },
    '/r/libs/a/src/x.ts': { lines: { covered: 2, total: 2 } },
    '/r/apps/web/src/y.ts': { lines: { covered: 1, total: 2 } },
  };
  const out = summarize(sample, root);
  const ok =
    out.includes('**75% of 4 lines.**') &&
    out.includes('| `libs/a` | 2 | 100% |') &&
    out.includes('| `apps/web` | 2 | 50% |');
  if (!ok) {
    console.error('coverage-summary selfcheck failed\n' + out);
    process.exit(1);
  }
  console.log('coverage-summary selfcheck ok');
}

if (process.argv[2] === 'selfcheck') {
  selfcheck();
} else {
  const root = process.cwd();
  const file = path.join(root, 'coverage/all/coverage-summary.json');
  const markdown = summarize(JSON.parse(fs.readFileSync(file, 'utf8')), root);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
