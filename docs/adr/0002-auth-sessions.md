# ADR 0002: Session cookie authentication

## Status
Accepted

## Context
Self-hosted multi-user PWA needs per-user auth for catalog and private favorites.

## Decision
HTTP-only session cookies with server-side session rows in PostgreSQL (hashed tokens).

## Consequences
+ Fits PWA/XSS posture better than localStorage JWT
+ Simple logout/revocation
- Requires CORS credentials and cookie path configuration
