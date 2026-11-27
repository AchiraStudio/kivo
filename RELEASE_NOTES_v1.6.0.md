# Kivo v1.6.0 Release Notes

**Version:** `1.6.0`

## Summary

Kivo v1.6.0 makes the **Android app** a first-class part of every release. Each version tag now builds the Windows installers **and** an Android APK and publishes them together. The phone interface has been rebuilt for one-handed use, the Android app can **update itself**, and adding customers and members from a phone is much faster.

## Highlights

### 1. Android app in every release
- The release workflow builds an arm64 + armv7 APK (`Kivo_<version>_android.apk`, plus a `.sha256`) and attaches it to the same GitHub Release as the Windows installers. A release is only published when both the installer and the APK are present.
- The build workflow also produces an arm64 APK on every push and pull request.
- **Two ways to use it**, chosen on first launch: connect to the cashier PC over Wi-Fi (scan the Host QR or type the IP; the phone signs in automatically), or run standalone with a local database.
- Camera permission added to the app. Barcode scanning falls back to ZXing where the Android WebView has no built-in detector.
- Release signing is read from `keystore.properties` or from `KIVO_KEYSTORE_*` environment variables; CI uses four repository secrets (see README, "Rilis Android"). Without them the APK is signed with a temporary debug key.

### 2. In-app auto-update (Android)
- Checks GitHub at startup and when the app returns to the foreground (at most every 6 hours).
- An update sheet shows the new version, size and release notes. Tapping **Perbarui** downloads the APK with progress, verifies the SHA-256, confirms it is Kivo's package and signed with the same key as the installed app, then opens the Android installer.
- Android asks once for the "Install unknown apps" permission; the sheet walks the user through it.
- "Nanti" remembers the dismissed version so the sheet does not reappear for it.
- Only download links under `github.com/AchiraStudio/kivo/releases/download/` are accepted.

### 3. Rebuilt phone interface
- **Top bar** with the page title, a Connected / Disconnected indicator for the cashier PC (with a banner and a quick "Ganti" when the host is unreachable), Kivo AI and the account avatar.
- **Bottom navigation** with a raised **Kasir** button in the middle and a cart-count badge.
- **Menu bottom sheet** with Light / Dark / Auto theme, host info and logout.
- Product catalog as tappable cards; larger touch targets and a taller search field in the cashier; the keyboard no longer opens on arrival.
- Android Back closes the open panel first, then returns to the dashboard, instead of closing the app.
- CSV exports use the share sheet (or the clipboard) on Android; Excel-only actions are hidden on phones.
- Logging out of a phone or browser terminal no longer signs you straight back in.

### 4. Faster customer and member entry
- **+ Pelanggan** opens a bottom-sheet form with a phone keypad, one-tap Regular / Member / VIP, and +1 / +3 / +6 / +12 month expiry shortcuts. Email, address and notes sit under "Detail tambahan".
- **Simpan + Baru** saves and clears the form (keeping the tier) for entering many people in a row.
- The customer list gains tier filters (including "Segera habis"), expiry badges, call and WhatsApp buttons, and a one-tap **Perpanjang** for members who are expiring or expired.
- In the cashier, **Pelanggan baru** inside the customer picker creates the customer and selects them for the current sale.

### 5. New showcase website, always in sync
- The demo site was rebuilt from scratch. It now runs the **real Kivo UI** (the same components and design tokens as the app) in the browser against an in-memory host, with scripted walkthroughs of checkout, stock, members, purchasing, reports, Kivo AI and settings, plus the Android app (connect, sell, add members, update) and an offline toggle.
- Download buttons read the latest GitHub release at runtime, and the site is rebuilt and deployed to GitHub Pages automatically after every release (`demo.yml`, dispatched by the release workflow). One-time setup: Settings -> Pages -> Source: GitHub Actions.
- `npm run demo:dev` / `npm run demo:build` run it locally; a `build-demo` job in the Build workflow keeps it from breaking when `src/` changes.

## Under the hood
- The version shown in the UI now comes from `package.json` at build time (`__APP_VERSION__`), so a release only needs the three version files bumped.
- `useMobileBack` reconciles its history entries, fixing a case where replacing one sheet with another closed the new one.
- New dependency: `@zxing/library` (loaded on demand). No Rust dependency or database changes.

## Notes and limitations
- Android auto-update requires every release to be signed with the same key. APKs built without the signing secrets cannot update, or be updated by, a build signed with a different key.
- Thermal printing and the cash drawer are not driven directly from a phone; use the cashier PC.
- The Android job runs for the first time with this release. If it fails, the release stays an unpublished draft and the job can be re-run.
