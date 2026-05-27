import { execSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_USER } from "./helpers/auth";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

function run(cmd: string) {
  execSync(cmd, { stdio: "pipe" });
}

async function waitForApiHealthy() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiURL}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  }

  throw new Error("API health check timed out in Playwright global setup.");
}

function upsertVerifiedUserViaApiContainer() {
  const script = `
from datetime import datetime, timezone

from app.core.auth import get_password_hash
from app.database import SessionLocal
from app.models import User

db = SessionLocal()
username = ${JSON.stringify(E2E_USER.username)}
email = ${JSON.stringify(E2E_USER.email)}
password = ${JSON.stringify(E2E_USER.password)}

user = db.query(User).filter(User.username == username).first()
if user is None:
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(password),
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
        is_active=True,
    )
else:
    user.email = email
    user.hashed_password = get_password_hash(password)
    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    user.is_active = True

db.add(user)
db.commit()
db.close()
print("ok")
`;

  const tmpPath = join(tmpdir(), `open-garden-e2e-upsert-${Date.now()}.py`);
  writeFileSync(tmpPath, script, "utf-8");
  try {
    run(`docker cp "${tmpPath}" open-garden-api:/tmp/e2e_upsert_user.py`);
    const output = execSync("docker exec open-garden-api python /tmp/e2e_upsert_user.py", {
      encoding: "utf-8",
    });
    if (!output.includes("ok")) {
      throw new Error(`E2E user upsert did not complete successfully: ${output}`);
    }
    const count = execSync(
      'docker exec open-garden-api python -c "from app.database import SessionLocal; from app.models import User; db=SessionLocal(); print(db.query(User).filter(User.username==\\"pw_e2e_verified\\").count()); db.close()"',
      { encoding: "utf-8" },
    ).trim();
    if (Number(count) < 1) {
      throw new Error("E2E user upsert reported success but user row is missing.");
    }
  } finally {
    unlinkSync(tmpPath);
  }
}

async function loginForToken(): Promise<string> {
  let loginRes: Response | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    loginRes = await fetch(`${apiURL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: E2E_USER.username,
        password: E2E_USER.password,
      }),
    });
    if (loginRes.ok) {
      break;
    }
    if (loginRes.status === 429) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000 * (attempt + 1)));
      continue;
    }
    break;
  }

  if (!loginRes?.ok) {
    throw new Error(`Unable to create Playwright session token: ${loginRes?.status ?? "unknown"}`);
  }

  const payload = (await loginRes.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Playwright setup login did not return an access token.");
  }
  return payload.access_token;
}

function writeAuthArtifacts(token: string) {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const authDir = resolve(dir, ".auth");
  mkdirSync(authDir, { recursive: true });

  writeFileSync(resolve(dir, ".e2e-session.json"), JSON.stringify({ token }), "utf-8");
  writeFileSync(
    resolve(authDir, "storageState.json"),
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: "open-garden-token", value: token },
            { name: "open-garden-help-seen", value: "1" },
            { name: "open-garden-onboarding-dismissed", value: "1" },
          ],
        },
      ],
    }),
    "utf-8",
  );
}

async function globalSetup() {
  await waitForApiHealthy();
  upsertVerifiedUserViaApiContainer();
  const token = await loginForToken();
  writeAuthArtifacts(token);
}

export default globalSetup;
