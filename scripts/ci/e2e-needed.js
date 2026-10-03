#!/usr/bin/env node
// Whether CI should run the browser suite. App changes and production
// dependency bumps run it. Lockfile, devDependency, and workflow-pin diffs do not.
'use strict';

const fs = require('fs');

const EXACT = new Set(['package.json', 'package-lock.json', '.github/dependabot.yml']);

function allowed(path) {
  if (EXACT.has(path)) return true;
  return path.startsWith('.github/workflows/') || path.startsWith('.github/actions/');
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
