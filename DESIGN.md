---
version: 1.6.0
name: Kivo Calm Utility
description: Neutral graphite and paper surfaces with Kivo brand magenta restrained as a single primary accent. Designed for fast retail, clinic, and POS operations.
colors:
  light-background: "#F7F7F8"
  light-card: "#FFFFFF"
  light-elevated: "#FFFFFF"
  light-input: "#FFFFFF"
  light-muted: "#EFEFF2"
  light-muted-hover: "#E4E5EA"
  light-line: "#DFDFE5"
  light-line-strong: "#8E939F"
  light-heading: "#141518"
  light-body: "#3F434C"
  light-dim: "#5F6470"
  light-primary: "#981CC4"
  light-primary-hover: "#8315AA"
  light-primary-soft: "#F6EBFA"
  light-primary-text: "#8315AA"
  light-accent: "#1D5FA8"
  light-accent-soft: "#EBF3FC"
  light-success: "#13733A"
  light-success-soft: "#EAF6EE"
  light-warning: "#8A4700"
  light-warning-soft: "#FDF3E6"
  light-danger: "#C22525"
  light-danger-text: "#B51F1F"
  light-danger-soft: "#FDECEC"
  light-info: "#185496"
  light-info-soft: "#EBF3FC"
  dark-background: "#0E1013"
  dark-card: "#15181D"
  dark-elevated: "#191D24"
  dark-input: "#1A1E25"
  dark-muted: "#1D2128"
  dark-muted-hover: "#262B35"
  dark-line: "#272C36"
  dark-line-strong: "#656E7F"
  dark-heading: "#F3F4F6"
  dark-body: "#B4BAC6"
  dark-dim: "#8F96A6"
  dark-primary: "#9B1EC8"
  dark-primary-hover: "#8718B0"
  dark-primary-soft: "#2A1634"
  dark-primary-text: "#DF85FF"
  dark-accent: "#6BB4FA"
  dark-accent-soft: "#13253A"
  dark-success: "#32CC7E"
  dark-success-soft: "#11291E"
  dark-warning: "#F2AD42"
  dark-warning-soft: "#2E2210"
  dark-danger: "#C72B2B"
  dark-danger-text: "#FF7B82"
  dark-danger-soft: "#311519"
  dark-info: "#6BB4FA"
  dark-info-soft: "#13253A"
typography:
  page-title:
    fontFamily: Manrope Variable
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.02em
  section-title:
    fontFamily: Manrope Variable
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.01em
  metric-value:
    fontFamily: Manrope Variable
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  body-md:
    fontFamily: Manrope Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Manrope Variable
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.45
  label-sm:
    fontFamily: Manrope Variable
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: Manrope Variable
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: 36px
  input:
    backgroundColor: "{colors.light-input}"
    rounded: "{rounded.md}"
    height: 36px
  select-menu:
    backgroundColor: "{colors.light-elevated}"
    rounded: "{rounded.md}"
    padding: 4px
  modal:
    backgroundColor: "{colors.light-elevated}"
    rounded: "{rounded.lg}"
    padding: 20px
  drawer:
    backgroundColor: "{colors.light-elevated}"
    rounded: 0px
    padding: 20px
---

# Kivo Design System (v1.5.2)

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Overview

Kivo is an operational POS, inventory, purchasing, customer, accounting, and reporting application for retail stores and clinics on desktop (Tauri) and LAN mobile/tablet browsers.

Design Read: Operational business app for store cashiers, pharmacists, and owners, in a calm utilitarian neutral-surface language with Kivo brand magenta as a single restrained accent, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

Core principles:
- Simple, scannable, functional screens with minimal text. Cut redundant subtitles, helper paragraphs, and decorative status badges.
- Every page, modal, drawer, and dropdown shares one visual contract: flat neutral surfaces, crisp 1px borders, predictable control heights, and consistent spacing.
- Both Light and Dark modes are first-class citizens with verified WCAG AA contrast (4.5:1 normal text, 3:1 interactive boundaries).

## Colors

- **Neutral base (Paper `#F7F7F8` / Graphite `#0E1013`):** Replaces the previous navy dark theme so data, numbers, and tables stay legible for 8+ hour shifts without eye strain.
- **Kivo Magenta (`#981CC4` light / `#9B1EC8` dark):** Derived directly from the official Kivo app mark (`public/kivo.png`). Reserved strictly for the primary action on screen, active navigation state, and keyboard focus rings. Never sprayed across every icon, card border, or secondary button.
- **Semantic status colors (`success`, `warning`, `danger`, `info`):** Used strictly to communicate real operational state (stock alerts, payment status, sync state, validation errors), never as decoration.

## Typography

- **Manrope Variable** for all UI text: geometric clarity with open apertures and strong tabular numerals (`font-variant-numeric: tabular-nums`) for prices, stock quantities, and accounting ledgers.
- **Monospace (`ui-monospace`)** restricted to codes, SKUs, invoice numbers, IP addresses, and keyboard shortcuts, never used as display headlines.
- No wide-tracked all-caps eyebrows (`tracking-widest`) above headings or cards. Plain sentence-case labels carry hierarchy cleanly.

