#!/bin/bash
# bump-version.sh - Updates version across all project files
# Usage: ./scripts/bump-version.sh <version>
# Example: ./scripts/bump-version.sh 1.1.0

set -euo pipefail

VERSION="${1:?Usage: bump-version.sh <version>}"

# Strip leading 'v' if present
VERSION="${VERSION#v}"

# Validate version format (semver: X.Y.Z with optional prerelease)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
  echo "Error: Invalid version format '$VERSION'. Expected semver (e.g., 1.1.0)"
  exit 1
fi

echo "Bumping version to ${VERSION}..."

# 1. package.json
if [ -f "package.json" ]; then
  if command -v jq &> /dev/null; then
    jq --arg v "$VERSION" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
  else
    sed -i.bak "s|\"version\": \"[^\"]*\"|\"version\": \"${VERSION}\"|" package.json && rm -f package.json.bak
  fi
  echo "  ✓ package.json -> ${VERSION}"
fi

# 2. src-tauri/tauri.conf.json
if [ -f "src-tauri/tauri.conf.json" ]; then
  if command -v jq &> /dev/null; then
    jq --arg v "$VERSION" '.version = $v' src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
  else
    sed -i.bak "s|\"version\": \"[^\"]*\"|\"version\": \"${VERSION}\"|" src-tauri/tauri.conf.json && rm -f src-tauri/tauri.conf.json.bak
  fi
  echo "  ✓ src-tauri/tauri.conf.json -> ${VERSION}"
fi

# 3. src-tauri/Cargo.toml (use | delimiter to avoid issues with / in paths)
if [ -f "src-tauri/Cargo.toml" ]; then
  sed -i.bak "s|^version = \".*\"|version = \"${VERSION}\"|" src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak
  echo "  ✓ src-tauri/Cargo.toml -> ${VERSION}"
fi

echo "Done! All files bumped to ${VERSION}"
