use axum::{
    extract::State as AxumState,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

use crate::AppState;

pub const DEFAULT_MCP_PORT: u16 = 3700;
const MCP_PROTOCOL_VERSION: &str = "2025-03-26";

#[derive(Clone)]
struct McpHttpContext {
    pool: SqlitePool,
    app_handle: AppHandle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    pub running: bool,
    pub enabled: bool,
    pub port: u16,
    pub url: String,
    pub token: String,
    pub tool_count: usize,
    pub last_call_at: Option<String>,
    pub total_calls: u64,
}

struct McpRuntimeState {
    running: bool,
    port: u16,
    token: String,
    last_call_at: Option<String>,
    total_calls: u64,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

lazy_static! {
    static ref MCP_RUNTIME: Arc<RwLock<McpRuntimeState>> = Arc::new(RwLock::new(McpRuntimeState {
        running: false,
        port: DEFAULT_MCP_PORT,
        token: String::new(),
        last_call_at: None,
        total_calls: 0,
        shutdown_tx: None,
    }));
}

const BLOCKED_ADMIN_TOOLS: &[&str] = &[
    "reset_db_specific",
    "nuke_cloud_workspace_data",
    "sysadmin_login",
    "sysadmin_get_workspaces",
    "sysadmin_create_workspace",
    "sysadmin_create_workspace_invite",
    "sysadmin_update_workspace_password",
    "sysadmin_delete_workspace",
    "update_role_default_permissions",
    "update_user_permissions",
    "delete_user",
    "toggle_user_active",
    "reset_user_password",
    "set_cloud_config",
    "set_setting",
    "export_database",
    "optimize_database",
    "open_devtools",
    "kick_cash_drawer",
    "delete_sale",
    "delete_account",
];

pub fn is_blocked_admin_tool(name: &str) -> bool {
    BLOCKED_ADMIN_TOOLS.contains(&name)
}

async fn ensure_mcp_token(pool: &SqlitePool) -> String {
    let existing: Option<String> = sqlx::query_scalar(
        "SELECT value FROM global_settings WHERE key = 'mcp_api_token' AND value != ''",
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(tok) = existing {
        return tok;
    }

    let generated = format!("kivo_mcp_{}", Uuid::new_v4().simple());
    let _ = sqlx::query(
        "INSERT INTO global_settings (key, value) VALUES ('mcp_api_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&generated)
    .execute(pool)
    .await;

    generated
}

async fn is_mcp_enabled_in_db(pool: &SqlitePool) -> bool {
    let val: Option<String> =
        sqlx::query_scalar("SELECT value FROM global_settings WHERE key = 'mcp_enabled'")
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

    match val.as_deref() {
        Some("false") | Some("0") => false,
        _ => true, // Auto-enabled by default on app load
    }
}

pub async fn start_mcp_server(pool: SqlitePool, app_handle: AppHandle, port: u16) {
    let token = ensure_mcp_token(&pool).await;
    if !is_mcp_enabled_in_db(&pool).await {
        let mut rt = MCP_RUNTIME.write().await;
        rt.token = token;
        rt.port = port;
        rt.running = false;
        return;
    }

    {
        let rt = MCP_RUNTIME.read().await;
        if rt.running {
            return;
        }
    }

    let ctx = McpHttpContext {
        pool: pool.clone(),
        app_handle: app_handle.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let router = Router::new()
        .route("/mcp", post(handle_mcp_rpc))
        .route("/mcp/health", get(handle_mcp_health))
        .layer(cors)
        .with_state(ctx);

    let addr = format!("127.0.0.1:{}", port);
    match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => {
            let (tx, rx) = tokio::sync::oneshot::channel::<()>();
            {
                let mut rt = MCP_RUNTIME.write().await;
                rt.running = true;
                rt.port = port;
                rt.token = token;
                rt.shutdown_tx = Some(tx);
            }
            println!("🔌 [MCP] Kivo MCP server auto-started on http://{}/mcp", addr);

            tokio::spawn(async move {
                let server = axum::serve(listener, router).with_graceful_shutdown(async {
                    let _ = rx.await;
                });
                if let Err(e) = server.await {
                    eprintln!("❌ [MCP] Server error: {}", e);
                }
                let mut rt = MCP_RUNTIME.write().await;
                rt.running = false;
                rt.shutdown_tx = None;
            });
        }
        Err(e) => {
            eprintln!("⚠️ [MCP] Could not bind {}: {}", addr, e);
            let mut rt = MCP_RUNTIME.write().await;
            rt.running = false;
            rt.port = port;
            rt.token = token;
        }
    }
}

pub async fn stop_mcp_server() {
    let tx = {
        let mut rt = MCP_RUNTIME.write().await;
        rt.running = false;
        rt.shutdown_tx.take()
    };
    if let Some(sender) = tx {
        let _ = sender.send(());
    }
}

fn check_bearer_auth(headers: &HeaderMap, expected_token: &str) -> bool {
    if expected_token.is_empty() {
        return false;
    }
    let Some(auth_val) = headers.get("authorization").and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let Some(provided) = auth_val.strip_prefix("Bearer ").or_else(|| auth_val.strip_prefix("bearer ")) else {
        return false;
    };
    provided.trim() == expected_token
}

async fn handle_mcp_health() -> Json<Value> {
    let rt = MCP_RUNTIME.read().await;
    Json(json!({
        "status": if rt.running { "ok" } else { "stopped" },
        "server": "kivo-mcp",
        "version": env!("CARGO_PKG_VERSION"),
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "tools": mcp_tool_definitions().len()
    }))
}

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

fn rpc_ok(id: Value, result: Value) -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        })),
    )
}

fn rpc_err(id: Value, code: i64, message: impl Into<String>) -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": {
                "code": code,
                "message": message.into()
            }
        })),
    )
}

