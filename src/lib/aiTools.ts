import * as api from './api';

const ITEM_CREATE_PROPERTIES = {
  name: { type: 'string', description: 'Product name (required)' },
  sku: { type: 'string', description: 'Optional SKU code. Auto-generated if omitted.' },
  barcode: { type: 'string', description: 'Optional EAN/UPC barcode' },
  generic_name: { type: 'string', description: 'Generic or active ingredient name' },
  category_name: { type: 'string', description: 'Category name (auto-created if it does not exist)' },
  brand_name: { type: 'string', description: 'Brand/merk name (auto-created if it does not exist)' },
  base_unit_name: { type: 'string', description: 'Base unit name (e.g. Pcs, Strip, Box, Botol). Default: Pcs.' },
  price: { type: 'number', description: 'Retail selling price (harga jual) in Rupiah' },
  cost_price: { type: 'number', description: 'Purchase / buy cost price (HPP modal) in Rupiah' },
  wholesale_price: { type: 'number', description: 'Wholesale price (harga grosir) in Rupiah' },
  initial_stock: { type: 'number', description: 'Optional initial opening stock quantity' },
  min_stock: { type: 'number', description: 'Low-stock alert threshold (default 5)' },
  rack_location: { type: 'string', description: 'Rack / shelf location (e.g. R01, A-2)' },
  has_expiry: { type: 'number', description: '1 if item tracks expiry dates, 0 otherwise' },
  requires_prescription: { type: 'number', description: '1 if prescription required, 0 otherwise' },
  notes: { type: 'string', description: 'Optional notes' },
};

const BLOCKED_ADMIN_TOOLS = new Set([
  'reset_db_specific',
  'nuke_cloud_workspace_data',
  'update_role_default_permissions',
  'update_user_permissions',
  'delete_user',
  'set_cloud_config',
  'set_setting',
  'export_database',
  'open_devtools',
  'kick_cash_drawer',
]);

