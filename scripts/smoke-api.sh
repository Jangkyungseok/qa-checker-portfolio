#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-me-1234}"
TESTER_EMAIL="${TESTER_EMAIL:-tester@example.com}"
TESTER_PASSWORD="${TESTER_PASSWORD:-password123}"

printf '\n[1] Signup tester\n'
curl -sS -X POST "$BASE_URL/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TESTER_EMAIL\",\"password\":\"$TESTER_PASSWORD\",\"name\":\"테스터\"}" || true
printf '\n\n[2] Admin login\n'
ADMIN_JSON=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
echo "$ADMIN_JSON"
echo
printf 'Copy the returned admin token and continue with /users/pending and approval manually.\n'