async fn handle_mcp_rpc(
    AxumState(ctx): AxumState<McpHttpContext>,
    headers: HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let expected_token = {
        let rt = MCP_RUNTIME.read().await;
        rt.token.clone()
    };

    if !check_bearer_auth(&headers, &expected_token) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "jsonrpc": "2.0",
                "id": req.id.unwrap_or(Value::Null),
                "error": {
                    "code": -32001,
                    "message": "Unauthorized: missing or invalid Bearer token. Copy your token from Kivo Settings -> MCP Server."
                }
            })),
        );
    }

    // Notifications (no id) get 202 Accepted
    if req.method == "notifications/initialized" || req.method.starts_with("notifications/") {
        return (StatusCode::ACCEPTED, Json(json!({})));
    }

    let id = req.id.clone().unwrap_or(Value::Null);

    match req.method.as_str() {
        "initialize" => rpc_ok(
            id,
            json!({
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {
                    "tools": { "listChanged": false },
                    "resources": { "listChanged": false }
                },
                "serverInfo": {
                    "name": "kivo-mcp",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        ),
        "server/discover" => rpc_ok(
            id,
            json!({
                "protocolVersions": [MCP_PROTOCOL_VERSION, "2026-07-28"],
                "capabilities": {
                    "tools": { "listChanged": false },
                    "resources": { "listChanged": false }
                },
                "serverInfo": {
                    "name": "kivo-mcp",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
        ),
        "ping" => rpc_ok(id, json!({})),
        "tools/list" => rpc_ok(id, json!({ "tools": mcp_tool_definitions() })),
        "resources/list" => rpc_ok(id, json!({ "resources": mcp_resource_definitions() })),
        "resources/read" => {
            let uri = req.params.get("uri").and_then(|v| v.as_str()).unwrap_or("");
            match read_mcp_resource(&ctx, uri).await {
                Ok(content) => rpc_ok(
                    id,
                    json!({
                        "contents": [{
                            "uri": uri,
                            "mimeType": "application/json",
                            "text": serde_json::to_string_pretty(&content).unwrap_or_default()
                        }]
                    }),
                ),
                Err(e) => rpc_err(id, -32602, e),
            }
        }
        "tools/call" => {
            let tool_name = req
                .params
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let args = req
                .params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));

            if tool_name.is_empty() {
                return rpc_err(id, -32602, "Missing required parameter: name");
            }
            if is_blocked_admin_tool(tool_name) {
                return rpc_err(
                    id,
                    -32602,
                    format!("Tool '{}' is restricted (admin control blocked by MCP policy).", tool_name),
                );
            }

            {
                let mut rt = MCP_RUNTIME.write().await;
                rt.total_calls += 1;
                rt.last_call_at = Some(chrono::Utc::now().to_rfc3339());
            }

            let is_write = is_write_tool(tool_name);
            match execute_mcp_tool(&ctx, tool_name, &args).await {
                Ok(result) => {
                    if is_write {
                        let _ = ctx.app_handle.emit("kivo:sync", json!({ "source": "mcp", "tool": tool_name }));
                    }
                    let text = serde_json::to_string_pretty(&result).unwrap_or_else(|_| result.to_string());
                    rpc_ok(
                        id,
                        json!({
                            "content": [{ "type": "text", "text": text }],
                            "structuredContent": result,
                            "isError": false
                        }),
                    )
                }
                Err(e) => rpc_ok(
                    id,
                    json!({
                        "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                        "isError": true
                    }),
                ),
            }
        }
        _ => rpc_err(id, -32601, format!("Method not found: {}", req.method)),
    }
}

fn is_write_tool(name: &str) -> bool {
    matches!(
        name,
        "add_item"
            | "bulk_add_items"
            | "update_item"
            | "delete_item"
            | "adjust_stock"
            | "bulk_stock_opname"
            | "add_category"
            | "add_brand"
            | "add_supplier"
            | "update_supplier"
            | "add_customer"
            | "update_customer"
            | "save_health_record"
            | "create_purchase_order"
            | "receive_goods_direct"
            | "create_sale"
            | "create_promo"
            | "toggle_promo_active"
            | "create_account"
            | "create_manual_journal"
            | "record_cash_in"
            | "record_cash_out"
            | "add_user"
            | "create_workspace"
    )
}

fn mcp_resource_definitions() -> Vec<Value> {
    vec![
        json!({
            "uri": "kivo://inventory/low-stock",
            "name": "Low Stock Alerts",
            "description": "Items currently at or below their minimum stock threshold.",
            "mimeType": "application/json"
        }),
        json!({
            "uri": "kivo://sales/today",
            "name": "Today's Sales Summary",
            "description": "Revenue, transaction count, and gross profit for today.",
            "mimeType": "application/json"
        }),
        json!({
            "uri": "kivo://masters/categories-brands",
            "name": "Categories and Brands",
            "description": "All active product categories and brands in Kivo.",
            "mimeType": "application/json"
        }),
        json!({
            "uri": "kivo://accounting/accounts",
            "name": "Chart of Accounts",
            "description": "All accounting ledger accounts (COA).",
            "mimeType": "application/json"
        }),
    ]
}

async fn read_mcp_resource(ctx: &McpHttpContext, uri: &str) -> Result<Value, String> {
    let state = ctx.app_handle.state::<AppState>();
    let branch_id = "branch_001".to_string();
    match uri {
        "kivo://inventory/low-stock" => {
            let alerts = crate::commands::inventory::get_low_stock_alerts(branch_id, state).await?;
            Ok(serde_json::to_value(alerts).unwrap_or_default())
        }
        "kivo://sales/today" => {
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            let rows = crate::commands::reports::get_sales_summary(branch_id, today.clone(), today, state).await?;
            Ok(serde_json::to_value(rows).unwrap_or_default())
        }
        "kivo://masters/categories-brands" => {
            let cats = crate::commands::masters::get_categories(state.clone()).await?;
            let brands = crate::commands::masters::get_brands(state).await?;
            Ok(json!({ "categories": cats, "brands": brands }))
        }
        "kivo://accounting/accounts" => {
            let accs = crate::commands::accounting::get_accounts(state).await?;
            Ok(serde_json::to_value(accs).unwrap_or_default())
        }
        _ => Err(format!("Unknown resource URI: {}", uri)),
    }
}

pub fn mcp_tool_definitions() -> Vec<Value> {
    let item_props = json!({
        "name": { "type": "string", "description": "Product name (required)" },
        "sku": { "type": "string", "description": "Optional SKU. Auto-generated if omitted." },
        "barcode": { "type": "string", "description": "Optional EAN/UPC barcode" },
        "category_name": { "type": "string", "description": "Category name (auto-created if it does not exist)" },
        "brand_name": { "type": "string", "description": "Brand name (auto-created if it does not exist)" },
        "unit_name": { "type": "string", "description": "Base unit name (default: Pcs)" },
        "price": { "type": "number", "description": "Retail selling price (harga jual)" },
        "cost_price": { "type": "number", "description": "Cost price / HPP modal" },
        "wholesale_price": { "type": "number", "description": "Wholesale price (harga grosir)" },
        "initial_stock": { "type": "number", "description": "Optional opening stock quantity" },
        "min_stock": { "type": "number", "description": "Low-stock alert threshold (default: 5)" },
        "rack_location": { "type": "string", "description": "Shelf / rack location" },
        "generic_name": { "type": "string", "description": "Generic / active ingredient name" },
        "notes": { "type": "string", "description": "Additional notes" }
    });

    vec![
        // ─── INVENTORY & ITEMS ────────────────────────────────────────
        json!({
            "name": "search_items",
            "description": "Search products by name, SKU, or barcode. Returns item IDs, base_unit_id, prices, and stock.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "search": { "type": "string", "description": "Search query (name, SKU, or barcode)" },
                    "page": { "type": "integer", "description": "Page number (default 1)" },
                    "per_page": { "type": "integer", "description": "Results per page (default 25, max 100)" }
                }
            }
        }),
        json!({
            "name": "get_item_detail",
            "description": "Get full details of a single item including units, prices, and stock.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "item_id": { "type": "string", "description": "Item ID" }
                },
                "required": ["item_id"]
            }
        }),
        json!({
            "name": "add_item",
            "description": "Create a new product in ONE step: auto-generates SKU if omitted, resolves or creates category/brand by name, creates base unit, sets retail/wholesale/cost prices, and optionally sets initial stock.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": item_props,
                "required": ["name"]
            }
        }),
        json!({
            "name": "bulk_add_items",
            "description": "Batch-create multiple products at once with smart defaults (auto-SKU, auto-category/brand creation, base unit, prices, and initial stock). Ideal for quick data input.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string", "description": "Branch ID (default: branch_001)" },
                    "items": {
                        "type": "array",
                        "description": "Array of items to create",
                        "items": {
                            "type": "object",
                            "properties": item_props,
                            "required": ["name"]
                        }
                    }
                },
                "required": ["items"]
            }
        }),
        json!({
            "name": "update_item",
            "description": "Update an existing item's details (name, SKU, barcode, prices, cost, category, brand, rack, min_stock, notes).",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "item_id": { "type": "string", "description": "Item ID to update" },
                    "name": { "type": "string" },
                    "sku": { "type": "string" },
                    "barcode": { "type": "string" },
                    "category_name": { "type": "string" },
                    "brand_name": { "type": "string" },
                    "price": { "type": "number", "description": "New retail price" },
                    "cost_price": { "type": "number", "description": "New cost/HPP price" },
                    "wholesale_price": { "type": "number", "description": "New wholesale price" },
                    "min_stock": { "type": "number" },
                    "rack_location": { "type": "string" },
                    "generic_name": { "type": "string" },
                    "notes": { "type": "string" }
                },
                "required": ["item_id"]
            }
        }),
        json!({
            "name": "delete_item",
            "description": "Soft-delete (deactivate) an item from inventory.",
            "annotations": { "readOnlyHint": false, "destructiveHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "item_id": { "type": "string", "description": "Item ID to delete" }
                },
                "required": ["item_id"]
            }
        }),
        json!({
            "name": "get_stock_overview",
            "description": "Get current stock levels for all items in a branch.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string", "description": "Branch ID (default: branch_001)" }
                }
            }
        }),
        json!({
            "name": "get_low_stock_alerts",
            "description": "Get items at or below minimum stock.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string", "description": "Branch ID (default: branch_001)" }
                }
            }
        }),
        json!({
            "name": "get_expiring_items",
            "description": "Get item batches expiring within N days (default 90).",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "days": { "type": "integer", "description": "Days ahead (default 90)" }
                }
            }
        }),
        json!({
            "name": "adjust_stock",
            "description": "Add (in) or subtract (out) stock for an item. Automatically resolves base unit if unit_id is omitted.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "item_id": { "type": "string", "description": "Item ID" },
                    "unit_id": { "type": "string", "description": "Optional unit ID (defaults to item base unit)" },
                    "qty": { "type": "number", "description": "Positive quantity to add or remove" },
                    "direction": { "type": "string", "enum": ["in", "out"], "description": "in = add stock, out = remove stock" },
                    "notes": { "type": "string" },
                    "branch_id": { "type": "string" }
                },
                "required": ["item_id", "qty", "direction"]
            }
        }),
        json!({
            "name": "bulk_stock_opname",
            "description": "Set exact physical stock quantities for multiple items at once via a stock opname session.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "notes": { "type": "string" },
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_id": { "type": "string" },
                                "unit_id": { "type": "string", "description": "Optional (auto-resolved to base unit)" },
                                "actual_qty": { "type": "number" },
                                "notes": { "type": "string" }
                            },
                            "required": ["item_id", "actual_qty"]
                        }
                    }
                },
                "required": ["items"]
            }
        }),
        // ─── MASTERS ──────────────────────────────────────────────────
        json!({
            "name": "get_categories",
            "description": "List all product categories.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_category",
            "description": "Create a new product category.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "parent_id": { "type": "string" }
                },
                "required": ["name"]
            }
        }),
        json!({
            "name": "get_brands",
            "description": "List all product brands.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_brand",
            "description": "Create a new product brand.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" }
                },
                "required": ["name"]
            }
        }),
        // ─── SUPPLIERS & PURCHASING ───────────────────────────────────
        json!({
            "name": "get_suppliers",
            "description": "List suppliers.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_supplier",
            "description": "Create a new supplier.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "contact_person": { "type": "string" },
                    "phone": { "type": "string" },
                    "email": { "type": "string" },
                    "address": { "type": "string" },
                    "payment_terms": { "type": "string" }
                },
                "required": ["name"]
            }
        }),
        json!({
            "name": "get_purchase_orders",
            "description": "List purchase orders.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": { "branch_id": { "type": "string" } }
            }
        }),
        json!({
            "name": "receive_goods_direct",
            "description": "Directly receive stock from a supplier without a PO (updates inventory stock & HPP).",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "supplier_id": { "type": "string" },
                    "invoice_no": { "type": "string" },
                    "lines": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_id": { "type": "string" },
                                "unit_id": { "type": "string" },
                                "qty": { "type": "number" },
                                "unit_cost": { "type": "number" },
                                "batch_no": { "type": "string" },
                                "expiry_date": { "type": "string" }
                            },
                            "required": ["item_id", "qty", "unit_cost"]
                        }
                    }
                },
                "required": ["supplier_id", "lines"]
            }
        }),
        // ─── CUSTOMERS & HEALTH ───────────────────────────────────────
        json!({
            "name": "get_customers",
            "description": "List customers/members.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_customer",
            "description": "Create a new customer/member.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "phone": { "type": "string" },
                    "email": { "type": "string" },
                    "address": { "type": "string" },
                    "region": { "type": "string" },
                    "customer_tier": { "type": "string", "enum": ["regular", "member", "vip"] }
                },
                "required": ["name"]
            }
        }),
        json!({
            "name": "get_health_records",
            "description": "Get clinic health check records for a customer.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": { "customer_id": { "type": "string" } },
                "required": ["customer_id"]
            }
        }),
        json!({
            "name": "save_health_record",
            "description": "Record a clinic health check (blood sugar, uric acid, cholesterol, blood pressure, notes, medicines) for a customer.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "customer_id": { "type": "string" },
                    "checked_at": { "type": "string", "description": "YYYY-MM-DD" },
                    "gula_darah": { "type": "number" },
                    "asam_urat": { "type": "number" },
                    "kolesterol": { "type": "number" },
                    "tensi_sistolik": { "type": "integer" },
                    "tensi_diastolik": { "type": "integer" },
                    "notes": { "type": "string" }
                },
                "required": ["customer_id"]
            }
        }),
        // ─── SALES & REPORTS ──────────────────────────────────────────
        json!({
            "name": "get_sales",
            "description": "Get recent sales transactions.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "limit": { "type": "integer", "description": "Max transactions to return (default 20)" }
                }
            }
        }),
        json!({
            "name": "get_sales_summary",
            "description": "Get sales summary (revenue, transaction count, discount, COGS, gross profit) between date_from and date_to (YYYY-MM-DD).",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "date_from": { "type": "string" },
                    "date_to": { "type": "string" }
                },
                "required": ["date_from", "date_to"]
            }
        }),
        json!({
            "name": "get_top_selling_items",
            "description": "Get top selling products in a date range.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "date_from": { "type": "string" },
                    "date_to": { "type": "string" },
                    "limit": { "type": "integer" }
                },
                "required": ["date_from", "date_to"]
            }
        }),
        json!({
            "name": "get_sales_by_payment_method",
            "description": "Get sales breakdown by payment method (cash, qris, transfer, debit, credit).",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "branch_id": { "type": "string" },
                    "date_from": { "type": "string" },
                    "date_to": { "type": "string" }
                },
                "required": ["date_from", "date_to"]
            }
        }),
        json!({
            "name": "get_stock_valuation",
            "description": "Get total inventory stock valuation.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": { "branch_id": { "type": "string" } }
            }
        }),
        // ─── PROMOS ───────────────────────────────────────────────────
        json!({
            "name": "get_promos",
            "description": "List all active and inactive promotions.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "toggle_promo_active",
            "description": "Enable or disable a promotion by ID.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": { "promo_id": { "type": "string" } },
                "required": ["promo_id"]
            }
        }),
        // ─── ACCOUNTING ───────────────────────────────────────────────
        json!({
            "name": "get_accounts",
            "description": "List Chart of Accounts (COA).",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "create_account",
            "description": "Create a new Chart of Accounts ledger account.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "code": { "type": "string", "description": "Account code e.g. 5105" },
                    "name": { "type": "string", "description": "Account name" },
                    "account_type": { "type": "string", "enum": ["asset", "liability", "equity", "revenue", "expense"] },
                    "description": { "type": "string" }
                },
                "required": ["code", "name", "account_type"]
            }
        }),
        json!({
            "name": "record_cash_in",
            "description": "Record a cash-in accounting transaction.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "account_id": { "type": "string", "description": "Source revenue/equity account ID" },
                    "cash_account_id": { "type": "string", "description": "Destination cash/bank account ID" },
                    "amount": { "type": "number" },
                    "description": { "type": "string" },
                    "branch_id": { "type": "string" }
                },
                "required": ["account_id", "cash_account_id", "amount", "description"]
            }
        }),
        json!({
            "name": "record_cash_out",
            "description": "Record a cash-out expense transaction.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "account_id": { "type": "string", "description": "Expense account ID" },
                    "cash_account_id": { "type": "string", "description": "Source cash/bank account ID" },
                    "amount": { "type": "number" },
                    "description": { "type": "string" },
                    "branch_id": { "type": "string" }
                },
                "required": ["account_id", "cash_account_id", "amount", "description"]
            }
        }),
        json!({
            "name": "get_profit_loss",
            "description": "Get Profit & Loss (Laba Rugi) report for a date range.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "date_from": { "type": "string" },
                    "date_to": { "type": "string" }
                },
                "required": ["date_from", "date_to"]
            }
        }),
        json!({
            "name": "get_balance_sheet",
            "description": "Get Balance Sheet (Neraca) as of a date.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "as_of_date": { "type": "string", "description": "YYYY-MM-DD" }
                },
                "required": ["as_of_date"]
            }
        }),
        // ─── USERS & WORKSPACES (NON-DESTRUCTIVE ONLY) ────────────────
        json!({
            "name": "get_users",
            "description": "List Kivo user accounts (read-only).",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_user",
            "description": "Create a new Kivo user account (cashier, pharmacist, manager, staff). Cannot modify permissions or delete users.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Full display name" },
                    "username": { "type": "string", "description": "Login username" },
                    "password": { "type": "string", "description": "Initial login password" },
                    "role": { "type": "string", "enum": ["cashier", "pharmacist", "manager", "staff", "admin"], "description": "User role" },
                    "workspace_id": { "type": "string", "description": "Optional workspace ID" }
                },
                "required": ["name", "username", "password", "role"]
            }
        }),
        json!({
            "name": "get_workspaces",
            "description": "List available workspaces.",
            "annotations": { "readOnlyHint": true },
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "create_workspace",
            "description": "Create a new Kivo cloud workspace.",
            "annotations": { "readOnlyHint": false, "destructiveHint": false },
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Workspace display name" },
                    "code": { "type": "string", "description": "Short unique workspace code" }
                },
                "required": ["name", "code"]
            }
        }),
    ]
}

