# ADR 0001: Use Drizzle ORM

## Status
Accepted

## Context
Open Garden needs typed PostgreSQL access with migrations, without heavy ORM magic.

## Decision
Use Drizzle ORM + Drizzle Kit / SQL migrations for persistence.

## Consequences
+ Strong TypeScript inference, SQL-first control, light runtime
- Team must be comfortable writing SQL-ish queries
