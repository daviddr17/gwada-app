#!/usr/bin/env bash
# Port origin/main web app changes into apps/web/ on plan/expo-iphone-integration.
# Does not modify main. Keeps monorepo root (pnpm), apps/staff/, packages/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="${1:-origin/main}"
WEB="apps/web"
MB="$(git merge-base "$REF" HEAD)"

echo "== Sync $REF into $WEB (merge-base ${MB:0:7}) =="

copy_from_main() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  git show "$REF:$src" >"$dest"
}

# 1) All files changed on main since merge-base under web source trees
for prefix in app lib components hooks content; do
  if ! git ls-tree --name-only "$REF" "$prefix" &>/dev/null; then
    continue
  fi
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    copy_from_main "$file" "$WEB/$file"
  done < <(git diff --name-only "$MB".."$REF" -- "$prefix" 2>/dev/null || true)
done

# 2) Full dashboard route tree (moves may not appear as content diffs)
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  copy_from_main "$file" "$WEB/$file"
done < <(git ls-tree -r --name-only "$REF" "app/(platform)/(app)/dashboard")

# 3) App shell routes that moved or were updated on main
for file in \
  "app/(platform)/(app)/layout.tsx" \
  "app/(platform)/(app)/profile/layout.tsx" \
  "app/(platform)/(app)/profile/dienstplan/page.tsx" \
  "app/(platform)/(app)/settings/layout.tsx" \
  "app/(platform)/(app)/settings/branding/page.tsx" \
  "app/(platform)/(app)/settings/dashboard/page.tsx" \
  "app/(platform)/(app)/settings/integrationen/settings-integrationen-client.tsx" \
  "app/(platform)/(app)/settings/rollen/page.tsx" \
  "app/(platform)/(app)/settings/team/page.tsx" \
  "app/(platform)/(app)/superadmin/integrationen/page.tsx"
do
  if git cat-file -e "$REF:$file" 2>/dev/null; then
    copy_from_main "$file" "$WEB/$file"
  fi
done

# 4) Remove legacy top-level module routes (now under dashboard/)
LEGACY_MODULES=(
  bewertungen dokumente inventory kontakte menu mitarbeiter reservierungen
)
for mod in "${LEGACY_MODULES[@]}"; do
  rm -rf "$WEB/app/(platform)/(app)/$mod"
done

# 5) Old dashboard home page (replaced by dashboard/(home)/ on main)
rm -f "$WEB/app/(platform)/(app)/dashboard/page.tsx"

# 6) Root-level repo files from main (not package-lock.json / web trees)
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    package-lock.json | package.json | next.config.ts) continue ;;
    app/* | lib/* | components/* | hooks/* | content/*) continue ;;
  esac
  copy_from_main "$file" "$file"
done < <(git diff --name-only "$MB".."$REF" | grep -v "^apps/" || true)

# 7) next.config.ts lives under apps/web in monorepo
if git cat-file -e "$REF:next.config.ts" 2>/dev/null; then
  copy_from_main "next.config.ts" "$WEB/next.config.ts"
fi

echo "== Sync complete =="
