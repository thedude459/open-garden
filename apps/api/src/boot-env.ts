const REQUIRED = ['SESSION_SECRET', 'DATABASE_URL'] as const;

export function assertBootEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of REQUIRED) {
    const value = env[key];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${key} is required`);
    }
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
