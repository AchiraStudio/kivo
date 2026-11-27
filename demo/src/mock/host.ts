// A tiny in-browser "Kivo host". The real Kivo UI already knows how to talk to a cashier PC over
// /api/lan/*; here those requests are answered from memory, so the demo runs the genuine app
// (same components, same design) with no backend, no install and no account.

import { BRANCH_ID, Db, Row, addDays, createDb, dateStr, dateTimeStr } from './seed';

type Params = Record<string, any>;

const DEMO_TOKEN = 'demo-session-token';

export interface MockHost {
  db: Db;
  setOnline: (online: boolean) => void;
  isOnline: () => boolean;
}

export function installMockHost(): MockHost {
  const now = new Date();
  const db = createDb(now);
  let online = true;
  let version = 1;
  const pollWaiters: (() => void)[] = [];

  const bump = () => {
    version++;
    pollWaiters.splice(0).forEach((fn) => fn());
  };

  const owner = db.users[0];
  const sessionUser = {
    id: owner.id,
    name: owner.name,
    username: owner.username,
    role: 'owner',
    permissions: ['all'],
    is_custom_perms: false,
    branch_id: BRANCH_ID,
    avatar_color: owner.avatar_color,
    workspace_id: 'ws_demo',
  };

  const id = (prefix: string) => `${prefix}_${++db.seq}`;
  const byId = <T extends Row>(rows: T[], key: string) => rows.find((r) => r.id === key);
  const strip = (it: Row) => {
    const { _expMonths, ...rest } = it;
    void _expMonths;
    return rest;
  };
  const inRange = (created: string, from?: string, to?: string) => {
    const d = created.slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  };
  const salesIn = (from?: string, to?: string) =>
    db.sales.filter((s) => s.status !== 'void' && inRange(s.created_at, from, to));
  const customerOf = (s: Row) => s._customer || db.customers[0];

  const nextTrx = () => {
    const n = db.sales.length + 1;
    return `TRX-${dateStr(new Date()).replace(/-/g, '').slice(2)}-${String(n).padStart(4, '0')}`;
  };

  // ----- discounts: percentage, BOGO and quantity promos against the live cart -----
  const calculateDiscounts = (p: Params) => {
    const lines: Row[] = p.lines || [];
    const tier: string = p.customerTier || 'regular';
    const line_discounts: Row[] = [];
    let cart_discount = 0;
    let cart_promo: Row | undefined;
    const active = db.promos.filter((x) => x.active);
    for (const promo of active) {
      if (promo.member_only && tier === 'regular') continue;
      lines.forEach((l, idx) => {
        const lineTotal = l.price * l.qty;
        const hits =
          promo.applies_to === 'item'
            ? promo.item_id === l.item_id
            : promo.applies_to === 'category'
              ? promo.category_id === l.category_id
              : false;
        if (!hits || l.qty < (promo.min_qty || 1)) return;
        if (promo.promo_type === 'percentage' && promo.discount_percent) {
          line_discounts.push({
            line_index: l.line_index ?? idx,
            discount_amount: Math.round((lineTotal * promo.discount_percent) / 100),
            promo_id: promo.id,
            promo_name: promo.name,
            is_bogo_free_item: false,
            free_item_qty: 0,
          });
        } else if (promo.promo_type === 'bogo') {
          const free = Math.floor(l.qty / 3);
          if (free > 0) {
            line_discounts.push({
              line_index: l.line_index ?? idx,
              discount_amount: free * l.price,
              promo_id: promo.id,
              promo_name: promo.name,
              is_bogo_free_item: false,
              free_item_qty: free,
            });
          }
        } else if (promo.promo_type === 'tiered') {
          line_discounts.push({
            line_index: l.line_index ?? idx,
            discount_amount: Math.round(lineTotal * 0.08),
            promo_id: promo.id,
            promo_name: promo.name,
            is_bogo_free_item: false,
            free_item_qty: 0,
          });
        }
      });
      if (promo.applies_to === 'transaction' && promo.promo_type === 'percentage') {
        const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
        const amount = Math.round((subtotal * promo.discount_percent) / 100);
        if (amount > cart_discount) {
          cart_discount = amount;
          cart_promo = promo;
        }
      }
    }
    const total = line_discounts.reduce((s, d) => s + d.discount_amount, 0) + cart_discount;
    return { line_discounts, cart_discount, cart_discount_promo_id: cart_promo?.id, total_discount: total };
  };

  // ----- report helpers -----
  const summaryRows = (from?: string, to?: string) => {
    const byDay = new Map<string, Row>();
    for (const s of salesIn(from, to)) {
      const day = s.created_at.slice(0, 10);
      const row = byDay.get(day) || { period_label: day, transaction_count: 0, total_revenue: 0, total_discount: 0, total_cogs: 0, gross_profit: 0 };
      row.transaction_count++;
      row.total_revenue += s.grand_total;
      row.total_discount += s.discount_amount;
      row.total_cogs += s.total_cogs || 0;
      row.gross_profit += s.grand_total - (s.total_cogs || 0);
      byDay.set(day, row);
    }
    return [...byDay.values()].sort((a, b) => a.period_label.localeCompare(b.period_label));
  };

  const linesIn = (from?: string, to?: string) => {
    const ids = new Set(salesIn(from, to).map((s) => s.id));
    return db.saleLines.filter((l) => ids.has(l.sale_id));
  };

  const filterSales = (f: Row = {}) =>
    salesIn(f.date_from, f.date_to).filter((s) => {
      if (f.customer_id && s.customer_id !== f.customer_id) return false;
      if (f.user_id && s.user_id !== f.user_id) return false;
      if (f.payment_method && s._method !== f.payment_method) return false;
      if (f.price_type && s.price_type !== f.price_type) return false;
      return true;
    });

  const recapRow = (s: Row) => {
    const items = db.saleLines.filter((l) => l.sale_id === s.id);
    const cust = customerOf(s);
    return {
      sale_id: s.id,
      transaction_no: s.transaction_no,
      created_at: s.created_at,
      status: s.status,
      price_type: s.price_type,
      customer_name: cust.name,
      customer_tier: cust.customer_tier,
      cashier_name: s._cashier || owner.name,
      total_amount: s.total_amount,
      discount_amount: s.discount_amount,
      tax_amount: s.tax_amount,
      grand_total: s.grand_total,
      total_cogs: s.total_cogs || 0,
      gross_profit: s.grand_total - (s.total_cogs || 0),
      gross_margin: s.grand_total ? ((s.grand_total - (s.total_cogs || 0)) / s.grand_total) * 100 : 0,
      payment_methods: s._method,
      total_items: items.reduce((n, l) => n + l.qty, 0),
    };
  };

  const expiringRows = (daysAhead: number) => {
    const batches = [
      ['item_6', 'LOT-6A1', 21, 6],
      ['item_14', 'LOT-14B2', 38, 3],
      ['item_29', 'LOT-29C1', 12, 5],
      ['item_16', 'LOT-16A9', 64, 9],
      ['item_10', 'LOT-10D4', 80, 14],
    ] as const;
    return batches
      .filter(([, , days]) => days <= daysAhead)
      .map(([itemId, batch, days, qty]) => {
        const it = byId(db.items, itemId)!;
        return { item_name: it.name, sku: it.sku, batch_no: batch, expiry_date: dateStr(addDays(now, days)), qty, days_left: days };
      });
  };

  const stockRow = (it: Row) => ({
    item_id: it.id,
    item_name: it.name,
    sku: it.sku,
    min_stock: it.min_stock,
    has_expiry: it.has_expiry,
    hpp_method: it.hpp_method,
    category_name: it.category_name,
    unit_id: it.base_unit_id,
    unit_name: it.base_unit_name,
    current_qty: it.current_stock,
    is_low_stock: it.current_stock <= it.min_stock,
    has_ledger_entries: true,
  });

  const permissionDefs = [
    ['sales.create', 'Transaksi kasir', 'Membuat penjualan', 'Penjualan'],
    ['sales.discount', 'Ubah harga & diskon', 'Mengubah harga di kasir', 'Penjualan'],
    ['sales.void', 'Batalkan transaksi', 'Membatalkan dan retur', 'Penjualan'],
    ['items.view', 'Lihat produk', 'Melihat katalog', 'Produk'],
    ['items.create', 'Tambah produk', 'Membuat produk baru', 'Produk'],
    ['items.edit', 'Ubah produk', 'Mengedit produk', 'Produk'],
    ['items.change_price', 'Ubah harga', 'Mengatur harga jual & HPP', 'Produk'],
    ['inventory.view', 'Lihat stok', 'Melihat stok & mutasi', 'Stok'],
    ['inventory.adjust', 'Sesuaikan stok', 'Penyesuaian & opname', 'Stok'],
    ['purchasing.view', 'Lihat pembelian', 'Melihat PO & penerimaan', 'Pembelian'],
    ['purchasing.create', 'Buat pembelian', 'Membuat PO & menerima barang', 'Pembelian'],
    ['crm.customers', 'Kelola pelanggan', 'Pelanggan & member', 'Pelanggan'],
    ['promos.manage', 'Kelola promo', 'Membuat promo', 'Pelanggan'],
    ['reports.view', 'Lihat laporan', 'Laporan penjualan & stok', 'Laporan'],
    ['reports.export', 'Ekspor laporan', 'Ekspor Excel/CSV', 'Laporan'],
    ['accounting.manage', 'Akuntansi', 'Jurnal & laporan keuangan', 'Laporan'],
    ['settings.general', 'Pengaturan umum', 'Profil toko', 'Pengaturan'],
    ['settings.users', 'Kelola pengguna', 'Akun & hak akses', 'Pengaturan'],
  ].map(([key, name, description, category]) => ({ key, name, description, category }));

  const roleDefaults: Row = {
    owner: permissionDefs.map((p) => p.key),
    kasir: ['sales.create', 'items.view', 'inventory.view', 'crm.customers'],
    apoteker: ['sales.create', 'items.view', 'items.edit', 'inventory.view', 'inventory.adjust', 'crm.customers', 'reports.view'],
  };

  // ----- scripted Kivo AI -----
  const aiReply = (messages: Row[]) => {
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content?.toLowerCase() || '';
    const today = dateStr(now);
    const todaySales = salesIn(today, today);
    const revenue = todaySales.reduce((s, x) => s + x.grand_total, 0);
    const profit = todaySales.reduce((s, x) => s + x.grand_total - (x.total_cogs || 0), 0);
    const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
    let content: string;
    if (/stok|habis|menipis|restock/.test(last)) {
      const low = db.items.filter((i) => i.current_stock <= i.min_stock).slice(0, 5);
      content =
        `**${low.length} produk perlu restock:**\n` +
        low.map((i) => `- ${i.name}: sisa ${i.current_stock} ${i.base_unit_name} (min ${i.min_stock})`).join('\n') +
        '\n\nMau saya buatkan draft pesanan pembelian?';
    } else if (/pelanggan|member|vip/.test(last)) {
      const top = db.customers
        .filter((c) => c.customer_tier !== 'regular')
        .sort((a, b) => b.loyalty_points - a.loyalty_points)
        .slice(0, 4);
      content =
        '**Member teratas bulan ini:**\n' +
        top.map((c, i) => `${i + 1}. ${c.name} (${c.customer_tier.toUpperCase()}): ${c.loyalty_points} poin`).join('\n');
    } else if (/laba|untung|profit/.test(last)) {
      content = `Laba kotor hari ini **${rp(profit)}** dari omzet ${rp(revenue)} (margin ${revenue ? ((profit / revenue) * 100).toFixed(1) : 0}%).`;
    } else {
      content =
        `**Ringkasan hari ini:**\n- Omzet: ${rp(revenue)}\n- Transaksi: ${todaySales.length}\n- Laba kotor: ${rp(profit)}\n\n` +
        'Tanyakan stok, pelanggan, atau laba kapan saja.';
    }
    return { choices: [{ message: { role: 'assistant', content } }] };
  };

  // =====================================================================================
  const handlers: Record<string, (p: Params) => any> = {
    // --- session & settings ---
    login: () => ({ token: DEMO_TOKEN, user: sessionUser }),
    logout: () => null,
    get_current_user: () => sessionUser,
    get_settings: () => Object.entries(db.settings).map(([key, value]) => ({ key, value })),
    set_setting: (p) => {
      db.settings[p.key] = p.value;
      return null;
    },
    get_sync_status: () => ({
      workspace_id: '',
      workspace_name: 'Apotek Sehat Sentosa',
      workspace_code: 'KIVO-DEMO',
      pending_count: 0,
      failed_count: 0,
      last_synced: dateTimeStr(now),
      auto_sync: false,
    }),
    get_banks: () => [
      { id: 'b1', name: 'BCA', code: '014' },
      { id: 'b2', name: 'Mandiri', code: '008' },
      { id: 'b3', name: 'BRI', code: '002' },
    ],

    // --- masters ---
    get_categories: () => db.categories,
    add_category: (p) => {
      const c = { id: id('cat'), name: p.name, created_at: dateTimeStr(new Date()) };
      db.categories.push(c);
      return c;
    },
    get_brands: () => db.brands,

    // --- items & stock ---
    get_items_filtered: (p) => {
      const q = (p.search || '').toLowerCase();
      let rows = db.items.filter((it) => {
        if (p.activeOnly && !it.is_active) return false;
        if (p.categoryId && it.category_id !== p.categoryId) return false;
        if (p.brandId && it.brand_id !== p.brandId) return false;
        if (!q) return true;
        return [it.name, it.sku, it.barcode, it.generic_name].some((v) => (v || '').toLowerCase().includes(q));
      });
      const dir = p.sortOrder === 'desc' ? -1 : 1;
      const key = p.sortBy === 'price' ? 'price' : p.sortBy === 'sku' ? 'sku' : p.sortBy === 'category' ? 'category_name' : 'name';
      rows = [...rows].sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
      const perPage = p.perPage || 20;
      const page = p.page || 1;
      return { items: rows.slice((page - 1) * perPage, page * perPage).map(strip), total: rows.length, page, per_page: perPage };
    },
    get_item: (p) => {
      const it = byId(db.items, p.id)!;
      return {
        item: strip(it),
        units: db.units.filter((u) => u.item_id === it.id),
        prices: ['regular', 'member', 'vip'].map((t, i) => ({
          id: `ip_${it.id}_${t}`,
          item_id: it.id,
          unit_id: it.base_unit_id,
          customer_tier: t,
          price: Math.round((it.price * (1 - i * 0.04)) / 100) * 100,
        })),
        price_tiers: it.price_tiers,
        active_batches: it.has_expiry
          ? [{ batch_no: `B${it.id.slice(5)}-A`, expiry_date: dateStr(addDays(now, it._expMonths * 30)), current_qty: it.current_stock }]
          : [],
      };
    },
    add_item: (p) => {
      const n = db.items.length + 1;
      const it = {
        ...p.payload,
        id: id('item'),
        is_active: 1,
        created_at: dateTimeStr(now),
        current_stock: 0,
        price_tiers: [],
        base_unit_id: `unit_new_${n}`,
        base_unit_name: 'Pcs',
      };
      db.items.unshift(it);
      bump();
      return strip(it);
    },
    update_item: (p) => {
      const it = byId(db.items, p.id)!;
      Object.assign(it, p.payload);
      bump();
      return strip(it);
    },
    toggle_item_active: (p) => {
      const it = byId(db.items, p.id)!;
      it.is_active = it.is_active ? 0 : 1;
      return null;
    },
    set_item_cost_price: (p) => {
      byId(db.items, p.id)!.cost_price = p.costPrice;
      return null;
    },
    set_item_price: (p) => {
      const it = byId(db.items, p.itemId)!;
      if (p.customerTier === 'regular') it.price = p.price;
      bump();
      return { id: id('ip'), item_id: p.itemId, unit_id: p.unitId, customer_tier: p.customerTier, price: p.price };
    },
    get_item_price_tiers: (p) => byId(db.items, p.itemId)?.price_tiers || [],
    get_stock_overview: () => db.items.map(stockRow),
    get_low_stock_alerts: () =>
      db.items
        .filter((i) => i.current_stock <= i.min_stock)
        .map((i) => ({ item_id: i.id, item_name: i.name, sku: i.sku, current_qty: i.current_stock, min_stock: i.min_stock, unit_name: i.base_unit_name })),
    get_stock_movements: (p) => {
      const it = byId(db.items, p.itemId)!;
      const rows: Row[] = [
        ...db.ledger.filter((l) => l.item_id === it.id).map((l) => ({ ...l })),
        ...db.saleLines
          .filter((l) => l.item_id === it.id)
          .slice(-12)
          .map((l) => {
            const sale = byId(db.sales, l.sale_id)!;
            return {
              id: `mv_${l.id}`,
              direction: 'out',
              qty_change: l.qty,
              source_type: 'sale',
              notes: sale.transaction_no,
              created_by_name: sale._cashier,
              created_at: sale.created_at,
            };
          }),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      let running = it.current_stock;
      return rows.slice(0, p.limit || 50).map((r) => {
        const out = { ...r, running_total: running, created_by_name: r.created_by_name || r.created_by };
        running += r.direction === 'out' ? r.qty_change : -r.qty_change;
        return out;
      });
    },
    adjust_stock: (p) => {
      const it = byId(db.items, p.itemId)!;
      it.current_stock += p.direction === 'in' ? p.qty : -p.qty;
      const row = {
        id: id('led'),
        item_id: it.id,
        unit_id: p.unitId,
        branch_id: BRANCH_ID,
        qty_change: p.qty,
        direction: p.direction,
        source_type: 'adjustment',
        notes: p.notes || 'Penyesuaian stok',
        created_by: owner.name,
        created_at: dateTimeStr(new Date()),
      };
      db.ledger.push(row);
      bump();
      return row;
    },
    set_initial_stock: (p) => {
      byId(db.items, p.itemId)!.current_stock = p.qty;
      bump();
      return { id: id('led'), item_id: p.itemId, qty_change: p.qty, direction: 'in' };
    },
    bulk_add_stock: () => 0,
    create_opname_session: () => id('opname'),
    submit_opname_lines: () => null,
    finalize_opname: () => null,

    // --- suppliers / customers ---
    get_suppliers: (p) => {
      const q = (p.search || '').toLowerCase();
      return db.suppliers.filter((s) => !q || s.name.toLowerCase().includes(q));
    },
    add_supplier: (p) => {
      const s = { id: id('sup'), name: p.name, contact_person: p.contactPerson, phone: p.phone, is_active: 1, created_at: dateTimeStr(now), updated_at: dateTimeStr(now) };
      db.suppliers.push(s);
      return s;
    },
    get_customers: (p) => {
      const q = (p.search || '').toLowerCase();
      return db.customers.filter((c) => {
        if (p.activeOnly && !c.is_active) return false;
        if (p.tier && c.customer_tier !== p.tier) return false;
        return !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
      });
    },
    add_customer: (p) => {
      const c = {
        id: id('cust'),
        name: p.name,
        phone: p.phone || undefined,
        email: p.email || undefined,
        address: p.address || undefined,
        region: p.region || undefined,
        customer_tier: p.customerTier || 'regular',
        loyalty_points: 0,
        notes: p.notes || undefined,
        membership_expiry: p.membershipExpiry || undefined,
        is_active: 1,
        created_at: dateTimeStr(new Date()),
        updated_at: dateTimeStr(new Date()),
      };
      db.customers.splice(1, 0, c);
      bump();
      return c;
    },
    update_customer: (p) => {
      const c = byId(db.customers, p.id)!;
      Object.assign(c, {
        name: p.name,
        phone: p.phone || undefined,
        email: p.email || undefined,
        address: p.address || undefined,
        region: p.region || undefined,
        customer_tier: p.customerTier,
        notes: p.notes || undefined,
        membership_expiry: p.membershipExpiry || undefined,
        updated_at: dateTimeStr(new Date()),
      });
      bump();
      return c;
    },
    toggle_customer_active: (p) => {
      const c = byId(db.customers, p.id)!;
      c.is_active = c.is_active ? 0 : 1;
      return null;
    },
    get_health_records: (p) => db.health.filter((h) => h.customer_id === p.customerId),
    save_health_record: (p) => {
      const input = p.input;
      const rec = {
        ...input,
        id: input.id || id('hr'),
        checked_at: input.checked_at || dateTimeStr(new Date()),
        created_at: dateTimeStr(new Date()),
        updated_at: dateTimeStr(new Date()),
        medicines: (input.medicines || []).map((m: Row) => ({ ...m, id: id('hm') })),
      };
      db.health = [rec, ...db.health.filter((h) => h.id !== rec.id)];
      return rec;
    },
    delete_health_record: (p) => {
      db.health = db.health.filter((h) => h.id !== p.id);
      return null;
    },
    get_medicine_presets: () => [],

    // --- sales ---
    get_next_transaction_no: () => nextTrx(),
    get_sales: (p) => {
      const rows = db.sales
        .filter((s) => !p.customerId || s.customer_id === p.customerId)
        .slice(-250)
        .reverse();
      return rows.map(({ _cashier, _customer, _method, ...s }) => {
        void _cashier;
        void _customer;
        void _method;
        return s;
      });
    },
    get_sale_detail: (p) => {
      const s = byId(db.sales, p.id)!;
      const { _cashier, _customer, _method, ...sale } = s;
      void _customer;
      void _method;
      return {
        sale,
        lines: db.saleLines.filter((l) => l.sale_id === s.id),
        payments: db.payments.filter((x) => x.sale_id === s.id),
        cashier_name: _cashier || owner.name,
      };
    },
    create_sale: (p) => {
      const input = p.input;
      const saleId = id('sale');
      const created = new Date();
      const cust = byId(db.customers, input.customer_id) || db.customers[0];
      let cogs = 0;
      (input.lines as Row[]).forEach((l, i) => {
        const it = byId(db.items, l.item_id);
        if (it) {
          it.current_stock = Math.max(0, it.current_stock - l.qty);
          cogs += (it.cost_price || 0) * l.qty;
          db.ledger.push({
            id: id('led'),
            item_id: it.id,
            unit_id: l.unit_id,
            branch_id: BRANCH_ID,
            qty_change: l.qty,
            direction: 'out',
            source_type: 'sale',
            created_at: dateTimeStr(created),
          });
        }
        db.saleLines.push({
          id: `sl_${saleId}_${i}`,
          sale_id: saleId,
          item_id: l.item_id,
          item_name: it?.name,
          sku: it?.sku,
          category_name: it?.category_name,
          unit_id: l.unit_id,
          unit_name: it?.base_unit_name,
          qty: l.qty,
          price_type: l.price_type,
          price: l.price,
          discount_amount: l.discount_amount || 0,
          subtotal: l.price * l.qty - (l.discount_amount || 0),
          hpp_value: it?.cost_price || 0,
        });
      });
      const method = input.payments?.[0]?.method || 'cash';
      db.sales.push({
        id: saleId,
        transaction_no: nextTrx(),
        branch_id: BRANCH_ID,
        customer_id: cust.id,
        user_id: owner.id,
        total_amount: input.total_amount,
        discount_amount: input.discount_amount,
        tax_amount: input.tax_amount,
        grand_total: input.grand_total,
        status: 'completed',
        price_type: input.price_type,
        notes: input.notes,
        created_at: dateTimeStr(created).replace(' ', 'T'),
        total_cogs: cogs,
        _cashier: owner.name,
        _customer: cust,
        _method: method,
      });
      (input.payments as Row[]).forEach((pay) =>
        db.payments.push({ id: id('pay'), sale_id: saleId, amount: pay.amount, method: pay.method, reference: pay.reference, created_at: dateTimeStr(created) }),
      );
      if (cust.id !== 'customer_umum') cust.loyalty_points += Math.floor(input.grand_total / 10000);
      bump();
      return saleId;
    },
    delete_sale: (p) => {
      const s = byId(db.sales, p.id);
      if (s) s.status = 'void';
      bump();
      return null;
    },
    create_sale_return: () => null,

    // --- promos ---
    get_promos: (p) => (p.activeOnly ? db.promos.filter((x) => x.active) : db.promos),
    get_promo_detail: (p) => ({
      promo: byId(db.promos, p.id),
      bogo_rules: p.id === 'promo_2' ? [{ id: 'bogo_1', promo_id: p.id, buy_qty: 2, get_qty: 1, free_item_id: 'item_7' }] : [],
      tiers: p.id === 'promo_4' ? [{ id: 't1', promo_id: p.id, min_qty: 5, discount_percent: 5 }, { id: 't2', promo_id: p.id, min_qty: 20, discount_percent: 12 }] : [],
      bundle_items: [],
    }),
    create_promo: (p) => {
      const promo = { ...p.input, id: id('promo'), active: 1, created_at: dateTimeStr(now) };
      db.promos.unshift(promo);
      bump();
      return promo;
    },
    update_promo: (p) => {
      const promo = byId(db.promos, p.id)!;
      Object.assign(promo, p.input);
      bump();
      return promo;
    },
    delete_promo: (p) => {
      db.promos = db.promos.filter((x) => x.id !== p.id);
      return null;
    },
    toggle_promo_active: (p) => {
      const promo = byId(db.promos, p.id)!;
      promo.active = promo.active ? 0 : 1;
      return null;
    },
    calculate_discounts: calculateDiscounts,

    // --- purchasing ---
    get_purchase_orders: () => db.purchaseOrders,
    get_po_lines: (p) => db.poLines.filter((l) => l.po_id === p.poId),
    create_purchase_order: (p) => {
      const poId = id('po');
      const sup = byId(db.suppliers, p.supplierId);
      db.purchaseOrders.unshift({
        id: poId,
        branch_id: BRANCH_ID,
        supplier_id: p.supplierId,
        supplier_name: sup?.name,
        status: 'ordered',
        expected_date: p.expectedDate,
        notes: p.notes,
        created_by: owner.name,
        created_at: dateTimeStr(new Date()),
      });
      (p.lines as Row[]).forEach((l, i) => {
        const it = byId(db.items, l.item_id);
        db.poLines.push({ id: `pol_${poId}_${i}`, po_id: poId, item_id: l.item_id, item_name: it?.name, unit_id: l.unit_id, unit_name: it?.base_unit_name, qty_ordered: l.qty, qty_received: 0, price_estimate: l.price });
      });
      bump();
      return poId;
    },
    cancel_purchase_order: (p) => {
      const po = byId(db.purchaseOrders, p.id);
      if (po) po.status = 'cancelled';
      return null;
    },
    receive_goods: (p) => {
      (p.lines as Row[]).forEach((l) => {
        const it = byId(db.items, l.item_id);
        if (it) it.current_stock += l.qty_received;
      });
      const po = byId(db.purchaseOrders, p.poId);
      if (po) po.status = 'received';
      bump();
      return id('pur');
    },
    receive_goods_direct: (p) => {
      (p.lines as Row[]).forEach((l) => {
        const it = byId(db.items, l.item_id);
        if (it) it.current_stock += l.qty_received;
      });
      bump();
      return id('pur');
    },
    get_purchases: () => db.purchases.map(({ _paid, ...x }) => (void _paid, x)),
    get_purchase_detail: (p) => {
      const { _paid, ...purchase } = byId(db.purchases, p.id)!;
      void _paid;
      return {
        purchase,
        lines: db.purchaseLines.filter((l) => l.purchase_id === p.id),
        payments: db.purchasePayments.filter((x) => x.purchase_id === p.id),
        returns: [],
      };
    },
    add_purchase_payment: (p) => {
      const pur = byId(db.purchases, p.purchaseId)!;
      pur._paid += p.amount;
      pur.status = pur._paid >= pur.total_amount ? 'paid' : 'unpaid';
      db.purchasePayments.push({ id: id('purp'), purchase_id: pur.id, amount: p.amount, method: p.method, created_at: dateTimeStr(new Date()) });
      bump();
      return null;
    },

    // --- accounting ---
    get_accounts: () => db.accounts,
    get_journal_entries: () => db.journals.map((j) => j.entry),
    get_journal_detail: (p) => db.journals.find((j) => j.entry.id === p.id),
    create_manual_journal: () => id('je'),
    cash_in: () => id('je'),
    cash_out: () => id('je'),
    get_trial_balance: () => {
      const totals = new Map<string, { d: number; c: number }>();
      db.journals.forEach((j) =>
        j.lines.forEach((l: Row) => {
          const t = totals.get(l.account_id) || { d: 0, c: 0 };
          t.d += l.debit;
          t.c += l.credit;
          totals.set(l.account_id, t);
        }),
      );
      return db.accounts
        .filter((a) => totals.has(a.id))
        .map((a) => {
          const t = totals.get(a.id)!;
          return { account_id: a.id, code: a.code, name: a.name, type: a.type, total_debit: t.d, total_credit: t.c, balance: a.normal_balance === 'debit' ? t.d - t.c : t.c - t.d };
        });
    },
    get_profit_loss: (p) => {
      const sales = salesIn(p.startDate, p.endDate);
      const revenue = sales.reduce((s, x) => s + x.total_amount, 0);
      const discounts = sales.reduce((s, x) => s + x.discount_amount, 0);
      const cogs = sales.reduce((s, x) => s + (x.total_cogs || 0), 0);
      const expenses = [
        { account_code: '6-1000', account_name: 'Beban Gaji', amount: 6800000 },
        { account_code: '6-2000', account_name: 'Beban Sewa', amount: 3500000 },
        { account_code: '6-3000', account_name: 'Beban Listrik & Air', amount: 1250000 },
        { account_code: '6-4000', account_name: 'Beban Pemasaran', amount: 900000 },
      ];
      const expTotal = expenses.reduce((s, x) => s + x.amount, 0);
      const net = revenue - discounts;
      return {
        revenue: { group_name: 'Pendapatan', rows: [{ account_code: '4-1000', account_name: 'Penjualan', amount: revenue }, { account_code: '4-2000', account_name: 'Potongan Penjualan', amount: -discounts }], total: net },
        cogs: { group_name: 'Harga Pokok Penjualan', rows: [{ account_code: '5-1000', account_name: 'Harga Pokok Penjualan', amount: cogs }], total: cogs },
        gross_profit: net - cogs,
        expenses: { group_name: 'Beban Operasional', rows: expenses, total: expTotal },
        net_profit: net - cogs - expTotal,
      };
    },
    get_balance_sheet: () => {
      const inventory = db.items.reduce((s, i) => s + i.current_stock * i.cost_price, 0);
      const cash = 18450000;
      const bank = 42600000;
      const equipment = 25000000;
      const payables = db.purchases.reduce((s, x) => s + (x.total_amount - x._paid), 0);
      const assets = cash + bank + inventory + equipment;
      const capital = 60000000;
      return {
        assets: [
          { account_code: '1-1100', account_name: 'Kas', amount: cash },
          { account_code: '1-1200', account_name: 'Bank', amount: bank },
          { account_code: '1-1400', account_name: 'Persediaan Barang', amount: inventory },
          { account_code: '1-2100', account_name: 'Peralatan Toko', amount: equipment },
        ],
        total_assets: assets,
        liabilities: [{ account_code: '2-1100', account_name: 'Utang Usaha', amount: payables }],
        equity: [
          { account_code: '3-1000', account_name: 'Modal Pemilik', amount: capital },
          { account_code: '3-2000', account_name: 'Laba Ditahan', amount: assets - payables - capital },
        ],
        total_liabilities_equity: assets,
      };
    },

    // --- reports ---
    get_sales_summary: (p) => summaryRows(p.dateFrom, p.dateTo),
    get_top_selling_items: (p) => {
      const agg = new Map<string, Row>();
      linesIn(p.dateFrom, p.dateTo).forEach((l) => {
        const r = agg.get(l.item_id) || { item_name: l.item_name, sku: l.sku, category_name: l.category_name, qty_sold: 0, total_revenue: 0, total_cogs: 0, gross_margin: 0 };
        r.qty_sold += l.qty;
        r.total_revenue += l.subtotal;
        r.total_cogs += l.hpp_value * l.qty;
        agg.set(l.item_id, r);
      });
      return [...agg.values()]
        .map((r: Row): Row => ({ ...r, gross_margin: r.total_revenue ? ((r.total_revenue - r.total_cogs) / r.total_revenue) * 100 : 0 }))
        .sort((a: Row, b: Row) => b.total_revenue - a.total_revenue)
        .slice(0, p.limit || 20);
    },
    get_sales_by_payment_method: (p) => {
      const agg = new Map<string, Row>();
      salesIn(p.dateFrom, p.dateTo).forEach((s) => {
        const r = agg.get(s._method) || { method: s._method, transaction_count: 0, total_amount: 0 };
        r.transaction_count++;
        r.total_amount += s.grand_total;
        agg.set(s._method, r);
      });
      return [...agg.values()].sort((a, b) => b.total_amount - a.total_amount);
    },
    get_stock_valuation: () =>
      db.items.map((i) => ({ item_name: i.name, sku: i.sku, category_name: i.category_name, unit_name: i.base_unit_name, current_qty: i.current_stock, avg_hpp: i.cost_price, total_value: i.current_stock * i.cost_price })),
    get_expiring_items: (p) => expiringRows(p.daysAhead || 30),
    get_outstanding_payables: () =>
      db.purchases
        .filter((x) => x.total_amount - x._paid > 0)
        .map((x) => ({
          purchase_id: x.id,
          supplier_name: byId(db.suppliers, x.supplier_id)?.name,
          invoice_no: x.invoice_no,
          total_amount: x.total_amount,
          paid_amount: x._paid,
          balance: x.total_amount - x._paid,
          created_at: x.created_at,
        })),
    get_purchase_summary: () =>
      db.suppliers.map((s) => {
        const rows = db.purchases.filter((x) => x.supplier_id === s.id);
        return { supplier_name: s.name, purchase_count: rows.length, total_amount: rows.reduce((n, x) => n + x.total_amount, 0), paid_amount: rows.reduce((n, x) => n + x._paid, 0) };
      }),
    get_customer_report: (p) => {
      const agg = new Map<string, Row>();
      salesIn(p.dateFrom, p.dateTo).forEach((s) => {
        const c = customerOf(s);
        if (c.id === 'customer_umum') return;
        const r = agg.get(c.id) || { customer_name: c.name, customer_tier: c.customer_tier, transaction_count: 0, total_spent: 0 };
        r.transaction_count++;
        r.total_spent += s.grand_total;
        agg.set(c.id, r);
      });
      return [...agg.values()].sort((a, b) => b.total_spent - a.total_spent).slice(0, p.limit || 20);
    },
    get_sales_recap_report: (p) => filterSales(p.filter).map(recapRow).reverse(),
    get_detailed_sales_lines: (p) =>
      filterSales(p.filter)
        .flatMap((s) =>
          db.saleLines
            .filter((l) => l.sale_id === s.id)
            .map((l) => ({
              sale_id: s.id,
              transaction_no: s.transaction_no,
              created_at: s.created_at,
              status: s.status,
              price_type: s.price_type,
              customer_name: customerOf(s).name,
              cashier_name: s._cashier,
              line_id: l.id,
              item_id: l.item_id,
              item_name: l.item_name,
              sku: l.sku,
              category_name: l.category_name,
              qty: l.qty,
              unit_name: l.unit_name,
              price: l.price,
              line_discount: l.discount_amount,
              subtotal: l.subtotal,
              hpp_value: l.hpp_value,
              line_cogs: l.hpp_value * l.qty,
              line_profit: l.subtotal - l.hpp_value * l.qty,
              payment_methods: s._method,
            })),
        )
        .reverse(),
    get_sales_by_cashier_summary: (p) => {
      const agg = new Map<string, Row>();
      filterSales(p.filter).forEach((s) => {
        const r = agg.get(s.user_id) || { user_id: s.user_id, cashier_name: s._cashier, role: byId(db.users, s.user_id)?.role || 'kasir', transaction_count: 0, total_cash: 0, total_non_cash: 0, total_revenue: 0, total_discount: 0, total_cogs: 0, gross_profit: 0 };
        r.transaction_count++;
        if (s._method === 'cash') r.total_cash += s.grand_total;
        else r.total_non_cash += s.grand_total;
        r.total_revenue += s.grand_total;
        r.total_discount += s.discount_amount;
        r.total_cogs += s.total_cogs || 0;
        r.gross_profit += s.grand_total - (s.total_cogs || 0);
        agg.set(s.user_id, r);
      });
      return [...agg.values()];
    },
    get_daily_sales_recap: (p) => {
      const agg = new Map<string, Row>();
      filterSales(p.filter).forEach((s) => {
        const day = s.created_at.slice(0, 10);
        const r = agg.get(day) || { date: day, date_label: new Date(day).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }), transaction_count: 0, total_cash: 0, total_non_cash: 0, total_revenue: 0, total_discount: 0, total_cogs: 0, gross_profit: 0, gross_margin: 0 };
        r.transaction_count++;
        if (s._method === 'cash') r.total_cash += s.grand_total;
        else r.total_non_cash += s.grand_total;
        r.total_revenue += s.grand_total;
        r.total_discount += s.discount_amount;
        r.total_cogs += s.total_cogs || 0;
        r.gross_profit += s.grand_total - (s.total_cogs || 0);
        agg.set(day, r);
      });
      return [...agg.values()]
        .map((r: Row): Row => ({ ...r, gross_margin: r.total_revenue ? (r.gross_profit / r.total_revenue) * 100 : 0 }))
        .sort((a: Row, b: Row) => b.date.localeCompare(a.date));
    },

    // --- users & access ---
    get_users: () => db.users.map((u) => ({ ...u, permissions: undefined, is_custom_perms: false, workspace_id: 'ws_demo' })),
    get_permission_definitions: () => permissionDefs,
    get_role_default_permissions: () => Object.entries(roleDefaults).map(([role, permissions]) => ({ role, permissions })),
    get_user_permissions: (p) => {
      const u = byId(db.users, p.userId)!;
      return { user_id: u.id, user_name: u.name, username: u.username, role: u.role, is_custom: false, permissions: roleDefaults[u.role], role_defaults: roleDefaults[u.role] };
    },
    toggle_user_active: () => null,

    // --- hardware, LAN, MCP ---
    list_printers: () => [
      { Name: 'EPSON TM-T82', DriverName: 'EPSON TM-T82 Receipt', PortName: 'USB001', PrinterStatus: 0, Default: true },
      { Name: 'HPRT TP80K', DriverName: 'HPRT Thermal', PortName: 'USB002', PrinterStatus: 0, Default: false },
    ],
    kick_cash_drawer: () => 'ok',
    print_raw_receipt: () => 'ok',
    get_lan_status: () => ({
      device_id: 'kivo-demo-host',
      device_name: 'Kasir Utama',
      role: 'parent',
      local_ip: '192.168.1.8',
      http_port: 3699,
      auto_connect: true,
      last_sync_time: dateTimeStr(now),
      last_sync_status: 'success',
      peers_count: 3,
      is_server_running: true,
    }),
    get_lan_peers: () => [
      { device_id: 'p1', device_name: 'Kasir Utama', role: 'parent', ip_address: '192.168.1.8', http_port: 3699, workspace_id: 'ws_demo', last_seen: Date.now(), is_self: true, is_paired: true },
      { device_id: 'p2', device_name: 'HP Kasir Rizky', role: 'child', ip_address: '192.168.1.21', http_port: 3699, workspace_id: 'ws_demo', last_seen: Date.now(), is_self: false, is_paired: true },
      { device_id: 'p3', device_name: 'Tablet Gudang', role: 'child', ip_address: '192.168.1.34', http_port: 3699, workspace_id: 'ws_demo', last_seen: Date.now(), is_self: false, is_paired: true },
    ],
    get_mcp_status: () => ({ running: true, enabled: true, port: 3700, url: 'http://127.0.0.1:3700/mcp', token: 'kivo_mcp_demo_token', tool_count: 40, last_call_at: null, total_calls: 128 }),
    send_ai_chat_request: (p) => aiReply(p.request?.messages || []),
  };

  // ----- fetch interception -----
  const realFetch = window.fetch.bind(window);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (!url.pathname.includes('/api/lan/')) return realFetch(input, init);

    if (!online) throw new TypeError('Failed to fetch');
    const path = url.pathname.slice(url.pathname.indexOf('/api/lan/'));

    if (path === '/api/lan/info') {
      return json({ app: 'kivo', version: __APP_VERSION__, device_name: 'Kasir Utama', role: 'parent', workspace_id: '', items_count: db.items.length, sales_count: db.sales.length });
    }
    if (path === '/api/lan/version') return json({ version });
    if (path === '/api/lan/active_session') return json({ success: true, token: DEMO_TOKEN, user: sessionUser });
    if (path === '/api/lan/poll') {
      const since = Number(url.searchParams.get('version') || 0);
      if (version > since) return json({ version, changed: since > 0, table: 'sales' });
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 20000);
        pollWaiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
      return json({ version, changed: version > since, table: 'sales' });
    }
    if (path === '/api/lan/rpc') {
      const body = JSON.parse(String(init?.body || '{}'));
      const handler = handlers[body.command];
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 45)); // feel like a real LAN round trip
      try {
        return json({ success: true, data: handler ? handler(body.params || {}) : [] });
      } catch (e: any) {
        return json({ success: false, error: e?.message || String(e) });
      }
    }
    return json({ success: false, error: 'not found' }, 404);
  };

  return {
    db,
    setOnline: (v) => {
      online = v;
    },
    isOnline: () => online,
  };
}
