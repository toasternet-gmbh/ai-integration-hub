# scripts/remote-forward.ps1 (Windows) — exposes the locally-running hub-mcp-server (reachable
# through the self-hosted stack's Kong gateway on VITE_LOCAL_FUNCTIONS_PORT, per deploy.sh's own
# port-math comment) to a remote desktop/laptop/server, using a Cloudflare quick tunnel
# (`cloudflared tunnel --url ...`) — one binary, no SSH server or firewall changes needed on either
# end, same command shape as scripts/remote-forward.sh's macOS/Linux equivalent.
#
# Usage (PowerShell):
#   .\scripts\remote-forward.ps1                              # forward the default local functions port
#   .\scripts\remote-forward.ps1 -Port 50000                  # forward a specific port instead
#   .\scripts\remote-forward.ps1 -EnvFile C:\path\.env.supabase  # read VITE_LOCAL_FUNCTIONS_PORT from a specific env file
#
# SECURITY: a Cloudflare quick tunnel is unauthenticated and ephemeral by design — anyone who gets
# the generated https://*.trycloudflare.com URL can reach whatever is on the forwarded port for as
# long as this script keeps running, with no login of any kind. That's fine for short-lived
# debugging or demoing the Hub from another machine; it is NOT a substitute for a named,
# authenticated Cloudflare Tunnel bound to your own account + DNS zone (`cloudflared tunnel
# create`/`route dns`) for anything you'd leave running or share more than momentarily. Stop this
# script (Ctrl+C) as soon as you're done — the tunnel dies with the process.

param(
  [int]$Port = 0,
  [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $RepoRoot ".env.supabase" }

$DefaultPort = 50000
if ($Port -eq 0 -and (Test-Path $EnvFile)) {
  $envLine = Select-String -Path $EnvFile -Pattern '^VITE_LOCAL_FUNCTIONS_PORT=' | Select-Object -Last 1
  if ($envLine) {
    $envPort = ($envLine.Line -split '=', 2)[1].Trim('"', "'")
    if ($envPort) { $DefaultPort = [int]$envPort }
  }
}
if ($Port -eq 0) { $Port = $DefaultPort }

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Error "cloudflared is not installed.`nInstall with: winget install --id Cloudflare.cloudflared`nOr download a binary from: https://github.com/cloudflare/cloudflared/releases"
  exit 1
}

Write-Host "Forwarding http://localhost:$Port (hub-mcp-server via Kong) through a Cloudflare quick tunnel..."
Write-Host "The public URL cloudflared assigns will appear below — press Ctrl+C to stop."
Write-Host "WARNING: Unauthenticated while running: see this script's header comment before sharing the URL."
Write-Host ""

cloudflared tunnel --url "http://localhost:$Port"
