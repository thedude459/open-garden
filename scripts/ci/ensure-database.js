#!/usr/bin/env node
// Create the database named in DATABASE_URL if it does not exist yet.
// e2e uses its own database (open_garden_e2e) so test users, properties, and
// plants never land in the database the Docker app uses.
'use strict';

const { Client } = require('pg');

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const target = new URL(raw);
  const name = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unexpected database name: ${name}`);

  // Connect to the server's default maintenance database to check and create.
  const admin = new URL(raw);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (found.rowCount) {
      console.log(`Database ${name} exists`);
      return;
    }
    await client.query(`create database "${name}"`);
    console.log(`Created database ${name}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
