#!/usr/bin/env node
// Release notes from CHANGELOG.md (CONTRIBUTING.md, "Releasing").
//
// Every pull request adds a line to the Unreleased entry, under one of the
// SECTIONS below. A release renames that entry to its version, and the
// Release workflow publishes it in the layout of The Good Docs Project's
// release notes template: the GitHub Release's title is the version, and the
// notes start with the summary, then one section per heading, each saying
// "None" when empty.
//
//   node scripts/ci/release-notes.js check                  the file is well formed
//   node scripts/ci/release-notes.js cut 0.2.0 2026-11-18   Unreleased becomes v0.2.0
//   node scripts/ci/release-notes.js notes 0.2.0            the release's notes, to stdout
//   node scripts/ci/release-notes.js advisories 0.2.0 FILE  every published advisory
//       fixed in 0.2.0 (FILE: the JSON from GET /repos/{repo}/security-advisories)
//       is named in its Security section
//   node scripts/ci/release-notes.js selfcheck
'use strict';

const fs = require('fs');
const path = require('path');

const PRODUCT = 'Open Garden';
const REPO_URL = 'https://github.com/thedude459/open-garden';
const SECTIONS = [
  'Summary',
  'New features',
  'Improvements',
  'Bug fixes',
  'Security',
  'Known issues',
  'Deprecated features',
];
/** What an empty section says in the published notes. */
const EMPTY = {
  Summary: null,
  'New features': 'None in this release.',
  Improvements: 'None in this release.',
  'Bug fixes': 'None in this release.',
  Security:
    `No publicly known vulnerabilities in ${PRODUCT}'s own code (with a CVE or GitHub ` +
    'security advisory) were fixed in this release. Vulnerabilities in dependencies are ' +
    'tracked by Dependabot and the weekly OSV-Scanner scan, not listed here.',
  'Known issues': 'None known.',
  'Deprecated features': 'None.',
};
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The file's entries: Unreleased and each version, newest first. */
function parse(text) {
  const entries = [];
  const parts = text.split(/^## /m).slice(1);
  for (const part of parts) {
    const [headingLine, ...rest] = part.split('\n');
    const heading = headingLine.trim();
    const body = rest.join('\n');
    const match = /^v(\S+) \((\d{4}-\d{2}-\d{2})\)$/.exec(heading);
    const entry = {
      heading,
      version: heading === 'Unreleased' ? null : match ? match[1] : undefined,
      date: match ? match[2] : null,
      sections: {},
      unknown: [],
    };
    for (const block of body.split(/^### /m).slice(1)) {
      const [name, ...lines] = block.split('\n');
      const title = name.trim();
      if (!SECTIONS.includes(title)) entry.unknown.push(title);
      entry.sections[title] = lines.join('\n').trim();
    }
    entries.push(entry);
  }
  return entries;
}

/** Problems that make the file unusable for release notes. */
function problems(text) {
  const out = [];
  const entries = parse(text);
  if (!entries.some((e) => e.heading === 'Unreleased')) out.push('No "## Unreleased" entry.');
  for (const e of entries) {
    if (e.version === undefined) {
      out.push(`"## ${e.heading}": use "## Unreleased" or "## v1.2.3 (YYYY-MM-DD)".`);
    }
    for (const name of e.unknown) {
      out.push(`"## ${e.heading}" has "### ${name}"; use one of: ${SECTIONS.join(', ')}.`);
    }
  }
  return out;
}

/** An empty Unreleased entry, every heading with a hint for contributors. */
function emptyEntry() {
  return ['## Unreleased', '', ...SECTIONS.flatMap((name) => [`### ${name}`, '', ''])].join('\n');
}

/** Unreleased renamed to the version and date, with a new empty Unreleased above. */
function cut(text, version, date) {
  if (!VERSION.test(version)) throw new Error(`Version must look like 1.2.3, got ${version}`);
  if (parse(text).some((e) => e.version === version)) {
    throw new Error(`CHANGELOG.md already has v${version}`);
  }
  if (!/^## Unreleased$/m.test(text)) throw new Error('No "## Unreleased" entry to cut.');
  return text.replace(/^## Unreleased$/m, `${emptyEntry().trimEnd()}\n\n## v${version} (${date})`);
}

/** The published release notes for one version. */
function notes(text, version) {
  const entries = parse(text);
  const entry = entries.find((e) => e.version === version);
  if (!entry) throw new Error(`CHANGELOG.md has no "## v${version} (YYYY-MM-DD)" entry`);
  if (!entry.sections.Summary) throw new Error(`v${version} needs a Summary`);
  // Entries run newest first, so the previous release is the next one down.
  const previous = entries.slice(entries.indexOf(entry) + 1).find((e) => e.version) ?? null;
  const out = ['## Summary', '', entry.sections.Summary];
  for (const name of SECTIONS.slice(1)) {
    out.push('', `## ${name}`, '', entry.sections[name] || EMPTY[name]);
  }
  out.push(
    '',
    '---',
    '',
    `Install or upgrade: download this release's \`compose.yaml\` and run ` +
      '`docker compose up -d` ([README](' +
      `${REPO_URL}#install-with-docker)); back up first ([docs/deploy.md](` +
      `${REPO_URL}/blob/main/docs/deploy.md#backups)).`,
  );
  if (previous) {
    out.push('', `Full list of changes: ${REPO_URL}/compare/v${previous.version}...v${version}`);
  }
  return `${out.join('\n')}\n`;
}

/**
 * Advisories fixed in this version that the notes leave out. A published
 * GitHub security advisory for this repository whose patched versions name
 * the release must have its GHSA or CVE id in the Security section.
 */
function missingAdvisories(text, version, advisories) {
  const entry = parse(text).find((e) => e.version === version);
  const security = entry?.sections.Security ?? '';
  const missing = [];
  for (const advisory of advisories) {
    const fixedHere = (advisory.vulnerabilities ?? []).some((v) =>
      String(v.patched_versions ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^v/, ''))
        .includes(version),
    );
    if (!fixedHere) continue;
    const ids = [advisory.ghsa_id, advisory.cve_id].filter(Boolean);
    if (!ids.some((id) => security.includes(id))) missing.push(ids.join(' / '));
  }
  return missing;
}

function selfcheck() {
  const sample = [
    '# Changelog',
    '',
    emptyEntry(),
    '## v0.1.0 (2026-11-08)',
    '',
    '### Summary',
    '',
    'First release.',
    '',
  ].join('\n');
  const assert = (ok, message) => {
    if (!ok) {
      console.error(`release-notes selfcheck failed: ${message}`);
      process.exit(1);
    }
  };
  assert(problems(sample).length === 0, `clean sample: ${problems(sample)}`);
  assert(
    problems(sample.replace('### Bug fixes', '### Fixes'))[0]?.includes('### Fixes'),
    'unknown heading',
  );
  let text = sample.replace('### Summary\n\n\n', '### Summary\n\nHarvests and accounts.\n\n');
  text = text.replace(
    '### Security\n\n\n',
    '### Security\n\n- Fixed GHSA-aaaa-bbbb-cccc (CVE-2026-1).\n\n',
  );
  const released = cut(text, '0.2.0', '2026-11-18');
  assert(/^## Unreleased$/m.test(released) && released.includes('## v0.2.0 (2026-11-18)'), 'cut');
  let threw = false;
  try {
    cut(released, '0.2.0', '2026-11-19');
  } catch {
    threw = true;
  }
  assert(threw, 'cutting a version twice is refused');
  const out = notes(released, '0.2.0');
  assert(
    out.startsWith('## Summary\n\nHarvests and accounts.\n'),
    `starts with the summary: ${out}`,
  );
  assert(!out.includes('release notes'), 'no title or notes version');
  assert(out.includes('## New features\n\nNone in this release.'), 'empty section');
  assert(out.includes('GHSA-aaaa-bbbb-cccc'), 'security line');
  assert(out.includes('compare/v0.1.0...v0.2.0'), `compare link: ${out}`);
  const advisory = (id, patched) => ({
    ghsa_id: id,
    cve_id: null,
    vulnerabilities: [{ patched_versions: patched }],
  });
  assert(
    missingAdvisories(released, '0.2.0', [advisory('GHSA-aaaa-bbbb-cccc', '0.2.0')]).length === 0,
    'named advisory',
  );
  assert(
    missingAdvisories(released, '0.2.0', [
      advisory('GHSA-zzzz-zzzz-zzzz', '0.1.1, 0.2.0'),
      advisory('GHSA-yyyy-yyyy-yyyy', '0.3.0'),
    ]).join() === 'GHSA-zzzz-zzzz-zzzz',
    'missing advisory',
  );
  console.log('release-notes selfcheck ok');
}

function main() {
  const [command, version, extra] = process.argv.slice(2);
  if (command === 'selfcheck') return selfcheck();
  const file = path.join(process.cwd(), 'CHANGELOG.md');
  const text = fs.readFileSync(file, 'utf8');
  if (command === 'check') {
    const found = problems(text);
    if (found.length) {
      for (const p of found) console.error(p);
      process.exit(1);
    }
    console.log('CHANGELOG.md is well formed.');
  } else if (command === 'cut') {
    fs.writeFileSync(file, cut(text, version, extra));
    console.log(`CHANGELOG.md: Unreleased is now v${version} (${extra}).`);
  } else if (command === 'notes') {
    process.stdout.write(notes(text, version));
  } else if (command === 'advisories') {
    const missing = missingAdvisories(text, version, JSON.parse(fs.readFileSync(extra, 'utf8')));
    if (missing.length) {
      console.error(
        `Published security advisories fixed in v${version} are missing from its Security ` +
          `section in CHANGELOG.md: ${missing.join(', ')}`,
      );
      process.exit(1);
    }
    console.log(`Every published advisory fixed in v${version} is in its notes.`);
  } else {
    console.error(
      'Usage: release-notes.js check | cut VERSION DATE | notes VERSION | advisories VERSION FILE | selfcheck',
    );
    process.exit(2);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

module.exports = { SECTIONS, parse, problems, cut, notes, missingAdvisories };
