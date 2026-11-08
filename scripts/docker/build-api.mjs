// Bundle the API and its boot scripts into plain JavaScript for the runtime image.
// Workspace libs (@open-garden/*) and npm packages are bundled in, so the runtime
// image needs no node_modules, no TypeScript tooling, and no source tree.
// Run from the repository root: node scripts/docker/build-api.mjs
import { build } from 'esbuild';

await build({
  entryPoints: {
    main: 'apps/api/src/main.ts',
    'sync-cli': 'apps/api/src/plants/sync-cli.ts',
    'boot-env': 'apps/api/src/boot-env.ts',
    'wait-for-db': 'apps/api/src/wait-for-db.ts',
  },
  outdir: 'dist/api-runtime',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  tsconfig: 'tsconfig.base.json',
  sourcemap: true,
  // Nest logs and error contexts use class names; keep them readable.
  keepNames: true,
  legalComments: 'linked',
  logLevel: 'info',
  // Optional modules that Nest and pg load only when the matching feature is
  // configured. They are not installed, and the lazy require is wrapped in
  // try/catch, so leaving them out of the bundle is safe.
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@fastify/static',
    'class-transformer',
    'class-transformer/*',
    'class-validator',
    'pg-native',
  ],
});