## Layout

- **RHYTHM 2:** Consistent operational grid per module, with intentional visual hierarchy between primary workspace (e.g., POS catalog + cart, dashboard focal revenue/alerts, table + filter bar) and secondary actions.
- **One focal point per screen:** Each screen leads with the operator's primary job (checkout in POS, today's operational status in Overview, searchable ledger/table in Inventory/Purchasing/Customers/Reports).
- **Responsive reflow:** Desktop sidebar + topbar collapses to tablet compact sidebar (`< 1024px`) and mobile bottom navigation + slide-over menu drawer (`< 768px`) with reserved bottom clearance and 44px touch targets on mobile.

## Elevation & Depth

- **Flat by default:** Cards, tables, toolbars, and panels sit flat on the canvas with `1px solid var(--color-line)` borders. No drop shadows on page cards.
- **Single elevation tier for overlays:** Modals, drawers, dropdown menus (`Select`), context menus, and toasts lift above the workspace using `bg-elevated`, `border-line`, and one subtle shadow (`shadow-lg shadow-black/15 dark:shadow-black/45`).
- **No backdrop blur:** Overlays use a solid translucent scrim (`bg-black/45`) so surfaces remain crisp and performant on low-end POS hardware.

## Shapes

- **Controls (`rounded-lg`, 8px):** Buttons, inputs, search bars, selects, tabs, and dropdown trigger/panel containers.
- **Menu options & inline chips (`rounded-md`, 6px):** Dropdown items, small status tags, keyboard shortcut hints.
- **Cards, modals, toast containers (`rounded-xl`, 12px):** Outer surfaces only.
- **Full pills (`rounded-full`)** reserved strictly for circular avatars and numeric count indicators, never as a default on buttons, cards, or inputs.

## Components

- **Modal (`src/components/ui/Modal.tsx`):** Single standard dialog for all modals, confirmations, and detail sheets. Compact header (title + optional short subtitle + close button), clean divider, scrollable body, sticky footer with right-aligned secondary/primary `Button` pair. Escape closes topmost dialog only.
- **Drawer (`src/components/ui/Drawer.tsx`):** Slide-over right sheet matching Modal header/body/footer tokens, sharing the same Escape stack and scroll-lock behavior.
- **Dropdown (`src/components/ui/Select.tsx`) & Menus (`ContextMenu.tsx`):** Portal-rendered or viewport-safe elevated popover (`bg-elevated border-line rounded-lg shadow-lg p-1`) with 36px trigger height (32px `sm`), keyboard navigation (ArrowUp/Down, Enter, Escape), and clear selected check state.
- **Buttons (`src/components/ui/Button.tsx`):** 5 variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), 3 heights (`sm` 32px, `md` 36px, `lg` 44px), single-line labels, visible focus ring, tactile `:active` scale.
- **TabBar (`src/components/ui/TabBar.tsx`):** Unified segmented control (`bg-muted p-1 rounded-lg border border-line`) with crisp active tab (`bg-card text-heading border border-line`) used across Inventory, Purchasing, Customers, Reports, Accounting, and Settings.
- **Data States:** Every data view provides clear loading, empty (with cause and next action), and error states.

## Do's and Don'ts

- Do keep copy short, operational, and in consistent Indonesian UI terminology (no mixed English/Indonesian in the same control group unless standard retail terms like POS, SKU, QRIS, PO, LAN).
- Do verify every text and border contrast pairing in both Light and Dark modes.
- Don't use em dashes, decorative emojis, `animate-pulse`/`animate-ping`/`animate-bounce` loops, `backdrop-blur`, or neon gradients.
- Don't hand-roll `fixed inset-0` modals or native `<select>` elements; always use `Modal`, `Drawer`, `ConfirmModal`, and `Select`.
- Don't add verbose explanatory paragraphs, 3-step guides, or redundant subtitle lines beneath self-explanatory headings.

## Design Decisions Log (R-31)

- **Color:** Neutral paper/graphite surfaces with Kivo brand magenta (`#981CC4`/`#9B1EC8`) keep 8-hour POS shifts calm while preserving the official Kivo logo identity.
- **Layout:** Task-first single focal point per module with flat 1px bordered panels eliminates template bloat and keeps tables and carts scannable.
- **Typography:** Manrope Variable with tabular numerals ensures crisp alignment across Rupiah totals, quantities, and journal columns without decorative monospace headings.
- **Spacing:** Tight operational scale (`4/8/12/16/24px`) fits dense business workflows cleanly on 1280x720 POS terminals and narrow mobile viewports.
- **Elevation:** Flat page surfaces and one shared overlay shadow tier make modals, drawers, and dropdowns immediately distinct from page content.
- **Motion (MOTION 1):** Instantaneous hover/focus/active transitions and brief 140ms dialog entrance only; zero perpetual pulse/ping/bounce loops.
- **Icons:** Existing `lucide-react` icon set retained at uniform 1.75px stroke weight strictly for functional affordance (never decorative sparkles/stars).
