#!/usr/bin/env bash
set -euo pipefail

NODE_REQUIRED=20

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$1"; }
fail()  { printf "${RED}✗ %s${RESET}\n" "$1"; exit 1; }
step()  { printf "\n${BOLD}▸ %s${RESET}\n" "$1"; }

cd "$(dirname "$0")"

# ── Helpers ──────────────────────────────────────────────────────────

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
}

install_nvm() {
  info "Installing nvm…"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  load_nvm
  command -v nvm &>/dev/null || fail "nvm installation failed — install Node.js $NODE_REQUIRED+ manually and re-run."
  info "nvm installed"
}

install_node_via_nvm() {
  info "Installing Node.js $NODE_REQUIRED via nvm…"
  nvm install "$NODE_REQUIRED"
  nvm use "$NODE_REQUIRED"
  info "Node.js $(node --version) installed via nvm"
}

node_version_ok() {
  command -v node &>/dev/null || return 1
  local major
  major=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  [ "$major" -ge "$NODE_REQUIRED" ]
}

# ── Prerequisites ────────────────────────────────────────────────────

step "Checking prerequisites"

load_nvm 2>/dev/null || true

if node_version_ok; then
  info "Node.js $(node --version)"
else
  if command -v node &>/dev/null; then
    warn "Node.js $(node --version) found — version $NODE_REQUIRED+ is required"
  else
    warn "Node.js is not installed"
  fi

  step "Installing Node.js"

  if command -v nvm &>/dev/null; then
    install_node_via_nvm
  elif command -v brew &>/dev/null; then
    info "Installing Node.js $NODE_REQUIRED via Homebrew…"
    brew install "node@$NODE_REQUIRED"
    brew link --overwrite "node@$NODE_REQUIRED" 2>/dev/null || true
    if ! node_version_ok; then
      fail "Homebrew node@$NODE_REQUIRED installed but not on PATH. Run 'brew link node@$NODE_REQUIRED' and re-run this script."
    fi
    info "Node.js $(node --version) installed via Homebrew"
  else
    install_nvm
    install_node_via_nvm
  fi

  node_version_ok || fail "Node.js $NODE_REQUIRED+ could not be installed. Install it manually and re-run."
fi

if ! command -v npm &>/dev/null; then
  fail "npm is not available — it should ship with Node.js. Check your installation."
fi
info "npm $(npm --version)"

# ── Environment ──────────────────────────────────────────────────────

step "Setting up environment"

if [ -f .env ]; then
  warn ".env already exists — skipping (delete it and re-run to regenerate)"
else
  cp .env.example .env

  if command -v openssl &>/dev/null; then
    SECRET=$(openssl rand -base64 32)
  else
    SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")
  fi

  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "s|change-me-to-a-random-secret|${SECRET}|" .env
  else
    sed -i "s|change-me-to-a-random-secret|${SECRET}|" .env
  fi

  info "Created .env with a generated AUTH_SECRET"
fi

# ── Dependencies ─────────────────────────────────────────────────────

step "Installing dependencies"
npm install
info "npm packages installed"

# ── Prisma ───────────────────────────────────────────────────────────

step "Setting up database"
npx prisma generate
info "Prisma client generated"

npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate dev
info "Database migrations applied"

npm run prisma:seed
info "Database seeded with demo data"

# ── Upload directory ─────────────────────────────────────────────────

UPLOAD_DIR=$(grep -E '^LOCAL_STORAGE_DIR=' .env | cut -d'"' -f2)
UPLOAD_DIR="${UPLOAD_DIR:-data/uploads}"
mkdir -p "$UPLOAD_DIR"
info "Upload directory ready at ${UPLOAD_DIR}/"

# ── Summary ──────────────────────────────────────────────────────────

printf "\n${GREEN}${BOLD}Setup complete!${RESET}\n\n"
printf "Start the dev server:\n\n"
printf "  ${BOLD}npm run dev${RESET}\n\n"
printf "Then open ${BOLD}http://localhost:3000${RESET}\n\n"
printf "Demo accounts:\n"
printf "  %-24s %-14s %s\n" "Email" "Password" "Role"
printf "  %-24s %-14s %s\n" "────────────────────────" "──────────────" "────────────"
printf "  %-24s %-14s %s\n" "admin@school.org" "Admin1234" "Admin"
printf "  %-24s %-14s %s\n" "coach@team.org" "Coach1234" "Coach"
printf "  %-24s %-14s %s\n" "user@team.org" "User1234" "Parent/Mentor"
printf "\n"

if [ -z "$(grep -E '^GOOGLE_AI_API_KEY=' .env | cut -d'"' -f2)" ]; then
  warn "GOOGLE_AI_API_KEY is not set — AI receipt parsing will be unavailable."
  printf "  Set it in .env when you have a Gemini API key.\n\n"
fi
