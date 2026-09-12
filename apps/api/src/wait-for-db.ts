import { Client } from 'pg';

export type WaitForDbConnect = (url: string) => Promise<void>;

export type WaitForDbOptions = {
  url?: string;
  timeoutMs?: number;
  intervalMs?: number;
  connect?: WaitForDbConnect;
};

async function defaultConnect(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.end();
}

export async function waitForDb(opts: WaitForDbOptions = {}): Promise<void> {
  const url = opts.url ?? process.env['DATABASE_URL'] ?? '';
  if (url.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 500;
  const connect = opts.connect ?? defaultConnect;
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  for (;;) {
    try {
      await connect(url);
      return;
    } catch (err) {
      last = err;
      if (Date.now() >= deadline) {
        const detail = last instanceof Error ? last.message : String(last);
        throw new Error(`Timed out waiting for database: ${detail}`);
      }
      const sleepFor = Math.min(intervalMs, Math.max(0, deadline - Date.now()));
      await new Promise((resolve) => setTimeout(resolve, sleepFor));
    }
  }
}

const entry = process.argv[1] ?? '';
if (/(?:^|[/\\])wait-for-db\.(ts|js)$/.test(entry)) {
  waitForDb().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
