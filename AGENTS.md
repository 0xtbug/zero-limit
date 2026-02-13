# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript frontend, organized by feature slices: `features/`, `shared/`, `layouts/`, `router/`, `i18n/`, `services/`, `types/`, `constants/`.
- `src-tauri/` contains the Rust backend and Tauri configuration.
- `public/` holds static assets used by the web view (icons, etc.).
- `docs/` contains user documentation (see `docs/USAGE.md`).
- `scripts/` includes maintenance utilities such as `scripts/bump-version.sh`.
- Build outputs land in `dist/` (frontend) and `src-tauri/target/` (Tauri).

## Build, Test, and Development Commands
- `pnpm install` installs dependencies (Node >= 20, pnpm 10).
- `pnpm run dev` starts the Vite dev server for the frontend only.
- `pnpm run build` runs TypeScript checks and builds the frontend bundle.
- `pnpm run preview` serves the built frontend for local verification.
- `pnpm run tauri dev` runs the full desktop app in development mode.
- `pnpm run tauri build` builds the production desktop application.

## Coding Style & Naming Conventions
- Indentation: 2 spaces, LF line endings, UTF-8, trim trailing whitespace (see `.editorconfig`).
- Formatting: Prettier with Tailwind plugin, no semicolons, single quotes (see `.prettierrc`).
- Prefer clear, descriptive names; keep React components in `PascalCase` and hooks in `camelCase` (e.g., `useQuotaStore`).

## Testing Guidelines
- There is no dedicated automated test suite yet.
- Before submitting changes, run `pnpm run build` and perform a manual smoke test via `pnpm run tauri dev`.
- If you add tests, co-locate them near the feature and use a `*.test.ts(x)` naming pattern.

## Commit & Pull Request Guidelines
- Commit messages follow a Conventional Commit style seen in history: `feat(scope): ...`, `fix: ...`, `docs(README): ...`, `build(release): ...`.
- Keep commits focused and scoped; prefer multiple small commits over a single large one.
- Pull requests should include a concise summary, steps to verify, and screenshots for UI changes.
- Link related issues or discussions when applicable.

## Security & Configuration Notes
- The app depends on CLIProxyAPI and external provider auth; avoid committing secrets or tokens.
- If you touch OAuth flows or updater logic, test on all supported platforms where possible.
