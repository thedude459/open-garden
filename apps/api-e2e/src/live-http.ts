export const liveEnabled = process.env['E2E_LIVE'] === '1';
export const API_ORIGIN = 'http://localhost:3000';
export const TEST_PASSWORD = 'password123';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Parse `og_session` from a `Set-Cookie` header or list of headers. */
export function parseOgSessionCookie(setCookie: string | string[] | null | undefined): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    const first = header.split(';')[0]?.trim() ?? '';
    if (first.toLowerCase().startsWith('og_session=')) {
      return decodeURIComponent(first.slice('og_session='.length));
    }
  }
  return undefined;
}

export class LiveResponse {
  constructor(
    private readonly httpStatus: number,
    private readonly httpOk: boolean,
    private readonly bodyText: string,
    private readonly cookieHeaders: string[],
  ) {}

  status(): number {
    return this.httpStatus;
  }

  ok(): boolean {
    return this.httpOk;
  }

  setCookies(): string[] {
    return this.cookieHeaders;
  }

  async text(): Promise<string> {
    return this.bodyText;
  }

  async json(): Promise<unknown> {
    return this.bodyText ? JSON.parse(this.bodyText) : null;
  }
}

export class LiveClient {
  private cookie: string | undefined;

  async register(email: string): Promise<{ id: string; email: string }> {
    const res = await this.post('/api/auth/register', {
      data: { email, password: TEST_PASSWORD, displayName: 'E2E' },
    });
    if (!res.ok()) {
      throw new Error(`register failed: ${res.status()} ${await res.text()}`);
    }
    const token = parseOgSessionCookie(res.setCookies());
    if (!token) throw new Error('register succeeded without og_session cookie');
    this.cookie = token;
    const body = (await res.json()) as { user: { id: string; email: string } };
    return body.user;
  }

  async login(email: string, password = TEST_PASSWORD): Promise<{ id: string; email: string }> {
    const res = await this.post('/api/auth/login', { data: { email, password } });
    if (!res.ok()) {
      throw new Error(`login failed: ${res.status()} ${await res.text()}`);
    }
    const token = parseOgSessionCookie(res.setCookies());
    if (!token) throw new Error('login succeeded without og_session cookie');
    this.cookie = token;
    const body = (await res.json()) as { user: { id: string; email: string } };
    return body.user;
  }

  dispose(): void {
    this.cookie = undefined;
  }

  get(path: string): Promise<LiveResponse> {
    return this.request('GET', path);
  }

  delete(path: string): Promise<LiveResponse> {
    return this.request('DELETE', path);
  }

  post(path: string, init?: { data?: unknown }): Promise<LiveResponse> {
    return this.request('POST', path, init?.data);
  }

  patch(path: string, init?: { data?: unknown }): Promise<LiveResponse> {
    return this.request('PATCH', path, init?.data);
  }

  put(path: string, init?: { data?: unknown }): Promise<LiveResponse> {
    return this.request('PUT', path, init?.data);
  }

  private async request(method: string, path: string, data?: unknown): Promise<LiveResponse> {
    const headers: Record<string, string> = {};
    if (this.cookie) headers['cookie'] = `og_session=${this.cookie}`;
    let body: string | undefined;
    if (data !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(data);
    }
    const res = await fetch(`${API_ORIGIN}${path}`, { method, headers, body });
    const setCookies =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    const fallback = res.headers.get('set-cookie');
    const cookieHeaders = setCookies.length > 0 ? setCookies : fallback ? [fallback] : [];
    const token = parseOgSessionCookie(cookieHeaders);
    if (token) this.cookie = token;
    return new LiveResponse(res.status, res.ok, await res.text(), cookieHeaders);
  }
}

export async function waitUntil(
  check: () => Promise<boolean>,
  timeoutMs = 30_000,
  message = 'timed out waiting for condition',
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50)); // poll interval; re-check the condition
  }
  throw new Error(message);
}