async fn resolve_or_create_category(name: &str, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let cats = crate::commands::masters::get_categories(state.clone()).await?;
    if let Some(found) = cats.iter().find(|c| c.name.eq_ignore_ascii_case(trimmed)) {
        return Ok(Some(found.id.clone()));
    }
    let created = crate::commands::masters::add_category(trimmed.to_string(), None, None, None, state).await?;
    Ok(Some(created.id))
}

async fn resolve_or_create_brand(name: &str, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let brands = crate::commands::masters::get_brands(state.clone()).await?;
    if let Some(found) = brands.iter().find(|b| b.name.eq_ignore_ascii_case(trimmed)) {
        return Ok(Some(found.id.clone()));
    }
    let created = crate::commands::masters::add_brand(trimmed.to_string(), state).await?;
    Ok(Some(created.id))
}

async fn resolve_base_unit_id(pool: &SqlitePool, item_id: &str) -> Result<String, String> {
    let unit_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM item_units WHERE item_id = ? ORDER BY is_base DESC, created_at ASC LIMIT 1",
    )
    .bind(item_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    unit_id.ok_or_else(|| format!("Item '{}' has no unit configured", item_id))
}

async fn create_single_item_smart(
    ctx: &McpHttpContext,
    args: &Value,
    default_branch: &str,
) -> Result<Value, String> {
    let state = ctx.app_handle.state::<AppState>();
    let name = args
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Item name is required".to_string())?;

    let sku = args
        .get("sku")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            let prefix: String = name
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .take(4)
                .collect::<String>()
                .to_uppercase();
            let suffix = &Uuid::new_v4().simple().to_string()[..5].to_uppercase();
            format!("{}-{}", if prefix.is_empty() { "ITM".to_string() } else { prefix }, suffix)
        });

    let barcode = args
        .get("barcode")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let category_id = if let Some(cat_name) = args.get("category_name").and_then(|v| v.as_str()) {
        resolve_or_create_category(cat_name, state.clone()).await?
    } else {
        args.get("category_id").and_then(|v| v.as_str()).map(|s| s.to_string())
    };

    let brand_id = if let Some(brand_name) = args.get("brand_name").and_then(|v| v.as_str()) {
        resolve_or_create_brand(brand_name, state.clone()).await?
    } else {
        args.get("brand_id").and_then(|v| v.as_str()).map(|s| s.to_string())
    };

    let cost_price = args.get("cost_price").and_then(|v| v.as_f64());
    let min_stock = args.get("min_stock").and_then(|v| v.as_f64()).unwrap_or(5.0);
    let rack_location = args.get("rack_location").and_then(|v| v.as_str()).map(|s| s.to_string());
    let generic_name = args.get("generic_name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let notes = args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());

    let item = crate::commands::items::add_item(
        sku,
        barcode.clone(),
        name,
        generic_name,
        category_id,
        brand_id,
        "avg".to_string(),
        min_stock,
        0,
        0,
        cost_price,
        rack_location,
        None,
        notes,
        state.clone(),
    )
    .await?;

    let unit_name = args
        .get("unit_name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Pcs".to_string());

    let unit = crate::commands::items::add_item_unit(
        item.id.clone(),
        unit_name,
        1.0,
        1,
        barcode,
        state.clone(),
    )
    .await?;

    if let Some(price) = args.get("price").and_then(|v| v.as_f64()) {
        if price >= 0.0 {
            let _ = crate::commands::items::set_item_price(
                item.id.clone(),
                unit.id.clone(),
                "regular".to_string(),
                price,
                state.clone(),
            )
            .await;
        }
    }

    if let Some(wp) = args.get("wholesale_price").and_then(|v| v.as_f64()) {
        if wp > 0.0 {
            let _ = crate::commands::items::update_item_wholesale_price(item.id.clone(), wp, state.clone()).await;
        }
    }

    if let Some(init_stock) = args.get("initial_stock").and_then(|v| v.as_f64()) {
        if init_stock > 0.0 {
            let branch = args
                .get("branch_id")
                .and_then(|v| v.as_str())
                .unwrap_or(default_branch)
                .to_string();
            let _ = crate::commands::inventory::set_initial_stock(
                item.id.clone(),
                unit.id.clone(),
                branch,
                init_stock,
                cost_price,
                Some("Initial stock via MCP".to_string()),
                state.clone(),
            )
            .await;
        }
    }

    Ok(json!({
        "id": item.id,
        "sku": item.sku,
        "name": item.name,
        "barcode": item.barcode,
        "base_unit_id": unit.id,
        "unit_name": unit.unit_name
    }))
}

