# GitHub Actions Build & Release Workflow

Auto-build and release ZeroLimit on push to `main` with Tauri updater support.

## Summary

| Aspect | Decision |
|--------|----------|
| Trigger | Push to `main` |
| Platforms | Windows x64, Windows ARM64 |
| Artifacts | NSIS (.exe), MSI, Portable + signatures |
| Release | Auto-create GitHub Release with `latest.json` |
| Updater | Signed bundles for Tauri auto-update |

## Workflow Structure

```
create-release → build-windows-x64  → publish-release
              → build-windows-arm64 ↗
```

1. **create-release**: Creates draft release, outputs `release_id`
2. **build-windows-x64/arm64**: Parallel builds, uploads artifacts
3. **publish-release**: Generates `latest.json`, publishes release

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |

## Artifacts per Architecture

- `ZeroLimit_{version}_{arch}-setup.exe` (NSIS)
- `ZeroLimit_{version}_{arch}.msi` (MSI)
- `*.sig` signature files
- `latest.json` (for updater)

## One-time Setup

1. Generate keys: `pnpm tauri signer generate -w ~/.tauri/zero-limit.key`
2. Add secrets to GitHub repository settings
3. Add public key to `tauri.conf.json` updater config

## Version Handling

- Reads from `src-tauri/tauri.conf.json`
- Creates tag `v{version}` (e.g., `v1.0.0`)
