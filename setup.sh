#!/usr/bin/env bash
set -euo pipefail

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

# ── Prerequisites ────────────────────────────────────────────────────

step "Checking prerequisites"

if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node.js 20+ and try again."
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $NODE_MAJOR found — version 20+ is required."
fi
info "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
  fail "npm is not installed."
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
