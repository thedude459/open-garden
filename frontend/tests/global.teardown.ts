import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_USER } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

function run(cmd: string) {
  execSync(cmd, { stdio: "pipe" });
}

function runPythonInApiContainer(script: string) {
  run(`docker exec -i open-garden-api python - <<'PY'\n${script}\nPY`);
}

async function deleteUserViaApi() {
  const loginRes = await fetch(`${API}/auth/login`, {
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
    return false;
  }

  const tokenPayload = (await loginRes.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    return false;
  }

  const deleteRes = await fetch(`${API}/users/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  return deleteRes.ok || deleteRes.status === 404;
}

function deleteUserViaApiContainer() {
  const script = `
from app.database import SessionLocal
from app.models import Bed, Garden, PestLog, Placement, Planting, SeedInventory, Sensor, SensorReading, Task, User, UserAuthToken

db = SessionLocal()
username = "${E2E_USER.username}"
user = db.query(User).filter(User.username == username).first()
if user is not None:
    user_id = user.id
    gardens = db.query(Garden).filter(Garden.owner_id == user_id).all()
    for garden in gardens:
        gid = garden.id
        bed_ids = [row.id for row in db.query(Bed.id).filter(Bed.garden_id == gid).all()]
        if bed_ids:
            db.query(Placement).filter(Placement.bed_id.in_(bed_ids)).delete(synchronize_session=False)
            db.query(Bed).filter(Bed.id.in_(bed_ids)).delete(synchronize_session=False)
        db.query(PestLog).filter(PestLog.garden_id == gid).delete()
        db.query(Task).filter(Task.garden_id == gid).delete()
        db.query(Planting).filter(Planting.garden_id == gid).delete()
        db.query(Placement).filter(Placement.garden_id == gid).delete()
        sensor_ids = [row.id for row in db.query(Sensor.id).filter(Sensor.garden_id == gid).all()]
        if sensor_ids:
            db.query(SensorReading).filter(SensorReading.sensor_id.in_(sensor_ids)).delete(synchronize_session=False)
        db.query(Sensor).filter(Sensor.garden_id == gid).delete()
        db.delete(garden)
    db.query(SeedInventory).filter(SeedInventory.user_id == user_id).delete()
    db.query(UserAuthToken).filter(UserAuthToken.user_id == user_id).delete()
    db.delete(user)
    db.commit()
db.close()
`;

  runPythonInApiContainer(script);
}

async function globalTeardown() {
  const deleted = await deleteUserViaApi().catch(() => false);
  if (!deleted) {
    deleteUserViaApiContainer();
  }

  const dir = fileURLToPath(new URL(".", import.meta.url));
  const sessionPath = resolve(dir, ".e2e-session.json");
  if (existsSync(sessionPath)) {
    unlinkSync(sessionPath);
  }
}

export default globalTeardown;
