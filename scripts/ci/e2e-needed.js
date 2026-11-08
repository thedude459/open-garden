#!/usr/bin/env node
// Whether CI should run the browser suite. App changes and production
// dependency bumps run it. Lockfile, devDependency, workflow-pin,
// documentation, and editor/formatter config diffs do not.
// Build- and test-affecting files (.dockerignore, .gitignore, .nvmrc, .npmrc,
// scripts/) are deliberately not listed, so they still run the suite.
'use strict';

const fs = require('fs');

const EXACT = new Set([
  'package.json',
  'package-lock.json',
  '.github/dependabot.yml',
  'LICENSE',
  '.editorconfig',
  '.prettierrc',
  '.prettierignore',
]);

const PREFIXES = ['.github/workflows/', '.github/actions/', 'docs/', '.vscode/'];

function allowed(path) {
  if (EXACT.has(path)) return true;
  // No app code loads Markdown, so README, AGENTS.md, ADRs, and conventions are docs only.
  if (path.endsWith('.md')) return true;
  return PREFIXES.some((prefix) => path.startsWith(prefix));
}

function dependencyBlock(json) {
  const deps = JSON.parse(json).dependencies || {};
  return JSON.stringify(deps, Object.keys(deps).sort());
}

function needsE2e(files, basePackageJson, headPackageJson) {
  if (files.some((file) => !allowed(file))) return true;
  if (!files.includes('package.json')) return false;
  return dependencyBlock(basePackageJson) !== dependencyBlock(headPackageJson);
}

function selfcheck() {
  const base = JSON.stringify({ dependencies: { pg: '^8.0.0' }, devDependencies: { nx: '1' } });
  const devOnly = JSON.stringify({ dependencies: { pg: '^8.0.0' }, devDependencies: { nx: '2' } });
  const prod = JSON.stringify({ dependencies: { pg: '^9.0.0' }, devDependencies: { nx: '1' } });
  const cases = [
    [false, ['package-lock.json']],
    [false, ['.github/workflows/ci.yml']],
    [false, ['.github/actions/setup-node/action.yml', 'package.json'], base, devOnly],
    [true, ['apps/web/src/main.ts']],
    [true, ['package.json'], base, prod],
    [true, ['package.json', 'apps/api/src/main.ts'], base, devOnly],
    [false, []],
    // Documentation and editor config only.
    [false, ['README.md', 'AGENTS.md', 'docs/roadmap.md', 'docs/adr/0018-x.md', 'LICENSE']],
    [false, ['apps/web-e2e/CONVENTION.md', '.vscode/extensions.json', '.prettierrc', '.editorconfig']],
    // Docs alongside app code still run.
    [true, ['README.md', 'apps/web/src/app/app.component.ts']],
    // Build- and test-affecting config still runs.
    [true, ['.dockerignore']],
    [true, ['.gitignore']],
    [true, ['.nvmrc']],
    [true, ['scripts/ci/e2e.sh']],
    // A path that merely contains "docs" is not the docs folder.
    [true, ['apps/web/src/docs-page.ts']],
  ];
  for (const [expected, files, left = base, right = base] of cases) {
    if (needsE2e(files, left, right) !== expected) {
      console.error('e2e-needed selfcheck failed', files);
      process.exit(1);
    }
  }
  console.log('e2e-needed selfcheck ok');
}

function decide(filesPath, basePath, headPath) {
  const files = fs.readFileSync(filesPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  const base = fs.readFileSync(basePath, 'utf8');
  const head = fs.readFileSync(headPath, 'utf8');
  console.log(needsE2e(files, base, head) ? 'run' : 'skip');
}

if (process.argv[2] === 'selfcheck') {
  selfcheck();
} else if (process.argv[2] === 'decide') {
  decide(process.argv[3], process.argv[4], process.argv[5]);
} else {
  console.error('usage: e2e-needed.js selfcheck | decide <files> <base-package.json> <head-package.json>');
  process.exit(2);
}
