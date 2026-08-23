#!/bin/bash
# deploy.sh — yogAIpilot self-hosted deployment
# lives in the project root or /home/supabase-helper/
#
# Usage:  ./deploy.sh [<owner/repo>] [options]
#   e.g.  ./deploy.sh toasternet/yogaipilot
#         ./deploy.sh toasternet/yogaipilot --remote --env=.env.supabase

#         ./deploy.sh toasternet/yogaipilot --branch=stable           # check out a specific branch
#         ./deploy.sh toasternet/yogaipilot --env=/path/to/prod.env   # use a specific env file
#         ./deploy.sh toasternet/yogaipilot --env=.env.prod           # relative: cwd → project dir → web dir
#         ./deploy.sh toasternet/yogaipilot --remote                  # remote Supabase, skip Docker stack
#         ./deploy.sh toasternet/yogaipilot --caddy-only              # regenerate Caddyfile + reload only
#         ./deploy.sh toasternet/yogaipilot --dev                     # Vite dev server with HMR
#         ./deploy.sh toasternet/yogaipilot --no-git                  # skip git pull/push
#         ./deploy.sh toasternet/yogaipilot --supabase-only           # start Supabase stack only, no web container
#         ./deploy.sh toasternet/yogaipilot --init-env                # print .env.supabase template and exit
#         ./deploy.sh toasternet/yogaipilot --remote --base-dir=~/my-deploy  # macOS: override /home base dir
#
# --supabase-only  Starts (or restarts) the full local Supabase Docker stack — postgres, auth,
#                  kong, studio, edge functions, realtime, storage — but skips cloning the web
#                  app, building the Docker image, and starting the web container.
#                  Runs migrations. Useful during local development when the frontend runs via
#                  `npm run dev` / `bun dev` on the host rather than inside Docker.
#
# --branch overrides DEPLOY_BRANCH in the env file; DEPLOY_BRANCH in the env file overrides 'main'.
# --env accepts absolute paths, cwd-relative paths, or filenames inside the web repo root.
#
# MODES
# ─────
# (default)  Full local Docker Supabase stack + web app + Caddy.
#            Runs all migrations against the local DB on first boot.
#
# --remote   Skip local Docker Supabase entirely.
#            Reads VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.supabase
#            and points the web app at that remote Supabase instance.
#            Runs migrations via psql (needs DB_URL in .env.supabase) and
#            deploys edge functions via `supabase functions deploy` if the CLI is present.
#
# REQUIRED .env.supabase keys (in web repo root)
# ────────────────────────────────────────────────
#   VITE_SUPABASE_URL              https://<project>.supabase.co  (or self-hosted URL)
#   VITE_SUPABASE_PROJECT_ID       <project-id>
#   VITE_SUPABASE_PUBLISHABLE_KEY  <anon-key>
#   SUPABASE_SERVICE_ROLE_KEY      <service-role-key>
#   VITE_MAIN_DOMAIN               yogaipilot.yourdomain.com
#   VITE_LOCAL_FUNCTIONS_PORT      50000
#   VITE_REALTIME_WORKER_URL_LOCAL http://localhost:52000
#   OPENAI_API_KEY                 sk-...
#   RESEND_API_KEY                 re_...
#   STRIPE_SECRET_KEY              rk_live_...  (or sk_live_...)
#   STRIPE_WEBHOOK_SECRET          whsec_...
#   STRIPE_LIVE                    true|false
#   STRIPE_SECRET_KEY_SANDBOX      rk_test_...
#   STRIPE_WEBHOOK_SECRET_SANDBOX  whsec_...
#   PAYPAL_CLIENT_ID               ...
#   PAYPAL_CLIENT_SECRET           ...
#   PAYPAL_LIVE                    true|false
#   PAYPAL_CLIENT_ID_SANDBOX       ...
#   PAYPAL_CLIENT_SECRET_SANDBOX   ...
#   FRONTEND_URL                   https://yogaipilot.yourdomain.com
#   PROJECT_SHORT_CODE             STUDIO   (or any short label)
#   DASHBOARD_USERNAME             admin
#   DASHBOARD_PASSWORD             <strong-password>
#
# OPTIONAL (remote mode only — for running migrations)
#   DB_URL   postgresql://postgres:<password>@<host>:<port>/postgres
#
# Port scheme (base = VITE_LOCAL_FUNCTIONS_PORT, default 50000)
#   KONG_HTTP          = BASE_PORT           (50000) — API gateway HTTP  ← VITE_SUPABASE_URL
#   WEB_PORT           = BASE_PORT + 1000    (51000) — web app (Caddy target)
#   RT_PORT            = BASE_PORT + 2000    (52000) — realtime worker external
#   PG_PORT            = BASE_PORT + 3000    (53000) — Postgres external
#   POOLER_PORT        = BASE_PORT + 4000    (54000) — Supavisor transaction
#   POOLER_SESSION_PORT= BASE_PORT + 5000    (55000) — Supavisor session
#   KONG_HTTPS         = BASE_PORT + 6000    (56000) — API gateway HTTPS
#   STUDIO_PORT        = BASE_PORT + 7000    (57000) — Supabase Studio (via Caddy basic_auth)
#   STUDIO_INTERNAL_PORT=BASE_PORT + 7900    (57900) — Studio direct (never advertised)
#
# Caddy runs separately; config assembled in /home/all-supabase-caddy/

set -e
set -o pipefail
trap 'echo "❌ Error on line $LINENO"' ERR

# Capture invocation directory and script directory BEFORE any cd happens.
# Used for resolving relative --env paths regardless of where cd takes us later.
CALL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Portable in-place sed: BSD/macOS sed requires an extension argument after -i (even an empty
# one), while GNU/Linux sed's -i takes none — passing one straight through breaks one or the
# other. `-i.bak` + cleanup is accepted identically by both, so this works everywhere without
# branching on `uname`.
_sedi() {
  local expr="$1"; shift
  for f in "$@"; do
    sed -i.bak "$expr" "$f" && rm -f "${f}.bak"
  done
}

# ── DEFAULT REPO ─────────────────────────────────────────────────────────────

DEFAULT_REPO="toasternet/ai-integration-hub"

# ── PARSE ARGUMENTS ──────────────────────────────────────────────────────────

GITNAME="${1:-$DEFAULT_REPO}"
CADDY_ONLY=false
DEV_MODE=false
NO_GIT=false
REMOTE_MODE=false
SUPABASE_ONLY=false
INIT_ENV=false
ENV_FILE=""
BRANCH_ARG=""
BASE_DIR_ARG=""

for arg in "$@"; do
  case "$arg" in
    --caddy-only)     CADDY_ONLY=true ;;
    --dev)            DEV_MODE=true ;;
    --no-git)         NO_GIT=true ;;
    --remote)         REMOTE_MODE=true ;;
    --supabase-only)  SUPABASE_ONLY=true ;;
    --init-env)       INIT_ENV=true ;;
    --env=*)          ENV_FILE="${arg#--env=}" ;;
    --branch=*)       BRANCH_ARG="${arg#--branch=}" ;;
    --base-dir=*)     BASE_DIR_ARG="${arg#--base-dir=}" ;;
  esac