async fn execute_mcp_tool(ctx: &McpHttpContext, name: &str, args: &Value) -> Result<Value, String> {
    let state = ctx.app_handle.state::<AppState>();
    let branch_id = args
        .get("branch_id")
        .and_then(|v| v.as_str())
        .unwrap_or("branch_001")
        .to_string();

    match name {
        "search_items" => {
            let search = args.get("search").and_then(|v| v.as_str()).map(|s| s.to_string());
            let page = args.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
            let per_page = args.get("per_page").and_then(|v| v.as_i64()).unwrap_or(25).min(100);
            let res = crate::commands::items::get_items_filtered(
                search, None, None, true, page, per_page, None, None, state,
            )
            .await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_item_detail" => {
            let id = args.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?;
            let res = crate::commands::items::get_item(id.to_string(), state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_item" => create_single_item_smart(ctx, args, &branch_id).await,
        "bulk_add_items" => {
            let arr = args
                .get("items")
                .and_then(|v| v.as_array())
                .ok_or("items array is required")?;
            let mut created = Vec::new();
            let mut errors = Vec::new();
            for (idx, entry) in arr.iter().enumerate() {
                match create_single_item_smart(ctx, entry, &branch_id).await {
                    Ok(item) => created.push(item),
                    Err(e) => errors.push(json!({ "index": idx, "error": e })),
                }
            }
            Ok(json!({
                "created_count": created.len(),
                "error_count": errors.len(),
                "created": created,
                "errors": errors
            }))
        }
        "update_item" => {
            let item_id = args.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?.to_string();
            let current = crate::commands::items::get_item(item_id.clone(), state.clone()).await?;
            let category_id = if let Some(cn) = args.get("category_name").and_then(|v| v.as_str()) {
                resolve_or_create_category(cn, state.clone()).await?
            } else {
                current.item.category_id.clone()
            };
            let brand_id = if let Some(bn) = args.get("brand_name").and_then(|v| v.as_str()) {
                resolve_or_create_brand(bn, state.clone()).await?
            } else {
                current.item.brand_id.clone()
            };
            let updated = crate::commands::items::update_item(
                item_id.clone(),
                args.get("sku").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or(current.item.sku),
                args.get("barcode").and_then(|v| v.as_str()).map(|s| s.to_string()).or(current.item.barcode),
                args.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or(current.item.name),
                args.get("generic_name").and_then(|v| v.as_str()).map(|s| s.to_string()).or(current.item.generic_name),
                category_id,
                brand_id,
                current.item.hpp_method,
                args.get("min_stock").and_then(|v| v.as_f64()).unwrap_or(current.item.min_stock),
                current.item.has_expiry,
                current.item.requires_prescription,
                args.get("cost_price").and_then(|v| v.as_f64()).or(current.item.cost_price),
                args.get("rack_location").and_then(|v| v.as_str()).map(|s| s.to_string()).or(current.item.rack_location),
                current.item.item_type,
                args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()).or(current.item.notes),
                state.clone(),
            )
            .await?;

            if let Some(price) = args.get("price").and_then(|v| v.as_f64()) {
                if let Ok(unit_id) = resolve_base_unit_id(&ctx.pool, &item_id).await {
                    let _ = crate::commands::items::set_item_price(
                        item_id.clone(),
                        unit_id,
                        "regular".to_string(),
                        price,
                        state.clone(),
                    )
                    .await;
                }
            }
            if let Some(wp) = args.get("wholesale_price").and_then(|v| v.as_f64()) {
                let _ = crate::commands::items::update_item_wholesale_price(item_id, wp, state).await;
            }
            Ok(serde_json::to_value(updated).unwrap_or_default())
        }
        "delete_item" => {
            let item_id = args.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?.to_string();
            crate::commands::items::delete_item(item_id.clone(), state).await?;
            Ok(json!({ "deleted": true, "item_id": item_id }))
        }
        "get_stock_overview" => {
            let res = crate::commands::inventory::get_stock_overview(branch_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_low_stock_alerts" => {
            let res = crate::commands::inventory::get_low_stock_alerts(branch_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_expiring_items" => {
            let days = args.get("days").and_then(|v| v.as_i64()).unwrap_or(90);
            let res = crate::commands::reports::get_expiring_items(branch_id, days, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "adjust_stock" => {
            let item_id = args.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?.to_string();
            let unit_id = match args.get("unit_id").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                Some(u) => u.to_string(),
                None => resolve_base_unit_id(&ctx.pool, &item_id).await?,
            };
            let qty = args.get("qty").and_then(|v| v.as_f64()).ok_or("qty is required")?;
            let direction = args.get("direction").and_then(|v| v.as_str()).ok_or("direction is required")?.to_string();
            let notes = args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());
            let res = crate::commands::inventory::adjust_stock(
                item_id, unit_id, branch_id, qty, direction, notes, Some("mcp".to_string()), state,
            )
            .await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "bulk_stock_opname" => {
            let arr = args.get("items").and_then(|v| v.as_array()).ok_or("items array is required")?;
            let notes = args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()).or_else(|| Some("MCP Bulk Opname".to_string()));
            let opname_id = crate::commands::inventory::create_opname_session(
                branch_id,
                Some("mcp".to_string()),
                notes,
                state.clone(),
            )
            .await?;

            let mut lines = Vec::new();
            for entry in arr {
                let item_id = entry.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?.to_string();
                let unit_id = match entry.get("unit_id").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                    Some(u) => u.to_string(),
                    None => resolve_base_unit_id(&ctx.pool, &item_id).await?,
                };
                let actual_qty = entry.get("actual_qty").and_then(|v| v.as_f64()).ok_or("actual_qty is required")?;
                let line_notes = entry.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());
                lines.push(crate::commands::inventory::OpnameLineInput {
                    item_id,
                    unit_id,
                    actual_qty,
                    notes: line_notes,
                });
            }
            let count = lines.len();
            crate::commands::inventory::submit_opname_lines(opname_id.clone(), lines, state.clone()).await?;
            crate::commands::inventory::finalize_opname(opname_id.clone(), state).await?;
            Ok(json!({ "opname_id": opname_id, "items_updated": count, "status": "finalized" }))
        }
        "get_categories" => {
            let res = crate::commands::masters::get_categories(state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_category" => {
            let cname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let parent_id = args.get("parent_id").and_then(|v| v.as_str()).map(|s| s.to_string());
            let res = crate::commands::masters::add_category(cname, None, None, parent_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_brands" => {
            let res = crate::commands::masters::get_brands(state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_brand" => {
            let bname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let res = crate::commands::masters::add_brand(bname, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_suppliers" => {
            let res = crate::commands::suppliers::get_suppliers(None, true, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_supplier" => {
            let sname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let res = crate::commands::suppliers::add_supplier(
                sname,
                args.get("contact_person").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("phone").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("email").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("address").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("payment_terms").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()),
                state,
            )
            .await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_purchase_orders" => {
            let res = crate::commands::purchasing::get_purchase_orders(branch_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "receive_goods_direct" => {
            let supplier_id = args.get("supplier_id").and_then(|v| v.as_str()).ok_or("supplier_id is required")?.to_string();
            let invoice_no = args.get("invoice_no").and_then(|v| v.as_str()).map(|s| s.to_string());
            let raw_lines = args.get("lines").and_then(|v| v.as_array()).ok_or("lines array is required")?;
            let mut lines = Vec::new();
            for entry in raw_lines {
                let item_id = entry.get("item_id").and_then(|v| v.as_str()).ok_or("item_id is required")?.to_string();
                let unit_id = match entry.get("unit_id").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                    Some(u) => u.to_string(),
                    None => resolve_base_unit_id(&ctx.pool, &item_id).await?,
                };
                lines.push(crate::db::models::purchasing::ReceiveLineInput {
                    po_line_id: None,
                    item_id,
                    unit_id,
                    qty_received: entry.get("qty").and_then(|v| v.as_f64()).ok_or("qty is required")?,
                    price_per_unit: entry.get("unit_cost").and_then(|v| v.as_f64()).ok_or("unit_cost is required")?,
                    batch_no: entry.get("batch_no").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    expiry_date: entry.get("expiry_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
                });
            }
            let purchase_id = crate::commands::purchasing::receive_goods_direct(
                branch_id, supplier_id, invoice_no, lines, state,
            )
            .await?;
            Ok(json!({ "purchase_id": purchase_id, "status": "received" }))
        }
        "get_customers" => {
            let res = crate::commands::customers::get_customers(None, None, true, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_customer" => {
            let cname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let tier = args.get("customer_tier").and_then(|v| v.as_str()).unwrap_or("regular").to_string();
            let res = crate::commands::customers::add_customer(
                cname,
                args.get("phone").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("email").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("address").and_then(|v| v.as_str()).map(|s| s.to_string()),
                args.get("region").and_then(|v| v.as_str()).map(|s| s.to_string()),
                tier,
                args.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()),
                None,
                state,
            )
            .await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_health_records" => {
            let cid = args.get("customer_id").and_then(|v| v.as_str()).ok_or("customer_id is required")?;
            let res = crate::commands::health::get_health_records_pool(&ctx.pool, cid).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "save_health_record" => {
            let input: crate::commands::health::HealthRecordInput =
                serde_json::from_value(args.clone()).map_err(|e| format!("Invalid health record input: {}", e))?;
            let res = crate::commands::health::save_health_record_pool(&ctx.pool, input).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_sales" => {
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
            let mut sales = crate::commands::sales::get_sales(branch_id, None, state).await?;
            sales.truncate(limit);
            Ok(serde_json::to_value(sales).unwrap_or_default())
        }
        "get_sales_summary" => {
            let df = args.get("date_from").and_then(|v| v.as_str()).ok_or("date_from is required")?.to_string();
            let dt = args.get("date_to").and_then(|v| v.as_str()).ok_or("date_to is required")?.to_string();
            let res = crate::commands::reports::get_sales_summary(branch_id, df, dt, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_top_selling_items" => {
            let df = args.get("date_from").and_then(|v| v.as_str()).ok_or("date_from is required")?.to_string();
            let dt = args.get("date_to").and_then(|v| v.as_str()).ok_or("date_to is required")?.to_string();
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(10);
            let res = crate::commands::reports::get_top_selling_items(branch_id, df, dt, limit, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_sales_by_payment_method" => {
            let df = args.get("date_from").and_then(|v| v.as_str()).ok_or("date_from is required")?.to_string();
            let dt = args.get("date_to").and_then(|v| v.as_str()).ok_or("date_to is required")?.to_string();
            let res = crate::commands::reports::get_sales_by_payment_method(branch_id, df, dt, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_stock_valuation" => {
            let res = crate::commands::reports::get_stock_valuation(branch_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_promos" => {
            let res = crate::commands::promos::get_promos(false, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "toggle_promo_active" => {
            let pid = args.get("promo_id").and_then(|v| v.as_str()).ok_or("promo_id is required")?.to_string();
            crate::commands::promos::toggle_promo_active(pid.clone(), state).await?;
            Ok(json!({ "promo_id": pid, "toggled": true }))
        }
        "get_accounts" => {
            let res = crate::commands::accounting::get_accounts(state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "create_account" => {
            let code = args.get("code").and_then(|v| v.as_str()).ok_or("code is required")?.to_string();
            let aname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let acc_type = args
                .get("account_type")
                .or_else(|| args.get("type"))
                .and_then(|v| v.as_str())
                .ok_or("account_type is required")?
                .to_string();
            let normal_balance = args
                .get("normal_balance")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    if acc_type == "asset" || acc_type == "expense" {
                        "debit".to_string()
                    } else {
                        "credit".to_string()
                    }
                });
            let input = crate::db::models::accounting::CreateAccountInput {
                code,
                name: aname,
                r#type: acc_type,
                parent_id: args.get("parent_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
                normal_balance,
            };
            let res = crate::commands::accounting::create_account(input, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "record_cash_in" => {
            let account_id = args.get("account_id").and_then(|v| v.as_str()).ok_or("account_id is required")?.to_string();
            let cash_account_id = args.get("cash_account_id").and_then(|v| v.as_str()).ok_or("cash_account_id is required")?.to_string();
            let amount = args.get("amount").and_then(|v| v.as_f64()).ok_or("amount is required")?;
            let description = args.get("description").and_then(|v| v.as_str()).ok_or("description is required")?.to_string();
            let res = crate::commands::accounting::cash_in(account_id, cash_account_id, amount, description, Some(branch_id), state).await?;
            Ok(json!({ "journal_id": res, "status": "recorded" }))
        }
        "record_cash_out" => {
            let account_id = args.get("account_id").and_then(|v| v.as_str()).ok_or("account_id is required")?.to_string();
            let cash_account_id = args.get("cash_account_id").and_then(|v| v.as_str()).ok_or("cash_account_id is required")?.to_string();
            let amount = args.get("amount").and_then(|v| v.as_f64()).ok_or("amount is required")?;
            let description = args.get("description").and_then(|v| v.as_str()).ok_or("description is required")?.to_string();
            let res = crate::commands::accounting::cash_out(account_id, cash_account_id, amount, description, Some(branch_id), state).await?;
            Ok(json!({ "journal_id": res, "status": "recorded" }))
        }
        "get_profit_loss" => {
            let df = args.get("date_from").and_then(|v| v.as_str()).ok_or("date_from is required")?.to_string();
            let dt = args.get("date_to").and_then(|v| v.as_str()).ok_or("date_to is required")?.to_string();
            let res = crate::commands::accounting::get_profit_loss(df, dt, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_balance_sheet" => {
            let as_of = args.get("as_of_date").and_then(|v| v.as_str()).ok_or("as_of_date is required")?.to_string();
            let res = crate::commands::accounting::get_balance_sheet(as_of, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_users" => {
            let res = crate::commands::auth::get_users(state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "add_user" => {
            let uname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let username = args.get("username").and_then(|v| v.as_str()).ok_or("username is required")?.to_string();
            let password = args.get("password").and_then(|v| v.as_str()).ok_or("password is required")?.to_string();
            let role = args.get("role").and_then(|v| v.as_str()).unwrap_or("cashier").to_string();
            if role == "owner" || role == "sysadmin" {
                return Err("Cannot create owner or sysadmin accounts via MCP.".to_string());
            }
            let workspace_id = args.get("workspace_id").and_then(|v| v.as_str()).map(|s| s.to_string());
            let res = crate::commands::auth::create_user(uname, username, password, role, workspace_id, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "get_workspaces" => {
            let res = crate::commands::sync::get_available_workspaces(state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        "create_workspace" => {
            let wname = args.get("name").and_then(|v| v.as_str()).ok_or("name is required")?.to_string();
            let code = args.get("code").and_then(|v| v.as_str()).ok_or("code is required")?.to_string();
            let res = crate::commands::sync::create_workspace(wname, code, state).await?;
            Ok(serde_json::to_value(res).unwrap_or_default())
        }
        _ => Err(format!("Unknown MCP tool: {}", name)),
    }
}

// ─── TAURI COMMANDS FOR SETTINGS UI ───────────────────────────────────────────

#[tauri::command]
pub async fn get_mcp_status(state: State<'_, AppState>) -> Result<McpStatus, String> {
    let enabled = is_mcp_enabled_in_db(&state.db_pool).await;
    let token = ensure_mcp_token(&state.db_pool).await;
    let rt = MCP_RUNTIME.read().await;
    let port = rt.port;
    Ok(McpStatus {
        running: rt.running,
        enabled,
        port,
        url: format!("http://127.0.0.1:{}/mcp", port),
        token,
        tool_count: mcp_tool_definitions().len(),
        last_call_at: rt.last_call_at.clone(),
        total_calls: rt.total_calls,
    })
}

#[tauri::command]
pub async fn set_mcp_enabled(
    enabled: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<McpStatus, String> {
    let val = if enabled { "true" } else { "false" };
    sqlx::query(
        "INSERT INTO global_settings (key, value) VALUES ('mcp_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(val)
    .execute(&state.db_pool)
    .await
    .map_err(|e| e.to_string())?;

    if enabled {
        start_mcp_server(state.db_pool.clone(), app, DEFAULT_MCP_PORT).await;
    } else {
        stop_mcp_server().await;
    }

    get_mcp_status(state).await
}

#[tauri::command]
pub async fn regenerate_mcp_token(state: State<'_, AppState>) -> Result<String, String> {
    let new_token = format!("kivo_mcp_{}", Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO global_settings (key, value) VALUES ('mcp_api_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&new_token)
    .execute(&state.db_pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut rt = MCP_RUNTIME.write().await;
    rt.token = new_token.clone();
    Ok(new_token)
}

#[tauri::command]
pub async fn list_mcp_tools() -> Result<Vec<Value>, String> {
    Ok(mcp_tool_definitions())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_tool_catalog_excludes_blocked_admin_controls() {
        let tools = mcp_tool_definitions();
        assert!(tools.len() >= 30, "expected full Kivo operational tool catalog");
        for tool in &tools {
            let name = tool.get("name").and_then(|v| v.as_str()).unwrap_or("");
            assert!(!name.is_empty());
            assert!(
                !is_blocked_admin_tool(name),
                "blocked admin tool '{}' must never be exposed in MCP tools/list",
                name
            );
        }
        assert!(is_blocked_admin_tool("reset_db_specific"));
        assert!(is_blocked_admin_tool("update_role_default_permissions"));
        assert!(is_blocked_admin_tool("delete_user"));
        assert!(is_blocked_admin_tool("set_cloud_config"));
    }

    #[test]
    fn bearer_auth_validates_exact_token() {
        let mut headers = HeaderMap::new();
        assert!(!check_bearer_auth(&headers, "kivo_mcp_secret"));

        headers.insert("authorization", "Bearer wrong_token".parse().unwrap());
        assert!(!check_bearer_auth(&headers, "kivo_mcp_secret"));

        headers.insert("authorization", "Bearer kivo_mcp_secret".parse().unwrap());
        assert!(check_bearer_auth(&headers, "kivo_mcp_secret"));
        assert!(!check_bearer_auth(&headers, ""));
    }
}
