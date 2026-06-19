import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://garden:garden@localhost:5432/garden";

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });

export async function closeDb() {
  await client.end({ timeout: 5 });
}
