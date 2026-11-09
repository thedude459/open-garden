#!/usr/bin/env node
// Convert the API's V8 coverage from an e2e run (NODE_V8_COVERAGE) into an
// Istanbul coverage map for the TypeScript sources, using the bundle's source
// maps. Writes coverage/e2e/coverage-final.json.
//
// usage: node scripts/ci/coverage-e2e.mjs [v8-dir] [out-file]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import v8toIstanbul from 'v8-to-istanbul';

const root = process.cwd();
const v8Dir = path.resolve(process.argv[2] ?? 'coverage/e2e/v8');
const outFile = path.resolve(process.argv[3] ?? 'coverage/e2e/coverage-final.json');

/** Only our own TypeScript sources count; bundled npm packages do not. */
export function isProjectSource(file, base = root) {
  const rel = path.relative(base, file).split(path.sep).join('/');
  return /^(apps|libs)\/[^/]+\/src\/.+\.ts$/.test(rel) && !rel.endsWith('.spec.ts');
}

async function convert() {
  const map = libCoverage.createCoverageMap({});
  const files = fs.existsSync(v8Dir)
    ? fs.readdirSync(v8Dir).filter((f) => f.endsWith('.json'))
    : [];
  if (files.length === 0) throw new Error(`No V8 coverage files in ${v8Dir}`);
  for (const name of files) {
    const { result } = JSON.parse(fs.readFileSync(path.join(v8Dir, name), 'utf8'));
    for (const script of result) {
      if (!script.url.startsWith('file://')) continue;
      const scriptPath = fileURLToPath(script.url);
      // The API runs from dist/api-runtime/*.js with source maps next to it.
      if (!scriptPath.includes(`${path.sep}dist${path.sep}api-runtime${path.sep}`)) continue;
      // Convert the whole bundle, then keep only project sources. (v8-to-istanbul's
      // own excludePath callback drops function ranges for source-mapped bundles,
      // which reports every line as covered.)
      const converter = v8toIstanbul(scriptPath, 0);
      await converter.load();
      converter.applyCoverage(script.functions);
      const converted = converter.toIstanbul();
      for (const [file, data] of Object.entries(converted)) {
        if (isProjectSource(file)) map.merge({ [file]: data });
      }
      converter.destroy();
    }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(map.toJSON()));
  const totals = map.getCoverageSummary().toJSON().lines;
  console.log(
    `e2e API coverage: ${totals.pct}% of ${totals.total} lines in ${map.files().length} files -> ${path.relative(root, outFile)}`,
  );
}

function selfcheck() {
  const base = '/r';
  const cases = [
    [true, '/r/apps/api/src/main.ts'],
    [true, '/r/libs/auth/src/lib/auth-service.ts'],
    [false, '/r/libs/auth/src/lib/auth-service.spec.ts'],
    [false, '/r/node_modules/@nestjs/core/index.js'],
    [false, '/r/apps/api-e2e/README.md'],
  ];
  for (const [expected, file] of cases) {
    if (isProjectSource(file, base) !== expected) {
      console.error('coverage-e2e selfcheck failed', file);
      process.exit(1);
    }
  }
  console.log('coverage-e2e selfcheck ok');
}

if (process.argv[2] === 'selfcheck') selfcheck();
else await convert();
