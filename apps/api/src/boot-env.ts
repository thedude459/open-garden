const REQUIRED = ['DATABASE_URL'] as const;

/**
 * Fail fast on configuration the API cannot run with. Sessions are random
 * tokens stored hashed in Postgres, so there is no signing secret to check.
 */
export function assertBootEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of REQUIRED) {
    const value = env[key];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${key} is required`);
    }
  }
  const adminEmail = env['ADMIN_EMAIL']?.trim();
  if (adminEmail && !/^[^\s@]+@[^\s@]+$/.test(adminEmail)) {
    throw new Error(`ADMIN_EMAIL is not an email address: ${adminEmail}`);
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
