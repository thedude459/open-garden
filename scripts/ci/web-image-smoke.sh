#!/usr/bin/env bash
# Runs the built web image the way Compose does and checks what only nginx
# decides: compression, cache headers, and the visitor address passed to the
# API. A stub `api` container echoes the headers nginx forwards.
#
#   scripts/ci/web-image-smoke.sh [image]   (default open-garden-web:ci)
set -euo pipefail

IMAGE="${1:-open-garden-web:ci}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# The API's own base image, so no other image is pulled.
NODE_IMAGE="$(sed -n 's/^FROM node:\([^ ]*\) AS runtime$/node:\1/p' "${ROOT}/Dockerfile.api")"
NAME="og-smoke-$$"
PORT="${SMOKE_PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  docker rm -f "${NAME}-web" "${NAME}-api" >/dev/null 2>&1 || true
  docker network rm "${NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

docker network create "${NAME}" >/dev/null
docker run -d --name "${NAME}-api" --network "${NAME}" --network-alias api "${NODE_IMAGE}" \
  node -e "require('http').createServer((q, s) => s.end(JSON.stringify({ realIp: q.headers['x-real-ip'] }))).listen(3000)" \
  >/dev/null
docker run -d --name "${NAME}-web" --network "${NAME}" -p "127.0.0.1:${PORT}:8080" "${IMAGE}" >/dev/null

for _ in $(seq 1 30); do
  curl -fs -o /dev/null "${BASE}/" && break
  sleep 1
done
curl -fs -o /dev/null "${BASE}/" || {
  docker logs "${NAME}-web" >&2
  fail "web container did not answer"
}

header() { # header <name> <curl args...>
  local name="$1"
  shift
  curl -fs -o /dev/null -D - "$@" | tr -d '\r' | sed -n "s/^${name}: //Ip" | head -1
}

# Compression and caching of a hashed bundle.
main="$(curl -fs "${BASE}/" | grep -o 'main-[A-Za-z0-9_-]\{8\}\.js' | head -1)"
[[ -n "${main}" ]] || fail "index.html names no main bundle"
[[ "$(header Content-Encoding -H 'Accept-Encoding: gzip' "${BASE}/${main}")" == "gzip" ]] ||
  fail "${main} is not compressed"
[[ "$(header Cache-Control "${BASE}/${main}")" == *immutable* ]] ||
  fail "${main} is not cached as immutable"
[[ "$(header Cache-Control "${BASE}/index.html")" == no-store* ]] ||
  fail "index.html may be cached"
styles="$(curl -fs "${BASE}/" | grep -o 'styles-[A-Za-z0-9_-]\{8\}\.css' | head -1)"
[[ "$(header Content-Encoding -H 'Accept-Encoding: gzip' "${BASE}/${styles}")" == "gzip" ]] ||
  fail "${styles:-the stylesheet} is not compressed"
code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/main-ZZZZZZZZ.js")"
[[ "${code}" == "404" ]] || fail "a missing bundle answered ${code}, not 404"
[[ -n "$(header Content-Security-Policy "${BASE}/${main}")" ]] ||
  fail "${main} lost the security headers"

# The visitor's address. This curl reaches nginx from the Docker network's
# gateway, a private address, so nginx takes the address the proxy forwards.
ip_for() {
  curl -fs -H "X-Forwarded-For: $1" "${BASE}/api/echo" | sed -n 's/.*"realIp":"\([^"]*\)".*/\1/p'
}
[[ "$(ip_for 203.0.113.7)" == "203.0.113.7" ]] || fail "forwarded visitor address not passed on"
[[ "$(ip_for 203.0.113.8)" == "203.0.113.8" ]] || fail "two visitors share one address"
# A visitor cannot pose as another by adding to the header: the proxy appends
# the address it saw, and that one is not trusted, so it wins.
[[ "$(ip_for '198.51.100.1, 203.0.113.9')" == "203.0.113.9" ]] ||
  fail "a forged X-Forwarded-For entry was believed"

echo "web image smoke test passed (${IMAGE})"
