#!/bin/zsh
# pre-commit hook — Tasteza
# Runs basic checks before allowing a git commit.
# Install: cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "🔍 Running pre-commit checks..."

# ── 1. Check for hardcoded secrets in staged files ──────────────────────────
echo "  Checking for hardcoded secrets..."
STAGED=$(git diff --staged --name-only)

if echo "$STAGED" | xargs grep -lE "(JWT_SECRET|DB_PASSWORD)\s*=\s*['\"][^'\"]{3,}" 2>/dev/null | grep -v '\.env' | grep -v '\.env\.example'; then
  echo "❌ Hardcoded secret detected! Move it to server/.env"
  exit 1
fi

# ── 2. Check for SQL injection patterns (string interpolation in queries) ────
echo "  Checking for SQL injection patterns..."
if echo "$STAGED" | grep -E '\.(js)$' | xargs grep -nE "db\.query\(\`[^;]*\$\{" 2>/dev/null; then
  echo "❌ Possible SQL injection: use parameterized queries (?) instead of template literals"
  exit 1
fi

# ── 3. Check that schema.sql was not modified (changes go in migrations/) ───
if echo "$STAGED" | grep -q "server/schema.sql"; then
  echo "❌ server/schema.sql was modified. Put schema changes in server/migrations/ instead."
  exit 1
fi

# ── 4. Warn if .env file is staged ──────────────────────────────────────────
if echo "$STAGED" | grep -qE '^server/\.env$'; then
  echo "❌ server/.env is staged! Remove it: git reset HEAD server/.env"
  exit 1
fi

# ── 5. Check frontend for direct axios imports in component files ────────────
echo "  Checking for direct axios usage in components..."
if echo "$STAGED" | grep -E 'src/components/.*\.js$' | xargs grep -lE "^import axios|from 'axios'" 2>/dev/null; then
  echo "❌ Direct axios import in component. Use src/api/index.js wrappers instead."
  exit 1
fi

echo "✅ Pre-commit checks passed."
exit 0
