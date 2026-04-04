import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_USER } from "./helpers/auth";

function run(cmd: string) {
  execSync(cmd, { stdio: "pipe" });
}

function runPythonInApiContainer(script: string) {
  run(`docker exec -i open-garden-api python - <<'PY'\n${script}\nPY`);
}

async function waitForApiHealthy() {
  const endpoint = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${endpoint}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("API health check timed out in Playwright global setup.");
}

function upsertVerifiedUserViaApiContainer() {
  const script = `
from datetime import datetime

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import User

db = SessionLocal()
username = "${E2E_USER.username}"
email = "${E2E_USER.email}"
password = "${E2E_USER.password}"

user = db.query(User).filter(User.username == username).first()
if user is None:
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(password),
        email_verified=True,
        email_verified_at=datetime.utcnow(),
        is_active=True,
    )
else:
    user.email = email
    user.hashed_password = get_password_hash(password)
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    user.is_active = True

db.add(user)
db.commit()
db.close()
`;

  runPythonInApiContainer(script);
}

async function globalSetup() {
  await waitForApiHealthy();
  upsertVerifiedUserViaApiContainer();

  const endpoint = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
  const loginRes = await fetch(`${endpoint}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: E2E_USER.username,
      password: E2E_USER.password,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Unable to create Playwright session token: ${loginRes.status}`);
  }

  const payload = (await loginRes.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Playwright setup login did not return an access token.");
  }

  const dir = fileURLToPath(new URL(".", import.meta.url));
  const sessionPath = resolve(dir, ".e2e-session.json");
  writeFileSync(sessionPath, JSON.stringify({ token: payload.access_token }), "utf-8");
}

export default globalSetup;
