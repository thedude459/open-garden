#!/usr/bin/env node
// Whole-codebase coverage by Nx project, as a Markdown table (stdout and, in
// GitHub Actions, the job summary).
//
//   node scripts/ci/coverage-summary.js                     unit tests only
//   node scripts/ci/coverage-summary.js --e2e <file>        add live-test coverage
//   node scripts/ci/coverage-summary.js --check <floors>    fail if an area dropped
//   node scripts/ci/coverage-summary.js --write <floors>    record today's numbers
//
// Unit coverage comes from coverage/all/coverage-final.json (Vitest). Live-test
// coverage (--e2e) is the API's V8 coverage from scripts/ci/e2e.sh. The two use
// different statement maps, so they are combined line by line: Vitest's
// executable lines are the denominator, and a line counts as covered when either
// run executed it.
'use strict';

const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');

function areaOf(file, root) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const match = rel.match(/^(apps|libs)\/[^/]+/);
  return match ? match[0] : 'other';
}

/** Lines Vitest considers executable, and which of them ran (unit and combined). */
function tally(unitJson, e2eJson, root) {
  const unit = libCoverage.createCoverageMap(unitJson);
  const e2e = e2eJson ? libCoverage.createCoverageMap(e2eJson) : null;
  const e2eFiles = new Set(e2e ? e2e.files() : []);
  const areas = new Map();
  for (const file of unit.files()) {
    const unitLines = unit.fileCoverageFor(file).getLineCoverage();
    const liveLines = e2eFiles.has(file) ? e2e.fileCoverageFor(file).getLineCoverage() : {};
    const entry = areas.get(areaOf(file, root)) ?? { total: 0, unit: 0, combined: 0 };
    for (const [line, hits] of Object.entries(unitLines)) {
      entry.total += 1;
      if (hits > 0) entry.unit += 1;
      if (hits > 0 || (liveLines[line] ?? 0) > 0) entry.combined += 1;
    }
    areas.set(areaOf(file, root), entry);
  }
  return areas;
}

const pct = (covered, total) => (total === 0 ? 100 : (100 * covered) / total);
const fmt = (covered, total) => (total === 0 ? '—' : `${Math.floor(pct(covered, total))}%`);

function markdown(areas, withLive) {
  const rows = [...areas.entries()].sort((a, b) => b[1].total - a[1].total);
  const sum = rows.reduce(
    (acc, [, v]) => ({
      total: acc.total + v.total,
      unit: acc.unit + v.unit,
      combined: acc.combined + v.combined,
    }),
    { total: 0, unit: 0, combined: 0 },
  );
  const head = withLive
    ? ['| Area | Lines | Unit tests | Unit + live tests |', '|---|---|---|---|']
    : ['| Area | Lines | Covered |', '|---|---|---|'];
  const line = ([area, v]) =>
    withLive
      ? `| \`${area}\` | ${v.total} | ${fmt(v.unit, v.total)} | ${fmt(v.combined, v.total)} |`
      : `| \`${area}\` | ${v.total} | ${fmt(v.unit, v.total)} |`;
  const headline = withLive
    ? `**Unit tests: ${fmt(sum.unit, sum.total)} · unit + live tests: ${fmt(sum.combined, sum.total)} of ${sum.total} lines.** Live tests are the API process during the live HTTP and Playwright suites; the web app's browser code is not measured yet.`
    : `**${fmt(sum.unit, sum.total)} of ${sum.total} lines.** The 80% gate covers the domain libraries only; this table shows everything.`;
  return [
    '### Whole-codebase coverage (report only)',
    '',
    headline,
    '',
    ...head,
    ...rows.map(line),
    '',
  ].join('\n');
}

/** Ratchet: every area's unit coverage must stay at or above its recorded floor. */
function check(areas, floors) {
  const problems = [];
  for (const [area, floor] of Object.entries(floors)) {
    const v = areas.get(area);
    if (!v) continue;
    const now = pct(v.unit, v.total);
    if (now + 1e-9 < floor)
      problems.push(`${area}: ${now.toFixed(1)}% is below its floor of ${floor}%`);
  }
  return problems;
}

function floorsFrom(areas) {
  const floors = {};
  for (const [area, v] of [...areas.entries()].sort())
    floors[area] = Math.floor(pct(v.unit, v.total));
  return floors;
}

function selfcheck() {
  const root = '/r';
  const statement = (line) => ({ start: { line, column: 0 }, end: { line, column: 5 } });
  const fileCov = (file, hits) => ({
    path: file,
    statementMap: Object.fromEntries(hits.map((_, i) => [String(i), statement(i + 1)])),
    s: Object.fromEntries(hits.map((h, i) => [String(i), h])),
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  });
  const unit = {
    '/r/libs/a/src/x.ts': fileCov('/r/libs/a/src/x.ts', [1, 1, 0, 0]),
    '/r/apps/api/src/y.ts': fileCov('/r/apps/api/src/y.ts', [0, 0]),
  };
  const live = { '/r/apps/api/src/y.ts': fileCov('/r/apps/api/src/y.ts', [3, 0]) };
  const areas = tally(unit, live, root);
  const api = areas.get('apps/api');
  const a = areas.get('libs/a');
  const ok =
    a.total === 4 &&
    a.unit === 2 &&
    a.combined === 2 &&
    api.total === 2 &&
    api.unit === 0 &&
    api.combined === 1 &&
    markdown(areas, true).includes('| `apps/api` | 2 | 0% | 50% |') &&
    check(areas, { 'libs/a': 50 }).length === 0 &&
    check(areas, { 'libs/a': 51 }).length === 1 &&
    floorsFrom(areas)['libs/a'] === 50;
  if (!ok) {
    console.error('coverage-summary selfcheck failed', JSON.stringify([...areas]));
    process.exit(1);
  }
  console.log('coverage-summary selfcheck ok');
}

function main(argv) {
  if (argv[0] === 'selfcheck') return selfcheck();
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const root = process.cwd();
  const unitJson = JSON.parse(
    fs.readFileSync(path.join(root, 'coverage/all/coverage-final.json'), 'utf8'),
  );
  const e2ePath = opt('--e2e');
  const e2eJson =
    e2ePath && fs.existsSync(e2ePath) ? JSON.parse(fs.readFileSync(e2ePath, 'utf8')) : null;
  const areas = tally(unitJson, e2eJson, root);

  const text = markdown(areas, Boolean(e2eJson));
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);

  const writePath = opt('--write');
  if (writePath) {
    fs.writeFileSync(writePath, JSON.stringify(floorsFrom(areas), null, 2) + '\n');
    console.log(`Wrote coverage floors to ${writePath}`);
  }
  const checkPath = opt('--check');
  if (checkPath) {
    const problems = check(areas, JSON.parse(fs.readFileSync(checkPath, 'utf8')));
    if (problems.length) {
      console.error('Coverage dropped below the recorded floor:');
      for (const p of problems) console.error(`  ${p}`);
      console.error(`Add tests, or (if the drop is intended) lower the floor in ${checkPath}.`);
      process.exit(1);
    }
    console.log('Coverage is at or above every recorded floor.');
  }
}

main(process.argv.slice(2));
