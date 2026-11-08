#!/usr/bin/env node
// Which expensive CI jobs a change needs.
//
// e2e (browser suite): app changes and production dependency bumps run it.
// Lockfile, devDependency, workflow-pin, documentation, and editor/formatter
// config diffs do not.
//
// images (build + scan): stricter. Only documentation and editor config skip
// it; lockfile, dependency, and workflow changes all reach the images.
//
// Build- and test-affecting files (.dockerignore, .gitignore, .nvmrc, scripts/)
// are deliberately not listed, so they always run both.
'use strict';

const fs = require('fs');

const DOC_EXACT = new Set([
  'LICENSE',
  '.editorconfig',
  '.prettierrc',
  '.prettierignore',
  '.github/zizmor.yml',
]);
const DOC_PREFIXES = ['docs/', '.vscode/', '.github/ISSUE_TEMPLATE/'];

/** Documentation and editor config: nothing in the app or images reads it. */
function docOnly(path) {
  if (DOC_EXACT.has(path)) return true;
  // No app code loads Markdown, so README, AGENTS.md, ADRs, and conventions are docs only.
  if (path.endsWith('.md')) return true;
  return DOC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

const E2E_SKIP_EXACT = new Set(['package.json', 'package-lock.json', '.github/dependabot.yml']);
const E2E_SKIP_PREFIXES = ['.github/workflows/', '.github/actions/'];

function allowed(path) {
  if (docOnly(path) || E2E_SKIP_EXACT.has(path)) return true;
  return E2E_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function needsImages(files) {
  return files.length === 0 || files.some((file) => !docOnly(file));
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
    [
      false,
      ['apps/web-e2e/CONVENTION.md', '.vscode/extensions.json', '.prettierrc', '.editorconfig'],
    ],
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
  const imageCases = [
    [false, ['README.md', 'docs/deploy.md', 'LICENSE', '.github/ISSUE_TEMPLATE/bug.yml']],
    [false, ['.vscode/extensions.json', '.github/zizmor.yml', 'CODE_OF_CONDUCT.md']],
    [true, ['package-lock.json']],
    [true, ['package.json']],
    [true, ['.github/workflows/ci.yml']],
    [true, ['Dockerfile.api']],
    [true, ['README.md', 'apps/web/src/main.ts']],
    [true, []],
  ];
  for (const [expected, files] of imageCases) {
    if (needsImages(files) !== expected) {
      console.error('images selfcheck failed', files);
      process.exit(1);
    }
  }
  console.log('e2e-needed selfcheck ok');
}

function decide(filesPath, basePath, headPath) {
  const files = fs
    .readFileSync(filesPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const base = fs.readFileSync(basePath, 'utf8');
  const head = fs.readFileSync(headPath, 'utf8');
  console.log(needsE2e(files, base, head) ? 'run' : 'skip');
}

function decideImages(filesPath) {
  const files = fs
    .readFileSync(filesPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  console.log(needsImages(files) ? 'run' : 'skip');
}

if (process.argv[2] === 'selfcheck') {
  selfcheck();
} else if (process.argv[2] === 'decide') {
  decide(process.argv[3], process.argv[4], process.argv[5]);
} else if (process.argv[2] === 'decide-images') {
  decideImages(process.argv[3]);
} else {
  console.error(
    'usage: e2e-needed.js selfcheck | decide <files> <base-package.json> <head-package.json> | decide-images <files>',
  );
  process.exit(2);
}
