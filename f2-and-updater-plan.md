# Plan: Global F2 Cash Drawer Fix & Built-in GitHub App Updater

## Goal
Fix the F2 cash drawer shortcut by resolving configured database printer settings and removing duplicate key listeners, and build a transparent, in-app updater that detects and installs new releases directly from GitHub (`AchiraStudio/kivo`).

---

## Tasks

- [x] **Task 1: Fix F2 Cash Drawer resolution in backend (`src-tauri`)**
  - Update `kick_cash_drawer` in `src-tauri/src/commands/maintenance.rs` to accept `tauri::State<'_, AppState>` (or read `global_settings WHERE key = 'printer_name'`) when `printer_name` is empty before falling back to OS default printer.
  - Verify: Invoking `kick_cash_drawer("")` uses the database-saved printer instead of failing when Windows default printer is unset or non-thermal.

- [x] **Task 2: Fix F2 printer resolution & debounce in frontend (`src/`)**
  - In `src/lib/api.ts`, enhance `kickCashDrawer` to resolve `printer_name` from settings/local cache when called with an empty argument.
  - In `src/App.tsx` and `src/pages/pos/POS.tsx`, deduplicate the F2 handler and add a 500ms cooldown to prevent printer spooler locks from rapid double-pressing.
  - Verify: Pressing F2 on both `/pos` and non-POS routes executes exactly once with 0 lag.

- [x] **Task 3: Implement GitHub Release checker & downloader in Rust (`src-tauri`)**
  - Create `src-tauri/src/commands/updater.rs` containing:
    - `check_for_updates`: Queries `https://api.github.com/repos/AchiraStudio/kivo/releases/latest`, compares semver against `1.4.0`, extracts changelog and installer asset (`.exe` / `.msi`).
    - `download_and_install_update`: Downloads the asset to `%TEMP%` emitting `updater://progress` events, then executes the installer.
  - Register the commands in `src-tauri/src/lib.rs`.
  - Verify: Calling `check_for_updates` returns the latest release metadata or reports current version is up-to-date.

- [x] **Task 4: Create Frontend Updater Service & UI Components**
  - In `src/lib/api.ts`: Add `checkForUpdates` and `downloadAndInstallUpdate` wrappers with TypeScript types.
  - Create `src/components/updater/UpdateModal.tsx`:
    - Shows version comparison (`v1.4.0` → `v1.x.x`), formatted release notes/changelog.
    - Live download progress bar (bytes downloaded, total, percentage).
    - "Update Now" and "Later" buttons.
  - Create subtle update notification pill/banner in `Navbar` / `Titlebar`.
  - Verify: Modal opens cleanly, displays release notes, and shows accurate progress state.

- [x] **Task 5: Add Manual Update Checker in Settings**
  - In `src/pages/settings/Settings.tsx` (General/About section):
    - Add "Check for Updates" button showing current version, last checked timestamp, and manual trigger with spinner.
  - Verify: Clicking button triggers update check and opens modal if an update exists, or shows "You are on the latest version" toast.

- [x] **Task 6: Verification & Build Quality**
  - Run `npm run build` in root `d:\Codes\Github\kivo`.
  - Run `cargo check` in `d:\Codes\Github\kivo\src-tauri`.
  - Verify zero TypeScript compiler errors and clean Rust compilation.

---

## Done When
- [x] Pressing F2 anywhere opens the cash drawer using the configured POS printer without double-firing or spooler locks.
- [x] Kivo automatically checks for GitHub releases on startup without blocking the user or throwing errors if offline.
- [x] An available release can be viewed with full changelog, downloaded with live progress, and launched directly from the app.
- [x] Manual "Check for Updates" button in Settings gives clear feedback.
- [x] TypeScript and Cargo builds succeed with 0 errors.

---

## Notes
- GitHub API public rate limit is 60 requests/hr per IP; caching the check result prevents hitting limits.
- Background checks fail silently if network is offline or unreachable to ensure cashiers are never interrupted.