export const aiTools = [
  // ─── INVENTORY & EASY DATA INPUT ──────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_items',
      description: 'Search products in inventory by name, SKU, or barcode. Returns item IDs, base_unit_id, prices, and stock.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search query (name, SKU, or barcode)' },
          per_page: { type: 'number', description: 'Max results (default 25)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_item_details',
      description: 'Get full details of an item (SKU, barcode, cost_price/HPP, retail prices, units, stock, category, brand).',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'Item ID' },
        },
        required: ['item_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_item',
      description: 'Add a new product in ONE step: auto-generates SKU if omitted, auto-creates category/brand by name, adds base unit, sets retail/wholesale/cost price, and sets initial stock if provided.',
      parameters: {
        type: 'object',
        properties: ITEM_CREATE_PROPERTIES,
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_add_items',
      description: 'Batch-create multiple products in one call with smart defaults (auto-SKU, auto-category/brand, base unit, prices, and initial stock). Always prefer this when user inputs 2 or more items at once.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Array of items to create',
            items: {
              type: 'object',
              properties: ITEM_CREATE_PROPERTIES,
              required: ['name'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description: 'Update any details of an existing item (name, SKU, barcode, prices, cost_price/HPP, wholesale_price, category, brand, rack_location, min_stock, notes).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Item ID to update' },
          name: { type: 'string' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          generic_name: { type: 'string' },
          cost_price: { type: 'number' },
          price: { type: 'number', description: 'New regular retail price' },
          wholesale_price: { type: 'number' },
          category_name: { type: 'string' },
          brand_name: { type: 'string' },
          rack_location: { type: 'string' },
          min_stock: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item_retail_price',
      description: 'Update retail price (harga eceran) for an item tier (regular, member, vip).',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          unit_id: { type: 'string', description: 'Optional (defaults to base unit)' },
          customer_tier: { type: 'string', enum: ['regular', 'member', 'vip'] },
          price: { type: 'number' },
        },
        required: ['item_id', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item_wholesale_price',
      description: 'Update wholesale price (harga grosir) for an item.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['item_id', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item_cost_price',
      description: 'Update cost price (HPP modal / harga beli) for an item.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          cost_price: { type: 'number' },
        },
        required: ['item_id', 'cost_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_item',
      description: 'Soft-delete/deactivate an item from inventory.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_overview',
      description: 'Get current stock levels for all items in the branch.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_alerts',
      description: 'Get items that are at or below minimum stock.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_expiring_items',
      description: 'Get item batches nearing expiration (default within 90 days).',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Days ahead (default 90)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_stock',
      description: 'Add (in) or subtract (out) stock for an item. Automatically uses base unit if unit_id is omitted.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          unit_id: { type: 'string', description: 'Optional (defaults to base unit)' },
          qty: { type: 'number', description: 'Positive quantity to add or subtract' },
          direction: { type: 'string', enum: ['in', 'out'] },
          notes: { type: 'string' },
        },
        required: ['item_id', 'qty', 'direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_stock_opname',
      description: 'Set exact physical stock quantities for multiple items at once.',
      parameters: {
        type: 'object',
        properties: {
          notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_id: { type: 'string' },
                unit_id: { type: 'string', description: 'Optional (defaults to base unit)' },
                actual_qty: { type: 'number' },
                notes: { type: 'string' },
              },
              required: ['item_id', 'actual_qty'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  // ─── MASTERS ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_categories',
      description: 'List all product categories.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_category',
      description: 'Create a new product category.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_brands',
      description: 'List all product brands.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_brand',
      description: 'Create a new product brand.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  // ─── SUPPLIERS & PURCHASING ───────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_suppliers',
      description: 'List all active suppliers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_supplier',
      description: 'Create a new supplier.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          contact_person: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          payment_terms: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'receive_goods_direct',
      description: 'Receive stock directly from a supplier without a PO (updates stock & HPP).',
      parameters: {
        type: 'object',
        properties: {
          supplier_id: { type: 'string' },
          invoice_no: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_id: { type: 'string' },
                unit_id: { type: 'string', description: 'Optional (defaults to base unit)' },
                qty: { type: 'number' },
                unit_cost: { type: 'number' },
                batch_no: { type: 'string' },
                expiry_date: { type: 'string' },
              },
              required: ['item_id', 'qty', 'unit_cost'],
            },
          },
        },
        required: ['supplier_id', 'lines'],
      },
    },
  },
  // ─── CUSTOMERS & HEALTH ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_customers',
      description: 'List customers/members.',
      parameters: {
        type: 'object',
        properties: { search: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_customer',
      description: 'Add a new customer/member.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          region: { type: 'string' },
          customer_tier: { type: 'string', enum: ['regular', 'member', 'vip'] },
          notes: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_customer',
      description: 'Deactivate a customer.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_health_records',
      description: 'Get clinic health check records for a customer.',
      parameters: {
        type: 'object',
        properties: { customer_id: { type: 'string' } },
        required: ['customer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_health_record',
      description: 'Save a clinic health check record (gula darah, asam urat, kolesterol, tensi, notes) for a customer.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          checked_at: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
          gula_darah: { type: 'number' },
          asam_urat: { type: 'number' },
          kolesterol: { type: 'number' },
          tensi_sistolik: { type: 'number' },
          tensi_diastolik: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['customer_id'],
      },
    },
  },
  // ─── SALES & REPORTS ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_sales',
      description: 'List recent sales transactions.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Max rows (default 15)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_summary',
      description: 'Get sales summary (revenue, transactions, discount, COGS, gross profit) between date_from and date_to (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_selling_items',
      description: 'Get best-selling items in a date range.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_by_payment_method',
      description: 'Get sales totals grouped by payment method.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_valuation',
      description: 'Get total stock valuation across inventory.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── PROMOS ───────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_promos',
      description: 'List promotions.',
      parameters: {
        type: 'object',
        properties: { active_only: { type: 'boolean' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_promo',
      description: 'Create a promotion (percentage, fixed_amount, bogo, tiered, bundle).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          promo_type: { type: 'string', enum: ['percentage', 'fixed_amount', 'bogo', 'tiered', 'bundle'] },
          min_qty: { type: 'number' },
          discount_percent: { type: 'number' },
          discount_value: { type: 'number' },
          item_id: { type: 'string' },
          applies_to: { type: 'string', enum: ['item', 'cart'] },
          bogo_rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: { buy_qty: { type: 'number' }, get_qty: { type: 'number' } },
              required: ['buy_qty', 'get_qty'],
            },
          },
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { min_qty: { type: 'number' }, discount_percent: { type: 'number' } },
              required: ['min_qty', 'discount_percent'],
            },
          },
          bundle_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { item_id: { type: 'string' }, qty: { type: 'number' } },
              required: ['item_id', 'qty'],
            },
          },
        },
        required: ['name', 'promo_type', 'min_qty', 'applies_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_promo_active',
      description: 'Enable or disable a promo.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_promo',
      description: 'Delete a promo.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  // ─── ACCOUNTING ───────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_accounts',
      description: 'List Chart of Accounts (COA).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_account',
      description: 'Create a new ledger account in Chart of Accounts (COA).',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Account code e.g. 5105' },
          name: { type: 'string', description: 'Account name' },
          account_type: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
          description: { type: 'string' },
        },
        required: ['code', 'name', 'account_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_cash_in',
      description: 'Record a cash-in accounting transaction.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string' },
          cash_account_id: { type: 'string' },
          amount: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['account_id', 'cash_account_id', 'amount', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_cash_out',
      description: 'Record a cash-out expense transaction.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string' },
          cash_account_id: { type: 'string' },
          amount: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['account_id', 'cash_account_id', 'amount', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profit_loss',
      description: 'Get Profit & Loss (Laba Rugi) report.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_balance_sheet',
      description: 'Get Balance Sheet (Neraca) as of a date.',
      parameters: {
        type: 'object',
        properties: { as_of_date: { type: 'string' } },
        required: ['as_of_date'],
      },
    },
  },
  // ─── USERS & WORKSPACES (NON-DESTRUCTIVE ONLY) ────────────────
  {
    type: 'function',
    function: {
      name: 'get_users',
      description: 'List existing Kivo user accounts (read-only).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_user',
      description: 'Create a new Kivo user account (cashier, pharmacist, manager, staff, admin). Cannot modify permissions or delete users.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          username: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', enum: ['cashier', 'pharmacist', 'manager', 'staff', 'admin'] },
          workspace_id: { type: 'string' },
        },
        required: ['name', 'username', 'password', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workspaces',
      description: 'List available workspaces.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_workspace',
      description: 'Create a new Kivo workspace.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['name', 'code'],
      },
    },
  },
];