done
# Capture space-separated forms:  --env <file>  and  --branch <name>
_args=("$@")
for (( _i=0; _i<${#_args[@]}; _i++ )); do
  if [[ "${_args[$_i]}" == "--env" && -n "${_args[$_i+1]}" && "${_args[$_i+1]}" != --* ]]; then
    ENV_FILE="${_args[$_i+1]}"
  fi
  if [[ "${_args[$_i]}" == "--branch" && -n "${_args[$_i+1]}" && "${_args[$_i+1]}" != --* ]]; then
    BRANCH_ARG="${_args[$_i+1]}"
  fi
done

# ── BASE DIRECTORY ───────────────────────────────────────────────────────────
# Default: /home (Linux server). On macOS /home is not writable; use --base-dir
# to override, or we auto-fallback to $HOME/.yogaipilot-deploy.

if [ -n "$BASE_DIR_ARG" ]; then
  BASE_DIR="$BASE_DIR_ARG"
elif [[ "$(uname)" == "Darwin" ]]; then
  BASE_DIR="${HOME}/.yogaipilot-deploy"
  echo "🍎 macOS detected — using base dir: ${BASE_DIR}  (override with --base-dir=<path>)"
else
  BASE_DIR="/home"
fi

DIRNAME="$(echo "$GITNAME" | tr '/' '-')"
# Container name prefix — independent of the Supabase cloud project ID so that
# self-hosted containers are always named after the local project, not the cloud tenant.
_CONTAINER_PREFIX="supabase-${DIRNAME}"
echo "🚀 Deploying project: ${GITNAME}  (dir: ${DIRNAME}  containers: ${_CONTAINER_PREFIX}-*)"
[ "$CADDY_ONLY"     = true ] && echo "📋 Caddy-only mode"
[ "$DEV_MODE"       = true ] && echo "🛠️  Dev mode — Vite dev server with HMR"
[ "$NO_GIT"         = true ] && echo "📌 No-git mode — keeping current files"
[ "$REMOTE_MODE"    = true ] && echo "☁️  Remote mode — skipping local Docker Supabase stack"
[ "$SUPABASE_ONLY"  = true ] && echo "🐘 Supabase-only mode — no web container"
[ -n "$BRANCH_ARG" ]        && echo "🌿 Branch override: ${BRANCH_ARG}"
[ -n "$ENV_FILE" ]           && echo "📄 Env file override: ${ENV_FILE}"

# ── INIT-ENV: print template and exit ─────────────────────────────────────────

if [ "$INIT_ENV" = true ]; then
  cat << 'TEMPLATE'
# ── yogAIpilot .env.supabase template ─────────────────────────────────────
# Copy this to <web-repo>/.env.supabase and fill in your values.
# In --remote mode:  set VITE_SUPABASE_URL to your own Supabase project URL.
# In local mode:     VITE_SUPABASE_URL will be set automatically by deploy.sh.

# ── Supabase ──────────────────────────────────────────────────────────────
VITE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
VITE_SUPABASE_PROJECT_ID="YOUR-PROJECT-ID"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# ── App domain (Caddy will issue TLS automatically) ───────────────────────
VITE_MAIN_DOMAIN="yogaipilot.yourdomain.com"
VITE_OTHER_DOMAINS=""

# Per-sport subdomains that should serve the SAME web app (not redirect) —
# e.g. "tennis,ballet,golf" → tennis.<VITE_MAIN_DOMAIN>, etc. The frontend
# themes itself per sport via DOMAIN_VERTICALS in verticalLanding.ts.
VITE_SPORT_SUBDOMAINS=""

# ── Git branch deployed by deploy.sh ─────────────────────────────────────
# Overridden by --branch flag if specified on the command line.
DEPLOY_BRANCH="main"

# ── Ports (leave as-is unless running multiple projects) ──────────────────
VITE_LOCAL_FUNCTIONS_PORT="50000"
VITE_REALTIME_WORKER_URL_LOCAL="http://localhost:52000"
VITE_REALTIME_WORKER_URL_CLOUDFLARE="https://yogaipilot.yourdomain.com/realtime"

# ── Frontend ──────────────────────────────────────────────────────────────
FRONTEND_URL="https://yogaipilot.yourdomain.com"
PROJECT_SHORT_CODE="STUDIO"
PAYMENT_TEST_USER="test@yourdomain.com"

# ── AI ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY="sk-..."

# ── Email (Resend) ────────────────────────────────────────────────────────
RESEND_API_KEY="re_..."
EMAIL_FROM="YogAIPilot <noreply@yourdomain.com>"
EMAIL_FROM_NAME="YogAIPilot"
EMAIL_REPLY_TO="info@yourdomain.com"

# ── Stripe ────────────────────────────────────────────────────────────────
STRIPE_LIVE="true"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_SECRET_KEY_SANDBOX="sk_test_..."
STRIPE_WEBHOOK_SECRET_SANDBOX="whsec_..."

# ── PayPal ────────────────────────────────────────────────────────────────
PAYPAL_LIVE="true"
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_CLIENT_ID_SANDBOX="..."
PAYPAL_CLIENT_SECRET_SANDBOX="..."

# ── Studio dashboard auth (basic-auth on Supabase Studio) ─────────────────
DASHBOARD_USERNAME="admin"
DASHBOARD_PASSWORD="changeme_use_strong_password"

# ── Remote mode only: psql URL for running migrations ─────────────────────
# DB_URL="postgresql://postgres:<password>@<host>:5432/postgres"
TEMPLATE
  exit 0
fi

# ── PATHS ────────────────────────────────────────────────────────────────────

PROJECT_DIR="${BASE_DIR}/supabase-project-${DIRNAME}"
CADDY_DIR="${BASE_DIR}/all-supabase-caddy"
WEB_DIR="web"

# ── BOOTSTRAP LOCAL SUPABASE (skipped in --remote mode) ──────────────────────

if [ "$REMOTE_MODE" = false ] && [ "$CADDY_ONLY" = false ]; then

  SUPABASE_SRC="${BASE_DIR}/supabase"

  if [ -d "$PROJECT_DIR" ]; then
    echo "✅ Project directory exists: ${PROJECT_DIR}"
    # No blanket `down` here anymore — it used to stop the entire stack
    # (Postgres, Auth, Kong, Storage, Realtime, Studio, Pooler) on every
    # single deploy, even a trivial web-only code change. `docker compose
    # up -d` further down already diffs each service's config and only
    # recreates the ones that actually changed, so a full teardown was pure
    # unnecessary downtime + restart time, not a correctness requirement.
    cd "$PROJECT_DIR"
    if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
      # Self-heal: an existing project directory (e.g. from a prior run that only got as
      # far as the git checkout) can be missing the Supabase docker-compose.yml at its
      # root if $SUPABASE_SRC was never cloned or was later removed. Re-bootstrap it from
      # the template instead of leaving the later "docker-compose.yml missing" check to
      # fail with no way to recover short of deleting the whole directory by hand.
      echo "⚠️  docker-compose.yml missing from an existing project directory — re-bootstrapping from the Supabase template..."
      if [ ! -d "$SUPABASE_SRC/docker" ]; then
        echo "📥 Cloning supabase/supabase docker template..."
        git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_SRC"
      fi
      cp -rf "$SUPABASE_SRC"/docker/* "$PROJECT_DIR"/
    elif [ -d "$SUPABASE_SRC/docker" ]; then
      echo "🔄 Refreshing docker-compose.yml from template..."
      cp -f "$SUPABASE_SRC/docker/docker-compose.yml" "$PROJECT_DIR/docker-compose.yml"
    fi
  else
    echo "📦 Bootstrapping ${PROJECT_DIR} from supabase docker template..."
    if [ ! -d "$SUPABASE_SRC" ]; then
      echo "📥 Cloning supabase/supabase docker template..."
      git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_SRC"
    fi
    mkdir -p "$PROJECT_DIR"
    cp -rf "$SUPABASE_SRC"/docker/* "$PROJECT_DIR"/
    cp "$SUPABASE_SRC"/docker/.env.example "$PROJECT_DIR"/.env
    echo "✅ Created ${PROJECT_DIR}"
    echo "⬇️  Pulling Supabase Docker images..."
    cd "$PROJECT_DIR"
    docker compose pull
    cd - >/dev/null
  fi

  cd "$PROJECT_DIR"
  echo "📂 Working directory: $(pwd)"

elif [ "$REMOTE_MODE" = true ]; then
  # Remote mode: work from a lightweight project dir (just web app + Caddy config)
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  echo "📂 Working directory (remote mode): $(pwd)"

elif [ "$CADDY_ONLY" = true ]; then
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found: ${PROJECT_DIR}  (deploy without --caddy-only first)"
    exit 1
  fi
  cd "$PROJECT_DIR"
  echo "📂 Working directory: $(pwd)"
fi

# ── SET COMPOSE PROJECT NAME ─────────────────────────────────────────────────

export COMPOSE_PROJECT_NAME="supabase-${DIRNAME}"
echo "🏷️  Compose project: ${COMPOSE_PROJECT_NAME}"

# ── CLONE / UPDATE WEB APP ───────────────────────────────────────────────────

MY_APP_REPO="${MY_APP_REPO:-${GITNAME}}"
MY_APP_BRANCH="main"   # default; overridden below in priority order

# ── RESOLVE ENV FILE PATH ─────────────────────────────────────────────────────
# Priority: --env arg > .env.supabase in web dir > nothing
# For --env: absolute path → cwd-relative → project-dir-relative → web-dir-relative

_RESOLVED_ENV_FILE=""
if [ -n "$ENV_FILE" ]; then
  if [[ "$ENV_FILE" = /* ]] && [ -f "$ENV_FILE" ]; then
    _RESOLVED_ENV_FILE="$ENV_FILE"                                        # 1. absolute path
  elif [ -f "${CALL_DIR}/${ENV_FILE}" ]; then
    _RESOLVED_ENV_FILE="${CALL_DIR}/${ENV_FILE}"                          # 2. relative to where the user ran the script
  elif [ -f "${SCRIPT_DIR}/${ENV_FILE}" ]; then
    _RESOLVED_ENV_FILE="${SCRIPT_DIR}/${ENV_FILE}"                        # 3. next to deploy.sh itself
  elif [ -f "${PROJECT_DIR}/${ENV_FILE}" ]; then
    _RESOLVED_ENV_FILE="${PROJECT_DIR}/${ENV_FILE}"                       # 4. project dir (/home/supabase-project-*)
  elif [ -f "${PROJECT_DIR}/${WEB_DIR}/${ENV_FILE}" ]; then
    _RESOLVED_ENV_FILE="${PROJECT_DIR}/${WEB_DIR}/${ENV_FILE}"            # 5. web checkout dir
  else
    echo "❌ --env file not found: ${ENV_FILE}"
    echo "   Searched:"
    echo "     [absolute]  ${ENV_FILE}"
    echo "     [call dir]  ${CALL_DIR}/${ENV_FILE}"
    echo "     [script]    ${SCRIPT_DIR}/${ENV_FILE}"
    echo "     [project]   ${PROJECT_DIR}/${ENV_FILE}"
    echo "     [web dir]   ${PROJECT_DIR}/${WEB_DIR}/${ENV_FILE}"
    exit 1
  fi
  echo "📄 Resolved env file: ${_RESOLVED_ENV_FILE}"
fi

# ── READ BRANCH (priority: --branch arg > env file > default) ─────────────────
# Read from env file candidates before git checkout so the right branch is cloned

_read_branch_from_file() {
  # $1 = file path; strips quotes, whitespace, and Windows \r line endings
  local _b
  _b=$( (grep '^DEPLOY_BRANCH=\|^MY_APP_BRANCH=' "$1" 2>/dev/null | head -1 | \
       cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' | xargs) || true)
  echo "$_b"
}

_BRANCH_SOURCE=""
if [ -n "$BRANCH_ARG" ]; then
  MY_APP_BRANCH="$BRANCH_ARG"
  _BRANCH_SOURCE="--branch flag"
elif [ -n "$_RESOLVED_ENV_FILE" ]; then
  _b=$(_read_branch_from_file "$_RESOLVED_ENV_FILE")
  if [ -n "$_b" ]; then
    MY_APP_BRANCH="$_b"
    _BRANCH_SOURCE="env file"
  fi
fi
# Fall back to existing .env.supabase in repo if already checked out and no source yet
if [ -z "$_BRANCH_SOURCE" ]; then
  for _try in "${PROJECT_DIR}/${WEB_DIR}/.env.supabase" "${PROJECT_DIR}/${WEB_DIR}/.env"; do
    if [ -f "$_try" ]; then
      _b=$(_read_branch_from_file "$_try")
      if [ -n "$_b" ]; then
        MY_APP_BRANCH="$_b"
        _BRANCH_SOURCE="repo env file"
        break
      fi
    fi
  done
fi
[ -z "$_BRANCH_SOURCE" ] && _BRANCH_SOURCE="default"
echo "🌿 Branch: ${MY_APP_BRANCH}  (${_BRANCH_SOURCE})"

if [ "$SUPABASE_ONLY" = true ]; then
  echo "⏩ Supabase-only — skipping git clone/pull"
elif [ "$NO_GIT" = true ]; then
  [ ! -d "${WEB_DIR}/.git" ] && { echo "❌ --no-git requires existing checkout in ${WEB_DIR}"; exit 1; }
  echo "📌 Skipping git — keeping current files"
elif [ ! -d "${WEB_DIR}/.git" ]; then
  echo "📥 Cloning ${MY_APP_REPO} (branch: ${MY_APP_BRANCH})..."
  if command -v gh >/dev/null 2>&1; then
    gh repo clone "$MY_APP_REPO" "$WEB_DIR" -- --branch "$MY_APP_BRANCH"
  else
    git clone -b "$MY_APP_BRANCH" "https://github.com/${MY_APP_REPO}.git" "$WEB_DIR"
  fi
else
  echo "🔄 Updating repository (branch: ${MY_APP_BRANCH})..."
  cd "$WEB_DIR"
  git fetch origin
  git checkout "$MY_APP_BRANCH"
  git reset --hard "origin/$MY_APP_BRANCH"
  cd - >/dev/null
fi

# ── LOAD .env ────────────────────────────────────────────────────────────────

WEB_SUPABASE_ENV="${PROJECT_DIR}/${WEB_DIR}/.env.supabase"
WEB_ENV="${PROJECT_DIR}/${WEB_DIR}/.env"

if [ -n "$_RESOLVED_ENV_FILE" ]; then
  echo "📋 Activating env: ${_RESOLVED_ENV_FILE} → ${WEB_ENV}"
  cp -f "$_RESOLVED_ENV_FILE" "$WEB_ENV"
elif [ -f "$WEB_SUPABASE_ENV" ]; then
  echo "📋 Copying .env.supabase → .env"
  cp -f "$WEB_SUPABASE_ENV" "$WEB_ENV"
fi

if [ ! -f "$WEB_ENV" ]; then
  echo ""
  echo "❌ No .env found at ${WEB_ENV}"
  echo "   Run with --init-env to print a template, then save it as ${WEB_DIR}/.env.supabase"
  echo ""
  exit 1
fi

echo "📄 Loading config from ${WEB_ENV}..."

_env_val() { grep "^${1}=" "$WEB_ENV" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true; }

# ── EXTRACT ENV VARS ──────────────────────────────────────────────────────────

VITE_SUPABASE_URL=$(_env_val VITE_SUPABASE_URL)
VITE_SUPABASE_PROJECT_ID=$(_env_val VITE_SUPABASE_PROJECT_ID)
VITE_SUPABASE_PUBLISHABLE_KEY=$(_env_val VITE_SUPABASE_PUBLISHABLE_KEY)
VITE_LOCAL_FUNCTIONS_PORT=$(_env_val VITE_LOCAL_FUNCTIONS_PORT)
VITE_REALTIME_WORKER_URL_LOCAL=$(_env_val VITE_REALTIME_WORKER_URL_LOCAL)
SUPABASE_SERVICE_ROLE_KEY=$(_env_val SUPABASE_SERVICE_ROLE_KEY)
VITE_MAIN_DOMAIN=$(_env_val VITE_MAIN_DOMAIN)
VITE_OTHER_DOMAINS=$(_env_val VITE_OTHER_DOMAINS)
VITE_SPORT_SUBDOMAINS=$(_env_val VITE_SPORT_SUBDOMAINS)

# yogAIpilot-specific
OPENAI_API_KEY=$(_env_val OPENAI_API_KEY)
RESEND_API_KEY=$(_env_val RESEND_API_KEY)
EMAIL_FROM=$(_env_val EMAIL_FROM)
EMAIL_FROM_NAME=$(_env_val EMAIL_FROM_NAME)
EMAIL_REPLY_TO=$(_env_val EMAIL_REPLY_TO)
STRIPE_LIVE=$(_env_val STRIPE_LIVE)
STRIPE_SECRET_KEY=$(_env_val STRIPE_SECRET_KEY)
STRIPE_WEBHOOK_SECRET=$(_env_val STRIPE_WEBHOOK_SECRET)
STRIPE_SECRET_KEY_SANDBOX=$(_env_val STRIPE_SECRET_KEY_SANDBOX)
STRIPE_WEBHOOK_SECRET_SANDBOX=$(_env_val STRIPE_WEBHOOK_SECRET_SANDBOX)
PAYPAL_LIVE=$(_env_val PAYPAL_LIVE)
PAYPAL_CLIENT_ID=$(_env_val PAYPAL_CLIENT_ID)
PAYPAL_CLIENT_SECRET=$(_env_val PAYPAL_CLIENT_SECRET)
PAYPAL_CLIENT_ID_SANDBOX=$(_env_val PAYPAL_CLIENT_ID_SANDBOX)
PAYPAL_CLIENT_SECRET_SANDBOX=$(_env_val PAYPAL_CLIENT_SECRET_SANDBOX)
FRONTEND_URL=$(_env_val FRONTEND_URL)
PROJECT_SHORT_CODE=$(_env_val PROJECT_SHORT_CODE)
PAYMENT_TEST_USER=$(_env_val PAYMENT_TEST_USER)
CREDENTIALS_ENCRYPTION_KEY=$(_env_val CREDENTIALS_ENCRYPTION_KEY)  # AES-256-GCM key for integration credentials (see _shared/crypto.ts)
DB_URL=$(_env_val DB_URL)  # used in --remote migration mode

# ── DOMAIN / URL DERIVATION ───────────────────────────────────────────────────

MY_SUPABASE_SUBDOMAIN=$(echo "$VITE_SUPABASE_URL" | sed -E 's|^https?://||')
MY_DOMAIN="${VITE_MAIN_DOMAIN:-$(echo "$MY_SUPABASE_SUBDOMAIN" | sed 's/^[^.]*\.//')}"

# Determine scheme early — everything downstream depends on this
if [[ "$MY_DOMAIN" == "localhost"* ]] || [[ "$MY_DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  _SCHEME="http"
else
  _SCHEME="https"
fi

MY_BASE_URL="${_SCHEME}://${MY_DOMAIN}"

# Per-sport subdomains (VITE_SPORT_SUBDOMAINS="tennis,ballet,...") sharing the
# same reverse_proxy as MY_DOMAIN — expand slugs to full hostnames once.
SPORT_HOSTS=""
if [ -n "$VITE_SPORT_SUBDOMAINS" ]; then
  IFS=',' read -ra _SPORTS <<< "$VITE_SPORT_SUBDOMAINS"
  for _s in "${_SPORTS[@]}"; do
    _s=$(echo "$_s" | xargs)
    [ -n "$_s" ] && SPORT_HOSTS="${SPORT_HOSTS}${SPORT_HOSTS:+,}${_s}.${MY_DOMAIN}"
  done
fi

CORS_ORIGINS="${_SCHEME}://${MY_DOMAIN}"
if [ -n "$VITE_OTHER_DOMAINS" ]; then
  IFS=',' read -ra _EXTRA <<< "$VITE_OTHER_DOMAINS"
  for _d in "${_EXTRA[@]}"; do
    _d=$(echo "$_d" | xargs)
    CORS_ORIGINS="${CORS_ORIGINS} https://${_d}"
  done
fi
if [ -n "$SPORT_HOSTS" ]; then
  IFS=',' read -ra _SH <<< "$SPORT_HOSTS"
  for _d in "${_SH[@]}"; do
    CORS_ORIGINS="${CORS_ORIGINS} ${_SCHEME}://${_d}"
  done
fi

# ── PORT MATH ─────────────────────────────────────────────────────────────────
# Base port from env (default yogAIpilot: 50000)

BASE_PORT="${VITE_LOCAL_FUNCTIONS_PORT:-50000}"
FUNC_PORT="$BASE_PORT"
KONG_HTTP=$(( BASE_PORT ))
KONG_HTTPS=$(( BASE_PORT + 6000 ))
WEB_PORT=$(( BASE_PORT + 1000 ))
RT_PORT=$(( BASE_PORT + 2000 ))
PG_PORT=$(( BASE_PORT + 3000 ))
POOLER_PORT=$(( BASE_PORT + 4000 ))
POOLER_SESSION_PORT=$(( BASE_PORT + 5000 ))
STUDIO_PORT=$(( BASE_PORT + 7000 ))         # Caddy-protected Studio (auth required)
STUDIO_INTERNAL_PORT=$(( BASE_PORT + 7900 )) # Direct Studio port — never advertised

# ── STUDIO BASIC AUTH ─────────────────────────────────────────────────────────

_proj_env_file="${PROJECT_DIR}/.env"
PROXY_AUTH_USERNAME=$(_env_val DASHBOARD_USERNAME)
PROXY_AUTH_PASSWORD=$(_env_val DASHBOARD_PASSWORD)

# Fallback: read from Docker project .env
if [ "$REMOTE_MODE" = false ] && [ -f "$_proj_env_file" ]; then
  [ -z "$PROXY_AUTH_USERNAME" ] && PROXY_AUTH_USERNAME=$( (grep '^DASHBOARD_USERNAME=' "$_proj_env_file" 2>/dev/null | head -1 | cut -d'=' -f2-) || true)
  [ -z "$PROXY_AUTH_PASSWORD" ] && PROXY_AUTH_PASSWORD=$( (grep '^DASHBOARD_PASSWORD=' "$_proj_env_file" 2>/dev/null | head -1 | cut -d'=' -f2-) || true)
fi

[ -z "$PROXY_AUTH_USERNAME" ] && PROXY_AUTH_USERNAME="supabase"
if [ -z "$PROXY_AUTH_PASSWORD" ]; then
  # Generate a strong random password and try to persist it back to the env file
  PROXY_AUTH_PASSWORD=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 20)
  echo "🔑 Generated Studio password: ${PROXY_AUTH_PASSWORD}"
  echo "   Persisting DASHBOARD_PASSWORD to env file..."
  _persist_target="${_RESOLVED_ENV_FILE:-$WEB_SUPABASE_ENV}"
  if [ -n "$_persist_target" ] && [ -f "$_persist_target" ]; then
    if grep -q '^DASHBOARD_PASSWORD=' "$_persist_target"; then
      _sedi "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=\"${PROXY_AUTH_PASSWORD}\"|" "$_persist_target"
    else
      echo "DASHBOARD_PASSWORD=\"${PROXY_AUTH_PASSWORD}\"" >> "$_persist_target"
    fi
    echo "   ✅ Saved to: ${_persist_target}"
  else
    echo "   ⚠️  Add manually: DASHBOARD_PASSWORD=\"${PROXY_AUTH_PASSWORD}\""
  fi
fi

if command -v htpasswd >/dev/null 2>&1; then
  PROXY_AUTH_HASH=$(htpasswd -nbBC 14 "" "$PROXY_AUTH_PASSWORD" | cut -d: -f2)
elif command -v docker >/dev/null 2>&1; then
  PROXY_AUTH_HASH=$(docker run --rm caddy:latest caddy hash-password --plaintext "$PROXY_AUTH_PASSWORD" 2>/dev/null)
else
  echo "❌ Cannot generate bcrypt hash — install htpasswd or Docker"
  exit 1
fi

# ── SUMMARY ───────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Mode    : $([ "$REMOTE_MODE" = true ] && echo 'REMOTE (no local Docker Supabase)' || echo 'LOCAL (full Docker Supabase)')"
echo "  Project : ${VITE_SUPABASE_PROJECT_ID}"
echo "  Domain  : ${MY_DOMAIN}"
echo "  Supa URL: ${VITE_SUPABASE_URL}"
echo "  Ports   : func=${FUNC_PORT}  web=${WEB_PORT}  rt=${RT_PORT}"
if [ "$REMOTE_MODE" = false ]; then
  echo "            pg=${PG_PORT}  pooler=${POOLER_PORT}/${POOLER_SESSION_PORT}"
  echo "            kong=${KONG_HTTP}/${KONG_HTTPS}  studio=${STUDIO_PORT}"
fi
echo "  Web dir : ${WEB_DIR}"
echo "=========================================="
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# ── LOCAL MODE: SECRETS, PATCHING, BUILD ──────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$REMOTE_MODE" = false ] && [ "$CADDY_ONLY" = false ]; then

  [ -f .env ] || touch .env
  [ -f docker-compose.yml ] || { echo "❌ docker-compose.yml missing"; exit 1; }

  # Seed any KEY= lines missing from .env using the Supabase template's .env.example.
  # An existing project directory (e.g. from a prior run interrupted right after `mkdir`/
  # before the template was ever copied in, or one whose .env got emptied some other way)
  # can end up with a .env that's missing keys entirely — not just unset, but no line at
  # all. Every downstream step (generate-keys.sh, add-new-auth-keys.sh, and Postgres/GoTrue
  # reading POSTGRES_PORT/POSTGRES_DB/POSTGRES_HOST/etc. via docker compose) only ever
  # `sed -i` an existing "^KEY=" line or expects the var to already be defined — with no
  # line to match/substitute, those silently no-op or fall back to a blank string forever.
  # Seeding any missing keys from the template here breaks that stuck state.
  if [ -f "${SUPABASE_SRC}/docker/.env.example" ]; then
    while IFS= read -r _line; do
      case "$_line" in
        ''|'#'*) continue ;;
      esac
      _key="${_line%%=*}"
      grep -q "^${_key}=" .env 2>/dev/null && continue
      echo "$_line" >> .env
    done < "${SUPABASE_SRC}/docker/.env.example"
  fi

  # ── GENERATE SECRETS ──────────────────────────────────────────────────────

  _env_empty()      { local v; v=$(grep "^${1}=" .env 2>/dev/null | head -1 | cut -d'=' -f2-); [ -z "$v" ]; }
  _env_is_default() { grep -q "^${1}=.*your-super-secret" .env 2>/dev/null; }

  if _env_is_default "POSTGRES_PASSWORD" || _env_is_default "JWT_SECRET" || \
     _env_empty "POSTGRES_PASSWORD" || _env_empty "JWT_SECRET"; then
    echo "🔑 Generating base secrets..."
    if [ -f ./utils/generate-keys.sh ]; then
      sh ./utils/generate-keys.sh --update-env
      [ -d volumes/db/data ] && { echo "🗑️  Removing old DB data (password changed)..."; rm -rf volumes/db/data; }
      echo "✅ Base secrets generated"
    else
      echo "⚠️  utils/generate-keys.sh not found — please generate secrets manually"
    fi
  else
    echo "✅ Base secrets already set"
  fi

  # ── VERIFY JWT KEY SIGNATURES ─────────────────────────────────────────────

  _b64url_encode() { base64 -w0 | tr '+/' '-_' | tr -d '='; }

  _jwt_verify() {
    local token="$1" secret="$2" hp sig expected
    hp="${token%.*}"; sig="${token##*.}"
    expected=$(printf '%s' "$hp" | openssl dgst -sha256 -hmac "$secret" -binary | _b64url_encode)
    [ "$sig" = "$expected" ]
  }

  _jwt_sign() {
    local payload_json="$1" secret="$2" h p s
    h=$(printf '{"alg":"HS256","typ":"JWT"}' | _b64url_encode)
    p=$(printf '%s' "$payload_json" | _b64url_encode)
    s=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$secret" -binary | _b64url_encode)
    printf '%s.%s.%s\n' "$h" "$p" "$s"
  }

  _CUR_JWT_SECRET=$( (grep '^JWT_SECRET=' .env | head -1 | cut -d'=' -f2-) || true)
  _CUR_ANON_KEY=$( (grep '^ANON_KEY=' .env | head -1 | cut -d'=' -f2-) || true)

  if [ -n "$_CUR_ANON_KEY" ] && [ -n "$_CUR_JWT_SECRET" ]; then
    if ! _jwt_verify "$_CUR_ANON_KEY" "$_CUR_JWT_SECRET"; then
      echo "⚠️  ANON_KEY signature mismatch — regenerating JWT keys..."
      _NOW=$(date +%s); _EXP=$((_NOW + 157680000))
      _NEW_ANON=$(_jwt_sign "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":${_NOW},\"exp\":${_EXP}}" "$_CUR_JWT_SECRET")
      _NEW_SRK=$(_jwt_sign  "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":${_NOW},\"exp\":${_EXP}}" "$_CUR_JWT_SECRET")
      _sedi "s|^ANON_KEY=.*|ANON_KEY=${_NEW_ANON}|" .env
      _sedi "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${_NEW_SRK}|" .env
      echo "✅ JWT keys regenerated"
    else
      echo "✅ JWT key signatures verified"
    fi
  fi

  # ── AUTH KEYS ─────────────────────────────────────────────────────────────

  if _env_empty "SUPABASE_PUBLISHABLE_KEY" || _env_empty "JWT_KEYS"; then
    echo "🔑 Generating auth keys..."
    if [ -f ./utils/add-new-auth-keys.sh ]; then
      chmod +x ./utils/add-new-auth-keys.sh
      sh ./utils/add-new-auth-keys.sh --update-env
      echo "✅ Auth keys generated"
    else
      echo "⚠️  utils/add-new-auth-keys.sh not found — skipping"
    fi
  else
    echo "✅ Auth keys already set"
  fi

  # ── SYNC KEYS BACK TO .env.supabase ──────────────────────────────────────

  _sync_keys_to_env_supabase() {
    local supabase_env="${PROJECT_DIR}/${WEB_DIR}/.env.supabase"
    [ -f "$supabase_env" ] || return
    echo "🔄 Syncing generated keys to .env.supabase..."
    local ANON_KEY SERVICE_ROLE_KEY changed=false
    ANON_KEY=$( (grep '^ANON_KEY=' .env | head -1 | cut -d'=' -f2-) || true)
    SERVICE_ROLE_KEY=$( (grep '^SERVICE_ROLE_KEY=' .env | head -1 | cut -d'=' -f2-) || true)

    _upsert_senv() {
      local key="$1" val="$2" file="$3"
      [ -z "$val" ] && return
      local old_val; old_val=$( (grep "^${key}=" "$file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'") || true)
      if [ "$old_val" != "$val" ]; then
        if grep -q "^${key}=" "$file"; then
          _sedi "s|^${key}=.*|${key}=\"${val}\"|" "$file"
        else
          echo "${key}=\"${val}\"" >> "$file"
        fi
        echo "  ✏️  Updated ${key}"
        changed=true
      fi
    }

    _upsert_senv "VITE_SUPABASE_PUBLISHABLE_KEY" "$ANON_KEY" "$supabase_env"
    _upsert_senv "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY" "$supabase_env"

    # Deliberately local-only: never auto-commit or auto-push here. This previously ran
    # `git commit` + `git push origin` unattended whenever keys changed, which will push
    # whatever this particular run happened to generate — including a fresh bootstrap's
    # brand-new, unrelated local JWT keys — straight to the shared branch with no chance
    # to review. Surface the change and let a human decide whether it belongs in git.
    if [ "$changed" = true ]; then
      echo "  ⚠️  ${supabase_env} was updated locally to match this run's keys."
      echo "      This is NOT committed or pushed automatically — review the diff and"
      echo "      commit it yourself if these keys should be the new shared default:"
      echo "        cd \"${PROJECT_DIR}/${WEB_DIR}\" && git diff .env.supabase"
    fi
  }

  _sync_keys_to_env_supabase

  # ── UPDATE PROJECT .env ───────────────────────────────────────────────────

  echo "⚙️  Updating project .env..."
  _upsert_env() {
    local key="$1" val="$2"
    local ev; ev=$(printf '%s' "$val" | sed 's/[&/\\|]/\\&/g')
    if grep -q "^${key}=" .env; then
      _sedi "s|^${key}=.*|${key}=\"${ev}\"|" .env
    else
      echo "${key}=\"${val}\"" >> .env
    fi
  }

  _upsert_env "SUPABASE_PUBLIC_URL" "${_SCHEME}://${MY_SUPABASE_SUBDOMAIN}"
  _upsert_env "API_EXTERNAL_URL"    "${_SCHEME}://${MY_SUPABASE_SUBDOMAIN}"
  _upsert_env "PROXY_DOMAIN"        "${MY_DOMAIN}"

  # GoTrue (auth service) needs to know the frontend URL for CORS and email redirects
  _WEB_ORIGIN="${FRONTEND_URL:-${_SCHEME}://localhost:${WEB_PORT}}"
  _upsert_env "SITE_URL"                        "${_WEB_ORIGIN}"
  _upsert_env "ADDITIONAL_REDIRECT_URLS"        "${_WEB_ORIGIN},${_SCHEME}://localhost:${KONG_HTTP},${_SCHEME}://${MY_DOMAIN}"
  _upsert_env "GOTRUE_SITE_URL"                 "${_WEB_ORIGIN}"
  _upsert_env "GOTRUE_ADDITIONAL_REDIRECT_URLS" "${_WEB_ORIGIN},${_SCHEME}://localhost:${KONG_HTTP},${_SCHEME}://${MY_DOMAIN}"
  _upsert_env "KONG_HTTP_PORT"                "$KONG_HTTP"
  _upsert_env "KONG_HTTPS_PORT"               "$KONG_HTTPS"
  _upsert_env "POOLER_PROXY_PORT_TRANSACTION" "$POOLER_PORT"

  # Resend (replaces SMTP for yogAIpilot)
  [ -n "$RESEND_API_KEY"   ] && _upsert_env "RESEND_API_KEY"   "$RESEND_API_KEY"
  [ -n "$EMAIL_FROM"       ] && _upsert_env "EMAIL_FROM"        "$EMAIL_FROM"
  [ -n "$EMAIL_FROM_NAME"  ] && _upsert_env "EMAIL_FROM_NAME"   "$EMAIL_FROM_NAME"
  [ -n "$EMAIL_REPLY_TO"   ] && _upsert_env "EMAIL_REPLY_TO"    "$EMAIL_REPLY_TO"

  # yogAIpilot secrets
  [ -n "$OPENAI_API_KEY"              ] && _upsert_env "OPENAI_API_KEY"              "$OPENAI_API_KEY"
  [ -n "$STRIPE_LIVE"                 ] && _upsert_env "STRIPE_LIVE"                 "$STRIPE_LIVE"
  [ -n "$STRIPE_SECRET_KEY"           ] && _upsert_env "STRIPE_SECRET_KEY"           "$STRIPE_SECRET_KEY"
  [ -n "$STRIPE_WEBHOOK_SECRET"       ] && _upsert_env "STRIPE_WEBHOOK_SECRET"       "$STRIPE_WEBHOOK_SECRET"
  [ -n "$STRIPE_SECRET_KEY_SANDBOX"   ] && _upsert_env "STRIPE_SECRET_KEY_SANDBOX"   "$STRIPE_SECRET_KEY_SANDBOX"
  [ -n "$STRIPE_WEBHOOK_SECRET_SANDBOX" ] && _upsert_env "STRIPE_WEBHOOK_SECRET_SANDBOX" "$STRIPE_WEBHOOK_SECRET_SANDBOX"
  [ -n "$PAYPAL_LIVE"                 ] && _upsert_env "PAYPAL_LIVE"                 "$PAYPAL_LIVE"
  [ -n "$PAYPAL_CLIENT_ID"            ] && _upsert_env "PAYPAL_CLIENT_ID"            "$PAYPAL_CLIENT_ID"
  [ -n "$PAYPAL_CLIENT_SECRET"        ] && _upsert_env "PAYPAL_CLIENT_SECRET"        "$PAYPAL_CLIENT_SECRET"
  [ -n "$PAYPAL_CLIENT_ID_SANDBOX"    ] && _upsert_env "PAYPAL_CLIENT_ID_SANDBOX"    "$PAYPAL_CLIENT_ID_SANDBOX"
  [ -n "$PAYPAL_CLIENT_SECRET_SANDBOX"] && _upsert_env "PAYPAL_CLIENT_SECRET_SANDBOX" "$PAYPAL_CLIENT_SECRET_SANDBOX"
  [ -n "$FRONTEND_URL"                ] && _upsert_env "FRONTEND_URL"                "$FRONTEND_URL"
  [ -n "$PROJECT_SHORT_CODE"          ] && _upsert_env "PROJECT_SHORT_CODE"          "$PROJECT_SHORT_CODE"
  [ -n "$PAYMENT_TEST_USER"           ] && _upsert_env "PAYMENT_TEST_USER"           "$PAYMENT_TEST_USER"
  [ -n "$CREDENTIALS_ENCRYPTION_KEY"  ] && _upsert_env "CREDENTIALS_ENCRYPTION_KEY"  "$CREDENTIALS_ENCRYPTION_KEY"

  echo "✅ Project .env updated"

  # ── PATCH docker-compose.yml PORTS ────────────────────────────────────────

  echo "🔧 Patching external ports: pg=${PG_PORT} pooler=${POOLER_PORT}/${POOLER_SESSION_PORT}..."
  _sedi "s|\${POSTGRES_PORT}:5432|${PG_PORT}:5432|" docker-compose.yml
  _sedi "s|\${POOLER_PROXY_PORT_TRANSACTION}:6543|${POOLER_PORT}:6543|" docker-compose.yml
  # Studio does NOT need a host port — the dedicated Caddy auth container
  # reaches it by container name within the Docker Compose network
  echo "  Studio: no host port binding needed (Caddy studio-auth handles auth on ${STUDIO_PORT})"
  echo "✅ Ports patched"

  # ── PREFIX CONTAINER NAMES ────────────────────────────────────────────────

  echo "🏷️  Prefixing container names with ${_CONTAINER_PREFIX}..."
  # Plain "old:new" pairs instead of an associative array — `declare -A` needs bash 4+,
  # but macOS ships bash 3.2 as /bin/bash (Apple froze it there over GPLv3 and has never
  # shipped a newer one), so anything requiring bash 4 breaks on a default macOS checkout.
  _CONTAINER_RENAME_PAIRS="supabase-db:${_CONTAINER_PREFIX}-db
supabase-kong:${_CONTAINER_PREFIX}-kong
supabase-auth:${_CONTAINER_PREFIX}-auth
supabase-rest:${_CONTAINER_PREFIX}-rest
supabase-realtime:${_CONTAINER_PREFIX}-realtime
realtime-dev.supabase-realtime:${_CONTAINER_PREFIX}-realtime
supabase-storage:${_CONTAINER_PREFIX}-storage
supabase-imgproxy:${_CONTAINER_PREFIX}-imgproxy
supabase-studio:${_CONTAINER_PREFIX}-studio
supabase-meta:${_CONTAINER_PREFIX}-meta
supabase-edge-functions:${_CONTAINER_PREFIX}-edge-functions
supabase-analytics:${_CONTAINER_PREFIX}-analytics
supabase-vector:${_CONTAINER_PREFIX}-vector
supabase-pooler:${_CONTAINER_PREFIX}-pooler"
  KONG_YML="volumes/api/kong.yml"
  while IFS=':' read -r old_name new_name; do
    [ -z "$old_name" ] && continue
    _sedi "s|container_name: ${old_name}|container_name: ${new_name}|g" docker-compose.yml
    [ -f "$KONG_YML" ] && _sedi "s|${old_name}|${new_name}|g" "$KONG_YML"
  done <<EOF
${_CONTAINER_RENAME_PAIRS}
EOF
  echo "✅ Container names prefixed"

  # ── SYNC EDGE FUNCTIONS ───────────────────────────────────────────────────

  echo "🧠 Syncing edge functions..."
  mkdir -p volumes/functions
  if [ -d "${WEB_DIR}/supabase/functions" ]; then
    rsync -av --delete "${WEB_DIR}/supabase/functions/" volumes/functions/
    echo "✅ Functions synced"
  else
    echo "⚠️  No supabase/functions found in repo"
  fi

fi  # end REMOTE_MODE=false / CADDY_ONLY=false local block

# ═══════════════════════════════════════════════════════════════════════════════
# ── EDGE FUNCTIONS ENV OVERRIDE (both local and remote) ───────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$CADDY_ONLY" = false ]; then

  # Read actual anon/service keys — from local docker .env or web .env
  if [ "$REMOTE_MODE" = false ] && [ -f "${PROJECT_DIR}/.env" ]; then
    _LOCAL_ANON_KEY=$( (grep '^ANON_KEY=' "${PROJECT_DIR}/.env" | head -1 | cut -d'=' -f2-) || true)
    _LOCAL_SERVICE_KEY=$( (grep '^SERVICE_ROLE_KEY=' "${PROJECT_DIR}/.env" | head -1 | cut -d'=' -f2-) || true)
  else
    _LOCAL_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"
    _LOCAL_SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
  fi
  _EFFECTIVE_SUPABASE_URL="${VITE_SUPABASE_URL}"
  [ "$REMOTE_MODE" = false ] && _EFFECTIVE_SUPABASE_URL="${_SCHEME}://${MY_SUPABASE_SUBDOMAIN}"
  # SUPABASE_URL above is the public-facing URL (used for links/redirects visible to end users).
  # Edge functions calling back into Auth/PostgREST/etc. from *inside* the Docker network must use
  # Kong's internal service alias instead — "http://localhost:<port>" from inside the functions
  # container means the functions container itself, not the host, causing ECONNREFUSED. Only
  # meaningful in local mode; in --remote mode there's no local Kong to reach.
  _INTERNAL_SUPABASE_URL=""
  [ "$REMOTE_MODE" = false ] && _INTERNAL_SUPABASE_URL="http://kong:8000"

  echo "🔧 Writing edge-functions env override (docker-compose.functions-env.yml)..."

  cat > "${PROJECT_DIR}/docker-compose.functions-env.yml" << EOF
services:
  functions:
    environment:
      # ── Supabase ──────────────────────────────────────────────────────────
      SUPABASE_URL: ${_EFFECTIVE_SUPABASE_URL}
      SUPABASE_INTERNAL_URL: ${_INTERNAL_SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${_LOCAL_SERVICE_KEY}
      SUPABASE_ANON_KEY: ${_LOCAL_ANON_KEY}
      # ── Email (Resend) ────────────────────────────────────────────────────
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME}
      EMAIL_REPLY_TO: ${EMAIL_REPLY_TO}
      # ── AI ────────────────────────────────────────────────────────────────
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      # ── Stripe ────────────────────────────────────────────────────────────
      STRIPE_LIVE: ${STRIPE_LIVE}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      STRIPE_SECRET_KEY_SANDBOX: ${STRIPE_SECRET_KEY_SANDBOX}
      STRIPE_WEBHOOK_SECRET_SANDBOX: ${STRIPE_WEBHOOK_SECRET_SANDBOX}
      # ── PayPal ────────────────────────────────────────────────────────────
      PAYPAL_LIVE: ${PAYPAL_LIVE}
      PAYPAL_CLIENT_ID: ${PAYPAL_CLIENT_ID}
      PAYPAL_CLIENT_SECRET: ${PAYPAL_CLIENT_SECRET}
      PAYPAL_CLIENT_ID_SANDBOX: ${PAYPAL_CLIENT_ID_SANDBOX}
      PAYPAL_CLIENT_SECRET_SANDBOX: ${PAYPAL_CLIENT_SECRET_SANDBOX}
      # ── App ───────────────────────────────────────────────────────────────
      FRONTEND_URL: ${FRONTEND_URL:-${_SCHEME}://${MY_DOMAIN}}
      PROJECT_SHORT_CODE: ${PROJECT_SHORT_CODE:-STUDIO}
      PAYMENT_TEST_USER: ${PAYMENT_TEST_USER}
      CREDENTIALS_ENCRYPTION_KEY: ${CREDENTIALS_ENCRYPTION_KEY}
EOF

  echo "✅ docker-compose.functions-env.yml written"
fi

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.functions-env.yml -f docker-compose.web.yml"

# ═══════════════════════════════════════════════════════════════════════════════
# ── DOCKERFILE & WEB COMPOSE (skipped in caddy-only and supabase-only modes) ──
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$CADDY_ONLY" = false ] && [ "$SUPABASE_ONLY" = false ]; then

  echo "🐳 Writing Dockerfile & configs..."
  mkdir -p "${PROJECT_DIR}/${WEB_DIR}/deploy"

  # ── Production Dockerfile ──────────────────────────────────────────────────
  cat > "${PROJECT_DIR}/${WEB_DIR}/deploy/Dockerfile" << 'DEOF'
# Stage 1: Build Vite frontend (uses Bun — matches bun.lockb in the repo)
FROM oven/bun:1 AS frontend-build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_USE_LOCAL_FUNCTIONS=false
ARG VITE_FUNCTIONS_URL
ARG VITE_REALTIME_WORKER_URL_CLOUDFLARE
RUN bun run build

# Stage 2: Deno + nginx (realtime-chat runs as a regular Deno edge function now — no wrangler)
FROM denoland/deno:2.0.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends nginx curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY --from=frontend-build /app/dist /var/www/html
COPY deploy/nginx-app.conf /etc/nginx/sites-available/default
WORKDIR /app
COPY supabase/functions ./supabase/functions
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80 8907
ENTRYPOINT ["/entrypoint.sh"]
DEOF

  # ── Dev Dockerfile ─────────────────────────────────────────────────────────
  cat > "${PROJECT_DIR}/${WEB_DIR}/deploy/Dockerfile.dev" << 'DEVDEOF'
FROM oven/bun:1
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://dl.deno.land/release/latest/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /usr/local/bin && rm /tmp/deno.zip && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
COPY deploy/entrypoint-dev.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80 8907
ENTRYPOINT ["/entrypoint.sh"]
DEVDEOF

  # ── Entrypoints ────────────────────────────────────────────────────────────
  cat > "${PROJECT_DIR}/${WEB_DIR}/deploy/entrypoint.sh" << 'EEOF'
#!/bin/bash
set -e
echo "[entrypoint] Starting nginx..."
nginx
echo "[entrypoint] Starting Deno edge functions on port ${VITE_LOCAL_FUNCTIONS_PORT:-8907}..."
cd /app
deno run --allow-net --allow-env --allow-read=. supabase/functions/_shared/serve.ts 2>/dev/null || true &
# Fallback: serve all functions via supabase-local shim if serve.ts absent
ls supabase/functions/*/index.ts 2>/dev/null | while read fn; do
  name=$(basename "$(dirname "$fn")")
  deno serve --allow-net --allow-env --allow-read=. --port ${VITE_LOCAL_FUNCTIONS_PORT:-8907} "$fn" &
done 2>/dev/null || true
echo "[entrypoint] All services started."
exec tail -f /var/log/nginx/access.log /var/log/nginx/error.log
EEOF

  cat > "${PROJECT_DIR}/${WEB_DIR}/deploy/entrypoint-dev.sh" << 'DEVEOF'
#!/bin/bash
set -e
echo "[entrypoint-dev] Starting Deno edge functions on port ${VITE_LOCAL_FUNCTIONS_PORT:-8907}..."
cd /app
ls supabase/functions/*/index.ts 2>/dev/null | while read fn; do
  deno run --allow-net --allow-env --allow-read=. "$fn" &
done || true
echo "[entrypoint-dev] Starting Vite dev server on port 80..."
exec bun run dev --host 0.0.0.0 --port 80
DEVEOF

  # ── nginx ──────────────────────────────────────────────────────────────────
  cat > "${PROJECT_DIR}/${WEB_DIR}/deploy/nginx-app.conf" << 'NEOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Supabase edge functions proxy (includes realtime-chat, a WebSocket-upgrading function —
    # Upgrade/Connection headers are safe on plain HTTP requests too, nginx only upgrades when
    # the client actually sends the Upgrade header).
    location /functions/v1/ {
        proxy_pass http://127.0.0.1:8907/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NEOF

  # ── docker-compose.web.yml ─────────────────────────────────────────────────

  _ANON_KEY="${_LOCAL_ANON_KEY:-$VITE_SUPABASE_PUBLISHABLE_KEY}"
  _SVC_KEY="${_LOCAL_SERVICE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}"
  _SUPA_URL="${_EFFECTIVE_SUPABASE_URL:-$VITE_SUPABASE_URL}"
  [ "$DEV_MODE" = true ] && _DOCKERFILE="deploy/Dockerfile.dev" || _DOCKERFILE="deploy/Dockerfile"

  echo "🔧 Writing docker-compose.web.yml..."
  cat > "${PROJECT_DIR}/docker-compose.web.yml" << EOF
services:
  web:
    container_name: ${_CONTAINER_PREFIX}-web
    build:
      context: ./${WEB_DIR}
      dockerfile: ${_DOCKERFILE}
      args:
        VITE_SUPABASE_URL: ${_SUPA_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${_ANON_KEY}
        VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID}
        VITE_USE_LOCAL_FUNCTIONS: "false"
        VITE_FUNCTIONS_URL: ${_SCHEME}://${MY_DOMAIN}/functions/v1
        VITE_REALTIME_WORKER_URL_CLOUDFLARE: ${_SCHEME}://${MY_DOMAIN}/realtime
    restart: unless-stopped
    ports:
      - "${WEB_PORT}:80"
    environment:
      SUPABASE_URL: ${_SUPA_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${_SVC_KEY}
      VITE_LOCAL_FUNCTIONS_PORT: "${FUNC_PORT}"
      VITE_SUPABASE_URL: ${_SUPA_URL}
      VITE_SUPABASE_PUBLISHABLE_KEY: ${_ANON_KEY}
      VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID}
      VITE_USE_LOCAL_FUNCTIONS: "false"
      VITE_FUNCTIONS_URL: ${_SCHEME}://${MY_DOMAIN}/functions/v1
      VITE_REALTIME_WORKER_URL_CLOUDFLARE: ${_SCHEME}://${MY_DOMAIN}/realtime
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      RESEND_API_KEY: ${RESEND_API_KEY}
      STRIPE_LIVE: ${STRIPE_LIVE}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      PAYPAL_LIVE: ${PAYPAL_LIVE}
      PAYPAL_CLIENT_ID: ${PAYPAL_CLIENT_ID}
      PAYPAL_CLIENT_SECRET: ${PAYPAL_CLIENT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL:-${_SCHEME}://${MY_DOMAIN}}
      PROJECT_SHORT_CODE: ${PROJECT_SHORT_CODE:-STUDIO}
EOF

  if [ "$DEV_MODE" = true ]; then
    cat >> "${PROJECT_DIR}/docker-compose.web.yml" << EOF
    volumes:
      - ./${WEB_DIR}/src:/app/src
      - ./${WEB_DIR}/public:/app/public
      - ./${WEB_DIR}/index.html:/app/index.html
      - ./${WEB_DIR}/supabase/functions:/app/supabase/functions
EOF
    echo "  📂 Dev volumes mounted for HMR"
  fi

  echo "✅ docker-compose.web.yml written"

fi  # end CADDY_ONLY=false && SUPABASE_ONLY=false (dockerfile/compose write)

# ── Supabase-only: skip Caddy entirely (no web traffic to route) ───────────────
if [ "$SUPABASE_ONLY" = true ]; then
  echo ""
  echo "⏩ Skipping Caddy config (supabase-only mode)"
  # Jump straight to the done block after migrations + realtime tenant fix run below.
fi

if [ "$SUPABASE_ONLY" = false ]; then

# ═══════════════════════════════════════════════════════════════════════════════
# ── CADDY CONFIG ──────────────────────────────════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════════

echo "🌐 Writing Caddy snippet..."
mkdir -p "$CADDY_DIR"

REDIR_BLOCKS=""
if [ -n "$VITE_OTHER_DOMAINS" ]; then
  IFS=',' read -ra _REDIR <<< "$VITE_OTHER_DOMAINS"
  for _rd in "${_REDIR[@]}"; do
    _rd=$(echo "$_rd" | xargs)
    REDIR_BLOCKS="${REDIR_BLOCKS}
${_rd} {
    redir ${_SCHEME}://${MY_DOMAIN}{uri} permanent
}
"
  done
fi

# In remote mode the Supabase API is served externally; we only proxy the web app
if [ "$REMOTE_MODE" = true ]; then

  cat > "$CADDY_DIR/${VITE_SUPABASE_PROJECT_ID}.caddy" << EOF
# === ${VITE_SUPABASE_PROJECT_ID} (remote Supabase) ===
# Auto-generated by deploy.sh — do not edit manually

${MY_DOMAIN}${SPORT_HOSTS:+, ${SPORT_HOSTS}} {
    reverse_proxy localhost:${WEB_PORT}
}
${REDIR_BLOCKS}
EOF

else

  cat > "$CADDY_DIR/${VITE_SUPABASE_PROJECT_ID}.caddy" << EOF
# === ${VITE_SUPABASE_PROJECT_ID} ===
# Auto-generated by deploy.sh — do not edit manually

${MY_DOMAIN}${SPORT_HOSTS:+, ${SPORT_HOSTS}} {
    reverse_proxy localhost:${WEB_PORT}
}
${REDIR_BLOCKS}
${MY_SUPABASE_SUBDOMAIN} {

    @supabase_api path /auth/v1/* /rest/v1/* /graphql/v1 /realtime/v1/* /storage/v1/* /functions/v1/* /mcp /sso/*

    @cors_allowed header_regexp origin Origin ^(https://(${MY_DOMAIN//./\\.}$(echo "$VITE_OTHER_DOMAINS" | sed 's/,/|/g; s/\./\\./g; s/^/|/; s/  *//g')$(echo "$SPORT_HOSTS" | sed 's/,/|/g; s/\./\\./g; s/^/|/; s/  *//g'))|http://localhost(:[0-9]+)?)\$

    @options method OPTIONS
    handle @options {
        header @cors_allowed Access-Control-Allow-Origin "{http.request.header.Origin}"
        header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        header Access-Control-Allow-Headers "apikey, authorization, content-type, x-client-info, x-supabase-api-version, x-local-dev, prefer, range, x-upsert, accept-profile, content-profile, x-retry-count"
        header Access-Control-Expose-Headers "content-range, range, x-total-count"
        header Access-Control-Max-Age "3600"
        header Vary Origin
        respond 204
    }

    handle @supabase_api {
        header @cors_allowed Access-Control-Allow-Origin "{http.request.header.Origin}"
        header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        header Access-Control-Allow-Headers "apikey, authorization, content-type, x-client-info, x-supabase-api-version, x-local-dev, prefer, range, x-upsert, accept-profile, content-profile, x-retry-count"
        header Access-Control-Expose-Headers "content-range, range, x-total-count"
        header Access-Control-Max-Age "3600"
        header Vary Origin
        reverse_proxy localhost:${KONG_HTTP} {
            header_down -Access-Control-Allow-Origin
            header_down -Access-Control-Allow-Methods
            header_down -Access-Control-Allow-Headers
            header_down -Access-Control-Allow-Credentials
            header_down -Access-Control-Expose-Headers
            header_down -Access-Control-Max-Age
        }
    }

    handle {
        basic_auth {
            ${PROXY_AUTH_USERNAME} ${PROXY_AUTH_HASH}
        }
        reverse_proxy localhost:${STUDIO_INTERNAL_PORT}
    }

    header -server
}
EOF

fi  # remote/local caddy block

echo "✅ Written: $CADDY_DIR/${VITE_SUPABASE_PROJECT_ID}.caddy"

# ── ASSEMBLE MASTER CADDYFILE ─────────────────────────────────────────────────

echo "📦 Assembling master Caddyfile..."
MASTER_CADDYFILE="$CADDY_DIR/Caddyfile"
cat > "$MASTER_CADDYFILE" << 'HEADEREOF'
# Master Caddyfile — auto-assembled from project snippets
# Do not edit manually; each project's deploy.sh writes its own .caddy file
HEADEREOF
for snippet in "$CADDY_DIR"/*.caddy; do
  [ -f "$snippet" ] || continue
  echo "" >> "$MASTER_CADDYFILE"
  cat "$snippet" >> "$MASTER_CADDYFILE"
done
echo "✅ Master Caddyfile: $MASTER_CADDYFILE ($(grep -c '{' "$MASTER_CADDYFILE") blocks)"

mkdir -p "${PROJECT_DIR}/volumes/proxy/caddy"
cp "$MASTER_CADDYFILE" "${PROJECT_DIR}/volumes/proxy/caddy/Caddyfile"

fi  # end SUPABASE_ONLY=false (Caddy config block)

# Jump to Caddy reload if caddy-only
if [ "$CADDY_ONLY" = true ]; then
  echo "⏩ Caddy-only — skipping build"
else

# ═══════════════════════════════════════════════════════════════════════════════
# ── BUILD & START ─────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$SUPABASE_ONLY" = true ]; then
  # ── Supabase-only: bring up the Supabase stack without the web container ──────
  SUPA_FILES="-f docker-compose.yml -f docker-compose.functions-env.yml"
  echo "🐘 Starting Supabase stack (no web container)..."
  # No `down` first — `up -d` already recreates only the services whose
  # config actually changed instead of stopping the whole stack every time.
  docker compose ${SUPA_FILES} up -d --remove-orphans
  echo "✅ Supabase stack started"
  echo ""
  echo "   Connect your local dev server:"
  echo "   VITE_SUPABASE_URL=http://localhost:${KONG_HTTP}"
  echo "   VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from ${PROJECT_DIR}/.env>"
  echo "   VITE_LOCAL_FUNCTIONS_PORT=${FUNC_PORT}"
  echo "   VITE_REALTIME_WORKER_URL_LOCAL=http://localhost:${RT_PORT}"
else
  echo "🚀 Building web app..."
  docker compose ${COMPOSE_FILES} build web || { echo "❌ Build failed"; exit 1; }

  echo "🔄 Restarting services..."
  # No `down` first — see the comment above the local-mode bootstrap for why:
  # `up -d` diffs each service's config and only recreates what changed, so a
  # full-stack stop/start on every deploy was pure unnecessary downtime.
  if [ "$REMOTE_MODE" = true ]; then
    # Remote: only start web container (no Supabase stack)
    docker compose -f docker-compose.web.yml up -d --remove-orphans
  else
    docker compose ${COMPOSE_FILES} up -d --remove-orphans
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# ── STUDIO AUTH PROXY (dedicated Caddy in Docker Compose network) ─────────────
# ═══════════════════════════════════════════════════════════════════════════════
# The shared Caddy (--network host) runs in the Docker VM — its ports are NOT
# forwarded to Windows/WSL via Docker's port publishing.
# A dedicated per-project Caddy container is used instead:
#   • Joined to the Supabase Compose network → reaches Studio by container name
#   • Published via -p 127.0.0.1:${STUDIO_PORT}:${STUDIO_PORT} → accessible from Windows/WSL
#   • Enforces basic_auth with the same bcrypt hash

if [ "$REMOTE_MODE" = false ] && [ "$CADDY_ONLY" = false ]; then

  _STUDIO_CADDY_DIR="${PROJECT_DIR}/studio-auth"
  mkdir -p "$_STUDIO_CADDY_DIR"

  # Generate the Caddy-format hash (base64-bcrypt, NOT htpasswd format)
  _STUDIO_CADDY_HASH=$(docker run --rm caddy:latest caddy hash-password --plaintext "$PROXY_AUTH_PASSWORD" 2>/dev/null)
  if [ -z "$_STUDIO_CADDY_HASH" ]; then
    echo "❌ Could not generate Caddy password hash for Studio"
    exit 1
  fi

  # Write Caddyfile via env vars — avoids ALL shell $ interpolation in the hash
  CADDY_OUT="$_STUDIO_CADDY_DIR/Caddyfile" \
  CADDY_PORT="$STUDIO_PORT" \
  CADDY_PREFIX="$_CONTAINER_PREFIX" \
  CADDY_USER="$PROXY_AUTH_USERNAME" \
  CADDY_HASH="$_STUDIO_CADDY_HASH" \
  python3 -c "
import os
out   = os.environ['CADDY_OUT']
port  = os.environ['CADDY_PORT']
pre   = os.environ['CADDY_PREFIX']
user  = os.environ['CADDY_USER']
phash = os.environ['CADDY_HASH']
with open(out, 'w') as f:
    f.write(f'''{{
    admin off
    auto_https off
}}

:{port} {{
    basic_auth {{
        {user} {phash}
    }}
    reverse_proxy {pre}-studio:3000
    header -server
}}
''')
print(f'Studio Caddyfile written ({phash[:12]}...)')
"

  # Recreate the Studio auth container (always fresh so config/hash is current)
  docker rm -f "${_CONTAINER_PREFIX}-studio-auth" 2>/dev/null || true

  docker run -d \
    --name "${_CONTAINER_PREFIX}-studio-auth" \
    --network "${COMPOSE_PROJECT_NAME}_default" \
    -p "127.0.0.1:${STUDIO_PORT}:${STUDIO_PORT}" \
    --restart unless-stopped \
    -v "$_STUDIO_CADDY_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
    caddy:latest

  echo "✅ Studio auth proxy (Caddy): http://localhost:${STUDIO_PORT}  (${PROXY_AUTH_USERNAME} / ${PROXY_AUTH_PASSWORD})"

fi

# ═══════════════════════════════════════════════════════════════════════════════
# ── RUN MIGRATIONS ────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

MIGRATIONS_DIR="${PROJECT_DIR}/${WEB_DIR}/supabase/migrations"

if [ -d "$MIGRATIONS_DIR" ] && [ "$(ls -A "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)" -gt 0 ]; then
  echo ""
  echo "📦 Running database migrations..."
  echo "   Found: $(ls "$MIGRATIONS_DIR"/*.sql | wc -l) migration files"

  # Every file used to be replayed through psql on every single deploy —
  # harmless for the (large majority) idempotent `IF NOT EXISTS`-guarded
  # ones, but 193 files' worth of `psql`/`docker exec` process spawns adds
  # real time to every deploy, and the handful of non-idempotent statements
  # would re-error (silently, via ON_ERROR_STOP=0) every single run. This
  # tracking table makes each file run at most once: any file not yet
  # recorded here still runs (so the very first deploy after this change
  # replays the full history exactly once, self-bootstrapping the table —
  # no fragile "is this a fresh DB?" guess needed), but every deploy after
  # that only touches genuinely new migration files.
  _MIGRATIONS_TABLE_SQL="CREATE TABLE IF NOT EXISTS public._deploy_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

  if [ "$REMOTE_MODE" = true ]; then
    # ── Remote: run migrations via psql against remote DB URL ────────────────
    if [ -z "$DB_URL" ]; then
      echo "⚠️  DB_URL not set in .env.supabase — skipping migrations for remote mode"
      echo "   To run manually:  psql \"\$DB_URL\" -f supabase/migrations/*.sql"
    else
      echo "🔌 Connecting to remote database..."
      psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$_MIGRATIONS_TABLE_SQL" >/dev/null
      _applied=$(psql "$DB_URL" -tAc "SELECT filename FROM public._deploy_migrations;" 2>/dev/null || true)
      _ran=0; _skipped=0
      for _mig in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
        _name=$(basename "$_mig")
        if grep -qx "$_name" <<< "$_applied"; then
          _skipped=$(( _skipped + 1 ))
          continue
        fi
        echo "  → $_name"
        psql "$DB_URL" -v ON_ERROR_STOP=0 -f "$_mig" 2>&1 | grep -v "^$" | head -5 || true
        psql "$DB_URL" -v ON_ERROR_STOP=1 -c \
          "INSERT INTO public._deploy_migrations (filename) VALUES ('${_name}') ON CONFLICT DO NOTHING;" >/dev/null
        _ran=$(( _ran + 1 ))
      done
      echo "✅ Migrations applied to remote database (${_ran} run, ${_skipped} already applied)"
    fi

  else
    # ── Local: wait for DB, then run migrations ───────────────────────────────
    _DB_CONTAINER="${_CONTAINER_PREFIX}-db"
    echo "⏳ Waiting for Postgres container (${_DB_CONTAINER}) to be ready..."
    for _i in $(seq 1 60); do
      docker exec "$_DB_CONTAINER" pg_isready -U supabase_admin -q 2>/dev/null && break
      printf "  [%d/60] waiting...\r" "$_i"
      sleep 2
    done
    echo ""
    echo "🔌 Running migrations via psql inside container..."
    _MIGRATION_LOG="${PROJECT_DIR}/migration.log"
    true > "$_MIGRATION_LOG"
    _errors=0; _ran=0; _skipped=0
    docker exec -i "$_DB_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
      -c "$_MIGRATIONS_TABLE_SQL" >/dev/null
    _applied=$(docker exec -i "$_DB_CONTAINER" psql -U supabase_admin -d postgres -tAc \
      "SELECT filename FROM public._deploy_migrations;" 2>/dev/null || true)
    for _mig in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
      _name=$(basename "$_mig")
      if grep -qx "$_name" <<< "$_applied"; then
        _skipped=$(( _skipped + 1 ))
        continue
      fi
      printf "  → %-60s" "$_name"
      if docker exec -i "$_DB_CONTAINER" psql -U supabase_admin -d postgres \
           -v ON_ERROR_STOP=0 \
           < "$_mig" >> "$_MIGRATION_LOG" 2>&1; then
        echo "✓"
        docker exec -i "$_DB_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c \
          "INSERT INTO public._deploy_migrations (filename) VALUES ('${_name}') ON CONFLICT DO NOTHING;" >/dev/null
        _ran=$(( _ran + 1 ))
      else
        echo "⚠️  (check migration.log)"
        _errors=$(( _errors + 1 ))
      fi
    done
    if [ "$_errors" -eq 0 ]; then
      echo "✅ Migrations applied (${_ran} run, ${_skipped} already applied)"
    else
      echo "⚠️  ${_errors} migration(s) had warnings — check ${_MIGRATION_LOG} (${_ran} run, ${_skipped} already applied)"
    fi
  fi

else
  echo "ℹ️  No migration files found in ${MIGRATIONS_DIR}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# ── FIX REALTIME TENANT ID (local only) ───────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$REMOTE_MODE" = false ]; then

  _RT_EXPECTED="${_CONTAINER_PREFIX}-realtime"
  _RT_DB_CONTAINER="${_CONTAINER_PREFIX}-db"

  echo "🔗 Checking Realtime tenant ID..."
  for _i in $(seq 1 30); do
    _RT_CURRENT=$(docker exec "$_RT_DB_CONTAINER" psql -U supabase_admin -d postgres -tAc \
      "SELECT external_id FROM _realtime.tenants LIMIT 1;" 2>/dev/null || true)
    _RT_CURRENT=$(echo "$_RT_CURRENT" | tr -d '[:space:]')
    [ -n "$_RT_CURRENT" ] && break
    echo "  ⏳ Waiting for Realtime tenant... (${_i}/30)"
    sleep 2
  done

  if [ "$_RT_CURRENT" = "realtime-dev" ]; then
    echo "  ⚠️  Renaming tenant 'realtime-dev' → '${_RT_EXPECTED}'..."
    docker exec "$_RT_DB_CONTAINER" psql -U supabase_admin -d postgres -c "
      BEGIN;
      ALTER TABLE _realtime.extensions DROP CONSTRAINT extensions_tenant_external_id_fkey;
      DELETE FROM _realtime.extensions WHERE tenant_external_id = '${_RT_EXPECTED}';
      UPDATE _realtime.extensions SET tenant_external_id = '${_RT_EXPECTED}' WHERE tenant_external_id = 'realtime-dev';
      DELETE FROM _realtime.tenants WHERE external_id = '${_RT_EXPECTED}';
      UPDATE _realtime.tenants SET external_id = '${_RT_EXPECTED}' WHERE external_id = 'realtime-dev';
      ALTER TABLE _realtime.extensions ADD CONSTRAINT extensions_tenant_external_id_fkey
        FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id);
      COMMIT;
    "
    docker restart "${_CONTAINER_PREFIX}-realtime" 2>/dev/null || true
    echo "  ✅ Realtime tenant renamed"
  elif [ "$_RT_CURRENT" = "$_RT_EXPECTED" ]; then
    echo "  ✅ Realtime tenant ID correct"
  else
    echo "  ℹ️  Realtime tenant: ${_RT_CURRENT:-not seeded yet}"
  fi

fi  # remote_mode check for realtime tenant

# ═══════════════════════════════════════════════════════════════════════════════
# ── DEPLOY EDGE FUNCTIONS (remote mode only) ───────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$REMOTE_MODE" = true ] && command -v supabase >/dev/null 2>&1; then
  echo ""
  echo "🧠 Deploying edge functions to remote Supabase..."
  cd "${PROJECT_DIR}/${WEB_DIR}"
  for _fn_dir in supabase/functions/*/; do
    _fn=$(basename "$_fn_dir")
    [[ "$_fn" == _* ]] && continue  # skip _shared etc.
    printf "  → deploying %-30s" "$_fn"
    if supabase functions deploy "$_fn" --project-ref "$VITE_SUPABASE_PROJECT_ID" --no-verify-jwt 2>/dev/null; then
      echo "✓"
    else
      echo "⚠️  (may need supabase login or project-ref)"
    fi
  done
  cd - >/dev/null
  echo "✅ Edge functions deployed"
elif [ "$REMOTE_MODE" = true ]; then
  echo ""
  echo "ℹ️  Supabase CLI not found — skipping remote function deploy"
  echo "   Install: https://supabase.com/docs/guides/cli"
  echo "   Then run: supabase functions deploy --project-ref ${VITE_SUPABASE_PROJECT_ID}"
fi

fi  # end CADDY_ONLY check (build/run/migrate block)

if [ "$SUPABASE_ONLY" = false ]; then

# ═══════════════════════════════════════════════════════════════════════════════
# ── CADDY REVERSE PROXY ────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

CADDY_CONTAINER="caddy-reverse-proxy"
echo "🌐 Starting/reloading Caddy..."

if docker ps -a --format '{{.Names}}' | grep -q "^${CADDY_CONTAINER}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${CADDY_CONTAINER}$"; then
    docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker restart "$CADDY_CONTAINER"
  else
    docker start "$CADDY_CONTAINER"
  fi
else
  docker run -d \
    --name "$CADDY_CONTAINER" \
    --network host \
    --restart unless-stopped \
    -v "$CADDY_DIR/Caddyfile":/etc/caddy/Caddyfile:ro \
    -v caddy_data:/data \
    -v caddy_config:/config \
    caddy:latest
fi
echo "✅ Caddy running"

if [ "$CADDY_ONLY" = true ]; then
  echo ""
  echo "✅ Caddy-only update complete"
  echo "🌐 Website  : ${_SCHEME}://${MY_DOMAIN}"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# ── AUTO-DEPLOY WATCHER ────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

cat > "${PROJECT_DIR}/auto-deploy.sh" << WATCHEOF
#!/bin/bash
set -e
APP_DIR="./${WEB_DIR}"
BRANCH="${MY_APP_BRANCH}"
REMOTE_FLAG="$([ "$REMOTE_MODE" = true ] && echo '--remote' || echo '')"

while true; do
  cd "\$APP_DIR"
  git fetch origin
  LOCAL=\$(git rev-parse HEAD)
  REMOTE=\$(git rev-parse origin/\$BRANCH)
  if [ "\$LOCAL" != "\$REMOTE" ]; then
    echo "🚀 New version detected → redeploying..."
    git reset --hard origin/\$BRANCH
    cd - >/dev/null
    docker compose ${COMPOSE_FILES} build web
    docker compose ${COMPOSE_FILES} up -d web
    echo "✅ Redeployed"
  else
    cd - >/dev/null
  fi
  sleep 30
done
WATCHEOF
chmod +x "${PROJECT_DIR}/auto-deploy.sh"

if [ "$NO_GIT" = true ]; then
  echo "📌 Skipping auto-deploy watcher (--no-git)"
elif ! pgrep -f "auto-deploy.sh" > /dev/null; then
  echo "👀 Starting auto-deploy watcher..."
  nohup "${PROJECT_DIR}/auto-deploy.sh" > "${PROJECT_DIR}/auto-deploy.log" 2>&1 &
else
  echo "✅ Auto-deploy watcher already running"
fi

fi  # end SUPABASE_ONLY=false (Caddy + auto-deploy watcher)

# ═══════════════════════════════════════════════════════════════════════════════
# ── DONE ──────────────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════"
if [ "$SUPABASE_ONLY" = true ]; then
  echo "  ✅ Supabase stack running  (no web container)"
  echo "══════════════════════════════════════════════════════════════════"
  echo "  🧠 Supabase API : http://localhost:${KONG_HTTP}"
  echo "  🎛️  Studio       : http://localhost:${STUDIO_PORT}"
  echo "                     user: ${PROXY_AUTH_USERNAME}  pass: ${PROXY_AUTH_PASSWORD}"
  echo "  🐘 Postgres      : postgresql://postgres@localhost:${PG_PORT}/postgres"
  echo "  ⚡ Functions     : http://localhost:${KONG_HTTP}/functions/v1/"
  echo ""
  echo "  Run your local frontend:"
  echo "    VITE_SUPABASE_URL=http://localhost:${KONG_HTTP} bun dev"
else
  echo "  ✅ yogAIpilot deployment complete"
  echo "══════════════════════════════════════════════════════════════════"
  if [ "$REMOTE_MODE" = false ]; then
    echo "  🌐 Website      : ${_SCHEME}://localhost:${WEB_PORT}"
    echo "  🧠 Supabase API : ${_SCHEME}://localhost:${KONG_HTTP}"
    echo "  🎛️  Studio       : ${_SCHEME}://localhost:${STUDIO_PORT}"
    echo "                     user: ${PROXY_AUTH_USERNAME}  pass: ${PROXY_AUTH_PASSWORD}"
    echo "  🐘 Postgres      : postgresql://postgres@localhost:${PG_PORT}/postgres"
    echo "  ⚡ Functions     : ${_SCHEME}://localhost:${KONG_HTTP}/functions/v1/"
    echo "  🔄 Realtime      : $( [ "$_SCHEME" = "https" ] && echo "wss" || echo "ws" )://localhost:${RT_PORT}"
    if [ "$_SCHEME" = "https" ]; then
      echo "  🌍 Via Caddy     : ${_SCHEME}://${MY_DOMAIN}  supabase: https://${MY_SUPABASE_SUBDOMAIN}"
      echo "  📁 Caddy config  : ${CADDY_DIR}"
    fi
  else
    echo "  🌐 Website      : ${_SCHEME}://localhost:${WEB_PORT}"
    echo "  🧠 Supabase     : ${VITE_SUPABASE_URL}  (remote)"
    echo "  ⚡ Functions    : ${VITE_SUPABASE_URL}/functions/v1/"
  fi
fi
echo "══════════════════════════════════════════════════════════════════"
