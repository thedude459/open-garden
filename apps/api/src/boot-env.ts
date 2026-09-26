const REQUIRED = ['SESSION_SECRET', 'DATABASE_URL'] as const;
const EXAMPLE_SECRET = 'dev-only-change-me-in-production';

export function assertBootEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of REQUIRED) {
    const value = env[key];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${key} is required`);
    }
  }
  if (env['SEED_DEMO_USERS'] === 'false' && env['SESSION_SECRET']?.trim() === EXAMPLE_SECRET) {
    throw new Error(
      'SESSION_SECRET must not be the example value when SEED_DEMO_USERS is false',
    );
  }
}

const entry = process.argv[1] ?? '';
if (/(?:^|[/\\])boot-env\.(ts|js)$/.test(entry)) {
  try {
    assertBootEnv();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
