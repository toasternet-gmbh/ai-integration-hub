#!/bin/bash
# scripts/remote-forward.sh (macOS/Linux) — exposes the locally-running hub-mcp-server (reachable
# through the self-hosted stack's Kong gateway on VITE_LOCAL_FUNCTIONS_PORT, per deploy.sh's own
# port-math comment) to a remote desktop/laptop/server, using a Cloudflare quick tunnel
# (`cloudflared tunnel --url ...`) — one binary, no SSH server or firewall changes needed on either
# end, same command shape as scripts/remote-forward.ps1's Windows equivalent.
#
# Usage:
#   ./scripts/remote-forward.sh                  # forward the default local functions port
#   ./scripts/remote-forward.sh --port=50000     # forward a specific port instead
#   ./scripts/remote-forward.sh --env=/path/to/.env.supabase   # read VITE_LOCAL_FUNCTIONS_PORT from a specific env file
#
# SECURITY: a Cloudflare quick tunnel is unauthenticated and ephemeral by design — anyone who gets
# the generated https://*.trycloudflare.com URL can reach whatever is on the forwarded port for as
# long as this script keeps running, with no login of any kind. That's fine for short-lived
# debugging or demoing the Hub from another machine; it is NOT a substitute for a named,
# authenticated Cloudflare Tunnel bound to your own account + DNS zone (`cloudflared tunnel
# create`/`route dns`) for anything you'd leave running or share more than momentarily. Stop this
# script (Ctrl+C) as soon as you're done — the tunnel dies with the process.

set -euo pipefail

PORT_ARG=""
ENV_FILE_ARG=""
for arg in "$@"; do
  case "$arg" in
    --port=*) PORT_ARG="${arg#--port=}" ;;
    --env=*)  ENV_FILE_ARG="${arg#--env=}" ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE_ARG:-${REPO_ROOT}/.env.supabase}"

DEFAULT_PORT=50000
if [ -z "$PORT_ARG" ] && [ -f "$ENV_FILE" ]; then
  ENV_PORT="$(grep -E '^VITE_LOCAL_FUNCTIONS_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  [ -n "$ENV_PORT" ] && DEFAULT_PORT="$ENV_PORT"
fi
PORT="${PORT_ARG:-$DEFAULT_PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared is not installed." >&2
  if [[ "$(uname)" == "Darwin" ]]; then
    echo "   Install with: brew install cloudflared" >&2
  else
    echo "   Install with your distro's package manager, or download a binary from:" >&2
    echo "   https://github.com/cloudflare/cloudflared/releases" >&2
  fi
  exit 1
fi

echo "🌐 Forwarding http://localhost:${PORT} (hub-mcp-server via Kong) through a Cloudflare quick tunnel..."
echo "   The public URL cloudflared assigns will appear below — press Ctrl+C to stop."
echo "   ⚠️  Unauthenticated while running: see this script's header comment before sharing the URL."
echo

exec cloudflared tunnel --url "http://localhost:${PORT}"