function generateAutoSku(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

async function resolveOrCreateCategoryId(name?: string): Promise<string | undefined> {
  if (!name?.trim()) return undefined;
  const cats = await api.getCategories();
  const match = cats.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  if (match) return match.id;
  const created = await api.addCategory(name.trim());
  return created.id;
}

async function resolveOrCreateBrandId(name?: string): Promise<string | undefined> {
  if (!name?.trim()) return undefined;
  const brands = await api.getBrands();
  const match = brands.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
  if (match) return match.id;
  const created = await api.addBrand(name.trim());
  return created.id;
}

async function resolveBaseUnitId(itemId: string): Promise<string> {
  const detail = await api.getItem(itemId);
  const base = detail.units.find((u) => u.is_base === 1) || detail.units[0];
  if (!base) throw new Error(`Item ${itemId} belum memiliki satuan.`);
  return base.id;
}

async function createItemSmart(args: any, branchId: string) {
  const name = String(args.name || '').trim();
  if (!name) throw new Error('Nama barang wajib diisi.');

  const sku = String(args.sku || '').trim() || generateAutoSku(name);
  const categoryId = args.category_id || (await resolveOrCreateCategoryId(args.category_name));
  const brandId = args.brand_id || (await resolveOrCreateBrandId(args.brand_name));

  let hppMethod = 'avg';
  try {
    const settings = await api.getSettings();
    hppMethod = settings.find((s) => s.key === 'hpp_method')?.value || 'avg';
  } catch {}

  const newItem = await api.addItem({
    name,
    sku,
    barcode: args.barcode || undefined,
    generic_name: args.generic_name || undefined,
    category_id: categoryId,
    brand_id: brandId,
    hpp_method: hppMethod,
    min_stock: args.min_stock ?? 5,
    has_expiry: args.has_expiry ?? 0,
    requires_prescription: args.requires_prescription ?? 0,
    cost_price: args.cost_price,
    wholesale_price: args.wholesale_price ?? 0,
    rack_location: args.rack_location || undefined,
    notes: args.notes || undefined,
  });

  const unitName = String(args.base_unit_name || args.unit_name || 'Pcs').trim();
  const unit = await api.addItemUnit(newItem.id, unitName, 1, 1, args.barcode || undefined);

  if (typeof args.price === 'number' && args.price >= 0) {
    await api.setItemPrice(newItem.id, unit.id, 'regular', args.price);
  }
  if (typeof args.wholesale_price === 'number' && args.wholesale_price > 0) {
    await api.updateItemWholesalePrice(newItem.id, args.wholesale_price);
  }
  if (typeof args.initial_stock === 'number' && args.initial_stock > 0) {
    await api.setInitialStock(
      newItem.id,
      unit.id,
      branchId,
      args.initial_stock,
      args.cost_price,
      'Stok awal via Kivo AI'
    );
  }

  return {
    id: newItem.id,
    sku: newItem.sku,
    name: newItem.name,
    barcode: newItem.barcode,
    base_unit_id: unit.id,
    unit_name: unit.unit_name,
    price: args.price,
    initial_stock: args.initial_stock ?? 0,
  };
}

function notifyUiSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kivo:sync'));
  }
}

