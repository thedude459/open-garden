/**
 * Run frontend toolchain via `node` (not nested `npm run`) so scripts stay fast
 * and subprocesses do not inherit invalid npm env vars such as `npm_config_devdir`.
 *
 * Note: `npm run <script>` still starts the npm CLI first; if your shell injects
 * `npm_config_devdir`, you may see one warning from that parent process. Use
 * `node ./scripts/run-frontend.mjs <task>` or `scripts/npm-without-devdir.sh`
 * when you need a completely clean run.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function cleanEnv() {
  const env = { ...process.env };
  delete env.npm_config_devdir;
  delete env.NPM_CONFIG_DEVDIR;
  return env;
}

function runNode(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: cleanEnv(),
    cwd: root,
  });
}

const paths = {
  tsc: join(root, 'node_modules/typescript/lib/tsc.js'),
  vite: join(root, 'node_modules/vite/bin/vite.js'),
  vitest: join(root, 'node_modules/vitest/vitest.mjs'),
  eslint: join(root, 'node_modules/eslint/bin/eslint.js'),
  stylelint: join(root, 'node_modules/stylelint/bin/stylelint.mjs'),
  playwright: join(root, 'node_modules/@playwright/test/cli.js'),
  markdownlint: join(root, 'node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs'),
};

const task = process.argv[2];
const rest = process.argv.slice(3);

if (!task) {
  console.error('Usage: node ./scripts/run-frontend.mjs <task> [args...]');
  process.exit(1);
}

function exitStatus(code) {
  process.exit(code ?? 1);
}

switch (task) {
  case 'typecheck': {
    const r = runNode(paths.tsc, ['--noEmit', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'build': {
    let r = runNode(paths.tsc, ['--noEmit']);
    if (r.status !== 0) exitStatus(r.status);
    r = runNode(paths.vite, ['build']);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'dev': {
    const r = runNode(paths.vite, ['--host', '0.0.0.0', '--port', '5173', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'preview': {
    const r = runNode(paths.vite, ['preview', '--host', '0.0.0.0', '--port', '4173', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:unit': {
    const r = runNode(paths.vitest, ['run', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:unit:watch': {
    const r = runNode(paths.vitest, [...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:unit:coverage': {
    const r = runNode(paths.vitest, ['run', '--coverage', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:ts': {
    const r = runNode(paths.eslint, ['src', '--ext', '.ts,.tsx', '--max-warnings=0', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:css': {
    const r = runNode(paths.stylelint, ['src/**/*.css', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint': {
    let r = runNode(paths.eslint, ['src', '--ext', '.ts,.tsx', '--max-warnings=0']);
    if (r.status !== 0) exitStatus(r.status);
    r = runNode(paths.stylelint, ['src/**/*.css']);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:fix': {
    let r = runNode(paths.eslint, ['src', '--ext', '.ts,.tsx', '--max-warnings=0', '--fix']);
    if (r.status !== 0) exitStatus(r.status);
    r = runNode(paths.stylelint, ['src/**/*.css', '--fix']);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:css:fix': {
    const r = runNode(paths.stylelint, ['src/**/*.css', '--fix', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:docs': {
    const r = runNode(paths.markdownlint, [
      '--config',
      '../.markdownlint-cli2.jsonc',
      '../README.md',
      '../.github/**/*.md',
      ...rest,
    ]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'lint:docs:fix': {
    const r = runNode(paths.markdownlint, [
      '--fix',
      '--config',
      '../.markdownlint-cli2.jsonc',
      '../README.md',
      '../.github/**/*.md',
      ...rest,
    ]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:e2e': {
    const r = runNode(paths.playwright, ['test', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:e2e:headed': {
    const r = runNode(paths.playwright, ['test', '--headed', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:e2e:ui': {
    const r = runNode(paths.playwright, ['test', '--ui', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:e2e:install': {
    const r = runNode(paths.playwright, ['install', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  case 'test:screenshots': {
    const r = runNode(paths.playwright, ['test', '--config=playwright.screenshots.config.ts', ...rest]);
    exitStatus(r.status ?? 0);
    break;
  }
  default:
    console.error(`Unknown task: ${task}`);
    process.exit(1);
}
