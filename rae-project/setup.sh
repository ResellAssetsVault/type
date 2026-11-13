#!/usr/bin/env bash
# Install reverse-api-engineer (rae) and seed its config for this project.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

uv tool install --upgrade "reverse-api-engineer[manual]"
export PATH="$HOME/.local/bin:$PATH"

# Manual mode needs a Playwright browser (agent mode uses npx instead).
if [ "${RAE_SKIP_BROWSER:-0}" != "1" ]; then
  uv tool run --from "reverse-api-engineer[manual]" playwright install chromium || \
    echo "Playwright browser install failed; manual mode may not work."
fi

mkdir -p "$HOME/.reverse-api"
if [ ! -f "$HOME/.reverse-api/config.json" ]; then
  cp config.example.json "$HOME/.reverse-api/config.json"
  echo "Wrote ~/.reverse-api/config.json"
fi

reverse-api-engineer --version
command -v node >/dev/null || echo "Warning: Node.js 20.19+ is needed for agent mode."