export async function executeTool(
  name: string,
  args: any,
  context: { branchId: string; userId?: string; role: string }
): Promise<any> {
  const userRole = context.role;
  const branchId = context.branchId;
  try {
    if (BLOCKED_ADMIN_TOOLS.has(name)) {
      return {
        error: `Permission Denied: Tool '${name}' adalah kontrol admin yang dibatasi.`,
      };
    }

    const isWriteAction =
      name.startsWith('add_') ||
      name.startsWith('bulk_') ||
      name.startsWith('update_') ||
      name.startsWith('delete_') ||
      name.startsWith('create_') ||
      name.startsWith('record_') ||
      name.startsWith('save_') ||
      name.startsWith('toggle_') ||
      name === 'adjust_stock' ||
      name === 'receive_goods_direct';

    if (userRole === 'cashier' && isWriteAction && !['add_customer', 'save_health_record'].includes(name)) {
      return {
        error: `Permission Denied: Role '${userRole}' tidak memiliki izin untuk menjalankan '${name}'.`,
      };
    }

    let result: any;

    switch (name) {
      case 'search_items': {
        const res = await api.getItemsFiltered(args.search || '', undefined, undefined, true, 1, args.per_page || 25);
        result = res.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          category: item.category_name,
          base_unit_id: item.base_unit_id,
          unit: item.base_unit_name,
          cost_price: item.cost_price,
          price: item.price,
          wholesale_price: item.wholesale_price,
          current_stock: item.current_stock,
          min_stock: item.min_stock,
        }));
        break;
      }

      case 'get_item_details': {
        result = await api.getItem(args.item_id || args.id);
        break;
      }

      case 'add_item': {
        result = { success: true, item: await createItemSmart(args, branchId) };
        break;
      }

      case 'bulk_add_items': {
        const items = Array.isArray(args.items) ? args.items : [];
        const created: any[] = [];
        const errors: any[] = [];
        for (let i = 0; i < items.length; i++) {
          try {
            created.push(await createItemSmart(items[i], branchId));
          } catch (e: any) {
            errors.push({ index: i, name: items[i]?.name, error: e?.message || String(e) });
          }
        }
        result = {
          success: errors.length === 0,
          created_count: created.length,
          error_count: errors.length,
          created,
          errors,
        };
        break;
      }

      case 'update_item': {
        const itemId = args.id || args.item_id;
        const curr = (await api.getItem(itemId)).item;
        const categoryId = args.category_name
          ? await resolveOrCreateCategoryId(args.category_name)
          : (args.category_id ?? curr.category_id);
        const brandId = args.brand_name
          ? await resolveOrCreateBrandId(args.brand_name)
          : (args.brand_id ?? curr.brand_id);

        await api.updateItem(itemId, {
          sku: args.sku ?? curr.sku,
          barcode: args.barcode !== undefined ? args.barcode : curr.barcode,
          name: args.name ?? curr.name,
          generic_name: args.generic_name !== undefined ? args.generic_name : curr.generic_name,
          category_id: categoryId,
          brand_id: brandId,
          hpp_method: args.hpp_method ?? curr.hpp_method,
          min_stock: args.min_stock ?? curr.min_stock,
          has_expiry: args.has_expiry ?? curr.has_expiry,
          requires_prescription: args.requires_prescription ?? curr.requires_prescription,
          cost_price: args.cost_price !== undefined ? args.cost_price : curr.cost_price,
          wholesale_price: args.wholesale_price !== undefined ? args.wholesale_price : curr.wholesale_price,
          rack_location: args.rack_location !== undefined ? args.rack_location : curr.rack_location,
          notes: args.notes !== undefined ? args.notes : curr.notes,
        });

        if (typeof args.price === 'number') {
          const unitId = await resolveBaseUnitId(itemId);
          await api.setItemPrice(itemId, unitId, 'regular', args.price);
        }
        if (typeof args.wholesale_price === 'number') {
          await api.updateItemWholesalePrice(itemId, args.wholesale_price);
        }
        result = { success: true, item_id: itemId };
        break;
      }

      case 'update_item_retail_price': {
        const unitId = args.unit_id || (await resolveBaseUnitId(args.item_id));
        await api.setItemPrice(args.item_id, unitId, args.customer_tier || 'regular', args.price);
        result = { success: true, item_id: args.item_id, price: args.price };
        break;
      }

      case 'update_item_wholesale_price': {
        await api.updateItemWholesalePrice(args.item_id, args.price);
        result = { success: true, item_id: args.item_id, wholesale_price: args.price };
        break;
      }

      case 'update_item_cost_price': {
        await api.setItemCostPrice(args.item_id, args.cost_price);
        result = { success: true, item_id: args.item_id, cost_price: args.cost_price };
        break;
      }

      case 'delete_item': {
        await api.deleteItem(args.id || args.item_id);
        result = { success: true, deleted_id: args.id || args.item_id };
        break;
      }

      case 'get_stock_overview': {
        const rows = await api.getStockOverview(branchId);
        result = rows.slice(0, 60);
        break;
      }

      case 'get_low_stock_alerts': {
        result = await api.getLowStockAlerts(branchId);
        break;
      }

      case 'get_expiring_items': {
        result = await api.getExpiringItems(branchId, args.days || 90);
        break;
      }

      case 'adjust_stock': {
        const unitId = args.unit_id || (await resolveBaseUnitId(args.item_id));
        result = await api.adjustStock(
          args.item_id,
          unitId,
          branchId,
          args.qty,
          args.direction,
          args.notes || 'Penyesuaian via Kivo AI'
        );
        break;
      }

      case 'bulk_stock_opname': {
        const items = Array.isArray(args.items) ? args.items : [];
        const sessionId = await api.createOpnameSession(branchId, undefined, args.notes || 'Opname via Kivo AI');
        const lines = [];
        for (const entry of items) {
          const unitId = entry.unit_id || (await resolveBaseUnitId(entry.item_id));
          lines.push({
            item_id: entry.item_id,
            unit_id: unitId,
            actual_qty: entry.actual_qty,
            notes: entry.notes,
          });
        }
        await api.submitOpnameLines(sessionId, lines);
        await api.finalizeOpname(sessionId);
        result = { success: true, opname_id: sessionId, items_updated: lines.length };
        break;
      }

      case 'get_categories':
        result = await api.getCategories();
        break;
      case 'add_category':
        result = await api.addCategory(args.name);
        break;
      case 'get_brands':
        result = await api.getBrands();
        break;
      case 'add_brand':
        result = await api.addBrand(args.name);
        break;

      case 'get_suppliers':
        result = await api.getSuppliers(undefined, true);
        break;
      case 'add_supplier':
        result = await api.addSupplier(
          args.name,
          args.contact_person,
          args.phone,
          args.email,
          args.address,
          args.payment_terms,
          args.notes
        );
        break;
      case 'receive_goods_direct': {
        const lines = [];
        for (const l of args.lines || []) {
          const unitId = l.unit_id || (await resolveBaseUnitId(l.item_id));
          lines.push({
            item_id: l.item_id,
            unit_id: unitId,
            qty_received: l.qty,
            price_per_unit: l.unit_cost,
            batch_no: l.batch_no,
            expiry_date: l.expiry_date,
          });
        }
        const purchaseId = await api.receiveGoodsDirect(branchId, args.supplier_id, args.invoice_no, lines);
        result = { success: true, purchase_id: purchaseId };
        break;
      }

      case 'get_customers':
        result = await api.getCustomers(args.search, undefined, true);
        break;
      case 'add_customer':
        result = await api.addCustomer(
          args.name,
          args.phone,
          args.email,
          args.address,
          args.region,
          args.customer_tier || 'regular',
          args.notes
        );
        break;
      case 'delete_customer':
        await api.toggleCustomerActive(args.id);
        result = { success: true, id: args.id };
        break;
      case 'get_health_records':
        result = await api.getHealthRecords(args.customer_id);
        break;
      case 'save_health_record': {
        const today = new Date().toISOString().slice(0, 10);
        result = await api.saveHealthRecord({
          customer_id: args.customer_id,
          checked_at: args.checked_at || today,
          blood_sugar: args.blood_sugar ?? args.gula_darah ?? null,
          uric_acid: args.uric_acid ?? args.asam_urat ?? null,
          cholesterol_total: args.cholesterol_total ?? args.kolesterol ?? null,
          systolic: args.systolic ?? args.tensi_sistolik ?? null,
          diastolic: args.diastolic ?? args.tensi_diastolik ?? null,
          notes: args.notes ?? null,
          medicines: [],
        });
        break;
      }

      case 'get_sales': {
        const sales = await api.getSales(branchId);
        result = sales.slice(0, args.limit || 15);
        break;
      }
      case 'get_sales_summary':
        result = await api.getSalesSummary(branchId, args.date_from, args.date_to);
        break;
      case 'get_top_selling_items':
        result = await api.getTopSellingItems(branchId, args.date_from, args.date_to, args.limit || 10);
        break;
      case 'get_sales_by_payment_method':
        result = await api.getSalesByPaymentMethod(branchId, args.date_from, args.date_to);
        break;
      case 'get_stock_valuation':
        result = await api.getStockValuation(branchId);
        break;

      case 'list_promos':
        result = await api.getPromos(!!args.active_only);
        break;
      case 'create_promo':
        result = await api.createPromo({
          name: args.name,
          promo_type: args.promo_type,
          min_qty: args.min_qty ?? 1,
          discount_percent: args.discount_percent,
          discount_value: args.discount_value,
          item_id: args.promo_type === 'bundle' ? undefined : args.item_id,
          applies_to: args.applies_to || 'item',
          bogo_rules: args.bogo_rules,
          tiers: args.tiers,
          bundle_items: args.bundle_items,
        } as any);
        break;
      case 'toggle_promo_active':
        await api.togglePromoActive(args.id);
        result = { success: true, id: args.id };
        break;
      case 'delete_promo':
        await api.deletePromo(args.id);
        result = { success: true, id: args.id };
        break;

      case 'get_accounts':
        result = await api.getAccounts();
        break;
      case 'create_account': {
        const accType = args.account_type || args.type || 'expense';
        const normalBalance =
          args.normal_balance || (accType === 'asset' || accType === 'expense' ? 'debit' : 'credit');
        result = await api.createAccount({
          code: args.code,
          name: args.name,
          type: accType,
          normal_balance: normalBalance,
        });
        break;
      }
      case 'record_cash_in':
        result = {
          success: true,
          journal_id: await api.cashIn(args.account_id, args.cash_account_id, args.amount, args.description, branchId),
        };
        break;
      case 'record_cash_out':
        result = {
          success: true,
          journal_id: await api.cashOut(args.account_id, args.cash_account_id, args.amount, args.description, branchId),
        };
        break;
      case 'get_profit_loss':
        result = await api.getProfitLoss(args.date_from, args.date_to);
        break;
      case 'get_balance_sheet':
        result = await api.getBalanceSheet(args.as_of_date);
        break;

      case 'get_users':
        result = await api.getUsers();
        break;
      case 'add_user': {
        if (args.role === 'owner' || args.role === 'sysadmin') {
          return { error: 'Tidak diperbolehkan membuat akun owner atau sysadmin melalui AI.' };
        }
        result = await api.createUser(args.name, args.username, args.password, args.role, args.workspace_id);
        break;
      }
      case 'get_workspaces':
        result = await api.getAvailableWorkspaces();
        break;
      case 'create_workspace':
        result = await api.createWorkspace(args.name, args.code);
        break;

      default:
        return { error: `Tool '${name}' tidak dikenali.` };
    }

    if (isWriteAction) {
      notifyUiSync();
    }

    return result;
  } catch (err: any) {
    return { error: err?.message || String(err) };
  }
}
