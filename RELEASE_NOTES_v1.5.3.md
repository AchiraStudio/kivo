# Kivo v1.5.3 Release Notes

**Release Date:** November 20, 2026
**Version:** `1.5.3`

## Fixes & UI Improvements

### 1. Fixed Infinite LAN Sync Reload Loop on POS
- Fixed a Rust `tokio::sync::watch` bug in `handle_lan_poll` (`src-tauri/src/commands/lan.rs`) where cloned receivers called `borrow()` instead of `borrow_and_update()`, causing `rx.changed()` to return immediately in a tight loop on the same version.
- Excluded read-only RPCs including `calculate_discounts` from triggering `notify_mutation`.
- Hardened `useRealtimeSync` (`src/hooks/useRealtimeSync.ts`) to ignore non-advancing versions and read-only tables, and made POS catalog sync refreshes debounced and silent so the cashier screen never reloads or flickers.

### 2. Unified Desktop Topbar + Titlebar
- Merged desktop `TitleBar` and `Topbar` into a single compact `44px` draggable header bar (`Topbar.tsx`), eliminating the double top bar and duplicate sidebar logo header.
- Kept `TitleBar` for standalone `LoginPage` and `SetupWizard` screens.

### 3. Mobile Layout, Bottom Navigation & Checkout Overflow Fixes
- Removed the redundant mobile top bar (`< 768px`) and moved `Kivo AI` and update access into `MobileMenuDrawer`, accessible directly from the bottom bar's `Menu` button.
- Moved `MobileNav` out of `fixed bottom-0` into normal flex layout (`shrink-0`) so content and checkout buttons can never be covered by the bottom bar.
- Fixed the POS mobile cart panel (`flex-1 min-h-0`) and moved `PaymentModal` action buttons (`Batal`, `Simpan`, `Simpan & Cetak`) into the sticky modal footer with safe-area padding so checkout controls stay visible on all screen sizes.
- Compacted mobile Dashboard KPIs into a 2x2 grid (`grid-cols-2`), hid redundant mobile shortcut buttons, and tightened `TabBar` height.
