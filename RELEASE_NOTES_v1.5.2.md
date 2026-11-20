# Kivo v1.5.2 Release Notes

**Release Date:** November 20, 2026
**Version:** `1.5.2`

## Summary

Kivo v1.5.2 unifies the entire interface around a single design system (`DESIGN.md`: Calm Utility) across desktop and LAN mobile/tablet views. Every page, modal, drawer, and dropdown now shares the same neutral surfaces, 1px border hierarchy, control heights, focus states, and concise Indonesian copy.

## Highlights

### 1. Design System & Dual-Theme Contrast (`DESIGN.md`, `src/index.css`)
- Replaced the legacy dark navy palette with neutral graphite (`#0E1013` / `#15181D`) in dark mode and clean paper (`#F7F7F8` / `#FFFFFF`) in light mode.
- Restrained Kivo brand magenta (`#981CC4` light / `#9B1EC8` dark) to primary actions, active navigation states, and focus rings.
- Verified every text/surface pair (>= 4.5:1) and interactive boundary (>= 3.0:1) against WCAG AA in both themes.
- Removed all decorative gradients, backdrop blur overlays, heavy page-card drop shadows, and perpetual pulse/ping/bounce loops.

### 2. Unified Modals, Drawers & Global Dropdowns
- **Portal-positioned `Select` (`src/components/ui/Select.tsx`):** Dropdown menus now render in a fixed viewport-aware portal that avoids overflow clipping inside modals, drawers, and tables, flips upward near the bottom edge, and supports keyboard navigation.
- **Shared overlay stack (`Modal.tsx`, `Drawer.tsx`, `overlayStack.ts`):** Nested modals and drawers share one Escape stack, clean solid scrims, compact headers, and consistent footer actions.
- **Unified `ConfirmModal`:** Migrated all legacy `common/ConfirmModal`, `window.confirm()`, and `alert()` prompts across POS, Inventory, Purchasing, Customers, Accounting, AI Chat, and Settings to `ui/ConfirmModal` and `Toast`.
- **Consistent `ContextMenu`, `TabBar`, `Button`, and `TourGuide`:** All global menus and navigation bars follow the same radius, border, and typography tokens.

### 3. Page-by-Page Simplification
- **App Shell & Auth:** Compact `TitleBar` (showing `1.5.2`), simplified `Sidebar` and `Topbar`, flat `MobileNav` with 44px touch targets, `MobileMenuDrawer` migrated to `Drawer`, and streamlined `LoginPage` and `SetupWizard`.
- **Overview (`Dashboard.tsx`):** Replaced template KPI cards and verbose captions with a unified operational metric bar, recent transactions, 7-day bar chart, top products, stock alerts, and payment breakdown.
- **POS (`src/pages/pos/`):** Flat workspace panels, single primary checkout CTA, clean `PaymentModal`, `ReceiptModal`, `CustomerPickerModal`, `SalesHistoryModal`, `SaleReturnModal`, and `SaleDetailModal`.
- **Inventory, Purchasing & Suppliers:** Standardized tables (`tabular-nums`, horizontal scroll safety), unified `Drawer`/`Modal` forms, clean `Select` controls, and explicit loading/empty/error retry states.
- **Customers, Health Records & Promos:** Unified drawers, `Select`-matched medicine/item autocomplete popovers, and concise Indonesian labels.
- **Reports & Accounting:** Fixed unstyled legacy classes (`btn-primary`, `input-field`), unified `TabBar` and `ReportHeader`, wired CSV export across accounting reports, and standardized tabular number alignment.
- **Settings:** Replaced hand-rolled select/modal overlays with shared `Select`/`Modal`/`ConfirmModal`, consolidated LAN auto-connect controls, and trimmed verbose helper copy.

### 4. Version Synchronization
- Updated `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to `1.5.2`.
- Updated `src-tauri/src/commands/lan.rs` to read `env!("CARGO_PKG_VERSION")` directly so LAN discovery and RPC health checks stay in sync with `Cargo.toml`.
