#!/usr/bin/env bash
# Run npm with npm_config_devdir cleared (avoids "Unknown env config devdir" on npm 10+).
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
exec env -u npm_config_devdir -u NPM_CONFIG_DEVDIR npm "$@"
