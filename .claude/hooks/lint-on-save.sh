#!/bin/zsh
# lint-on-save hook — Tasteza
# Quick validation run when a file is saved in the editor.
# Usage: pass the saved file path as $1
# Example integration (VS Code task): call this script with ${file}

FILE="$1"

if [[ -z "$FILE" ]]; then
  echo "Usage: lint-on-save.sh <path-to-saved-file>"
  exit 0
fi

echo "🔍 Lint check: $FILE"

# ── Backend JS files ─────────────────────────────────────────────────────────
if [[ "$FILE" == *"server/routes/"* && "$FILE" == *.js ]]; then
  echo "  [Backend route] Checking for common issues..."

  # Warn if authenticate middleware is missing
  if ! grep -q "authenticate" "$FILE"; then
    echo "⚠️  No 'authenticate' middleware found. Is this route intentionally public?"
  fi

  # Warn if SQL template literals found
  if grep -nE "db\.(query|execute)\(\`[^;]*\$\{" "$FILE"; then
    echo "❌ SQL injection risk: use parameterized queries (?) not template literals"
  fi

  # Warn if conn.release() missing in a file that has getConnection
  if grep -q "getConnection" "$FILE" && ! grep -q "conn.release()" "$FILE"; then
    echo "❌ getConnection() used but conn.release() not found — check for connection leak"
  fi
fi

# ── Frontend component files ─────────────────────────────────────────────────
if [[ "$FILE" == *"src/components/"* && "$FILE" == *.js ]]; then
  echo "  [React component] Checking for common issues..."

  # Warn if axios imported directly
  if grep -E "^import axios|from 'axios'" "$FILE"; then
    echo "❌ Direct axios import. Use src/api/index.js wrappers (oGet/oMutate)."
  fi

  # Warn if hardcoded color found
  if grep -nE "color:\s*['\"]#[0-9a-fA-F]{3,6}" "$FILE"; then
    echo "⚠️  Hardcoded color detected. Use CSS variables: var(--ink), var(--accent), etc."
  fi
fi

# ── Migration files ───────────────────────────────────────────────────────────
if [[ "$FILE" == *"server/migrations/"* && "$FILE" == *.sql ]]; then
  echo "  [Migration] Checking for common issues..."

  if ! grep -qi "IF NOT EXISTS\|IF EXISTS" "$FILE"; then
    echo "⚠️  Migration may not be idempotent. Consider using IF NOT EXISTS / ADD COLUMN IF NOT EXISTS."
  fi
fi

echo "✅ Done."
exit 0
