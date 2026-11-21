# Kivo v1.5.4 Release Notes

**Release Date:** November 21, 2026
**Version:** `1.5.4`

## Summary

Kivo v1.5.4 adds an **embedded MCP server** so external AI clients (Claude Desktop, Claude Code, Cursor, Antigravity) can read and operate Kivo data directly, a **camera barcode scanner** for phones and tablets, and a rebuilt **Kivo AI toolset** that handles bulk data entry in one step. Barcode scanning is now wired into every inventory and purchasing flow, not only POS.

## Highlights

### 1. Embedded MCP Server (`src-tauri/src/commands/mcp.rs`)
- New Streamable HTTP MCP server built on `axum`, auto-started with the desktop app at `http://127.0.0.1:3700/mcp` (MCP protocol `2025-03-26`). It is not started on Android/iOS builds.
- **Bearer-token authentication.** A `kivo_mcp_<uuid>` token is generated on first run and stored in `global_settings` (`mcp_api_token`). Requests without a valid token get `401` with JSON-RPC error `-32001`.
- Binds to loopback only (`127.0.0.1`), with a `/mcp/health` endpoint and per-server call statistics (`total_calls`, `last_call_at`).
- **40 tools** with `readOnlyHint` / `destructiveHint` annotations so clients can gate write operations:
  - **Inventory:** `search_items`, `get_item_detail`, `add_item`, `bulk_add_items`, `update_item`, `delete_item` (soft-delete)
  - **Stock:** `get_stock_overview`, `get_low_stock_alerts`, `get_expiring_items`, `get_stock_valuation`, `adjust_stock`, `bulk_stock_opname`
  - **Catalog:** `get_categories`, `add_category`, `get_brands`, `add_brand`
  - **Purchasing:** `get_suppliers`, `add_supplier`, `get_purchase_orders`, `receive_goods_direct`
  - **Customers / clinic:** `get_customers`, `add_customer`, `get_health_records`, `save_health_record`
  - **Sales & promos:** `get_sales`, `get_sales_summary`, `get_top_selling_items`, `get_sales_by_payment_method`, `get_promos`, `toggle_promo_active`
  - **Accounting:** `get_accounts`, `create_account`, `record_cash_in`, `record_cash_out`, `get_profit_loss`, `get_balance_sheet`
  - **Admin (limited):** `get_users`, `add_user`, `get_workspaces`, `create_workspace`
- Destructive admin tools (database reset, role/permission changes, user deletion, cloud/API-key configuration) are deliberately **not** exposed. A unit test asserts they never appear in `tools/list`.
- New Tauri commands: `get_mcp_status`, `set_mcp_enabled`, `regenerate_mcp_token`, `list_mcp_tools`, with matching helpers in `src/lib/api.ts`.

### 2. MCP Settings Page (`src/pages/settings/McpSettings.tsx`)
- New **Settings -> MCP Server** panel (desktop only): enable/disable toggle, live status, endpoint URL, masked bearer token with copy and **Regenerate**, and the list of available tools.
- One-click copy of a ready-made client config (`mcpServers` JSON) for Claude Desktop, Cursor, and Antigravity.
- The Kivo AI chat header shows a green `MCP · <tool count>` badge while the server is running.

### 3. Camera Barcode Scanner (`src/components/ui/BarcodeCameraModal.tsx`)
- New modal that scans with the device camera using the browser `BarcodeDetector` API, with a manual-entry fallback when the camera or `BarcodeDetector` is unavailable (works on phone/tablet LAN terminals and the Android build).
- A `ScanBarcode` button was added to **POS**, **Item List**, **Item Drawer** (barcode field), **Bulk Stock Add**, **Stock Opname**, and **Direct Receive**.
- Scanning behavior per screen:
  - **POS:** adds the matching item to the cart; shows a message when nothing matches.
  - **Item List:** fills the search box with the scanned code.
  - **Item Drawer:** fills the barcode field.
  - **Bulk Stock Add / Stock Opname / Direct Receive:** each scan increments that item's quantity by 1.

### 4. Hardware Scanner Hook Rewrite (`src/hooks/useBarcodeScanner.ts`)
- New options: `enabled`, `minLength`, `maxKeyIntervalMs` (default 65 ms), `allowInInputs`, `playBeep`.
- Scans end on `Enter` **or** `Tab`. Keystrokes with Ctrl/Meta/Alt are ignored, and typing in inputs, selects, or contenteditable elements no longer triggers false scans unless `allowInInputs` is set.
- Added `playScanBeep(success)`: a high tone on a successful scan and a low tone on a miss.
- Fixed the first keystroke after load being treated as a continuation of a previous scan buffer.

### 5. Kivo AI Toolset Overhaul (`src/lib/aiTools.ts`, `src/lib/aiClient.ts`)
- Rebuilt the in-app function-calling toolset (45 tools). New tools include `bulk_add_items`, `bulk_stock_opname`, `update_item_retail_price`, `update_item_wholesale_price`, `update_item_cost_price`, `create_promo`, `delete_promo`, `delete_customer`, `get_health_records`, and `save_health_record`.
- The system prompt now tells the assistant to use smart defaults (auto-SKU, unit `Pcs`, `min_stock` 5, auto-created category and brand) and to call `bulk_add_items` whenever two or more items are mentioned, instead of asking about optional fields.
- The assistant refuses destructive admin actions and points the user to Settings.
- The system prompt now identifies the app as v1.5.4.

## Upgrade Notes
- The MCP server starts automatically on desktop. To turn it off, use **Settings -> MCP Server**. After a token regeneration, clients must be updated with the new token.
- The server only listens on `127.0.0.1`. It is not reachable from other machines or from LAN terminals.
- No database migrations are included in this release.
