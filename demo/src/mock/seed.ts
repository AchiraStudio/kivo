// Realistic seed data for the showcase: a small pharmacy-minimart with 30 days of sales.
// Everything is generated relative to "now" so the demo never looks stale.

export type Row = Record<string, any>;

export const BRANCH_ID = 'branch_001';

const pad = (n: number) => String(n).padStart(2, '0');
export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateTimeStr = (d: Date) => `${dateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Small deterministic PRNG so every visitor sees the same shop.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: [string, string][] = [
  ['cat_bebas', 'Obat Bebas'],
  ['cat_keras', 'Obat Keras'],
  ['cat_vit', 'Vitamin & Suplemen'],
  ['cat_alkes', 'Alat Kesehatan'],
  ['cat_rawat', 'Perawatan'],
  ['cat_bayi', 'Ibu & Bayi'],
  ['cat_minum', 'Minuman & Camilan'],
];

// name, generic, category, price, cost, stock, min, unit, rack, expiryMonths(0 = none)
const ITEM_TABLE: [string, string, string, number, number, number, number, string, string, number][] = [
  ['Paracetamol 500mg', 'Paracetamol', 'cat_bebas', 6500, 4200, 240, 40, 'Strip', 'A1', 14],
  ['Panadol Extra', 'Paracetamol + Kafein', 'cat_bebas', 11500, 8400, 96, 24, 'Strip', 'A1', 18],
  ['Bodrex', 'Paracetamol', 'cat_bebas', 4500, 3000, 130, 30, 'Strip', 'A1', 20],
  ['Promag', 'Antasida', 'cat_bebas', 9500, 6800, 72, 20, 'Strip', 'A2', 16],
  ['Mylanta Cair 150ml', 'Antasida', 'cat_bebas', 21500, 16200, 28, 10, 'Botol', 'A2', 12],
  ['OBH Combi Batuk 100ml', 'Ekspektoran', 'cat_bebas', 17500, 12500, 6, 12, 'Botol', 'A3', 10],
  ['Tolak Angin Cair', 'Herbal', 'cat_bebas', 4200, 3100, 310, 60, 'Sachet', 'A3', 15],
  ['Antangin JRG', 'Herbal', 'cat_bebas', 3800, 2800, 180, 40, 'Sachet', 'A3', 15],
  ['Komix Herbal', 'Herbal', 'cat_bebas', 2500, 1800, 220, 40, 'Sachet', 'A3', 14],
  ['Amoxicillin 500mg', 'Amoxicillin', 'cat_keras', 14500, 9800, 58, 20, 'Strip', 'B1', 9],
  ['Cefadroxil 500mg', 'Cefadroxil', 'cat_keras', 22000, 15500, 40, 15, 'Strip', 'B1', 9],
  ['Metformin 500mg', 'Metformin', 'cat_keras', 8500, 5200, 85, 25, 'Strip', 'B2', 18],
  ['Amlodipine 10mg', 'Amlodipine', 'cat_keras', 12500, 7600, 64, 20, 'Strip', 'B2', 20],
  ['Simvastatin 20mg', 'Simvastatin', 'cat_keras', 15500, 9300, 3, 15, 'Strip', 'B2', 7],
  ['Cetirizine 10mg', 'Cetirizine', 'cat_keras', 7500, 4300, 110, 25, 'Strip', 'B3', 22],
  ['Vitamin C 1000mg', 'Asam askorbat', 'cat_vit', 28500, 21000, 46, 15, 'Botol', 'C1', 19],
  ['Redoxon Effervescent', 'Vitamin C', 'cat_vit', 52500, 41000, 22, 8, 'Tube', 'C1', 14],
  ['Enervon-C', 'Multivitamin', 'cat_vit', 14500, 10500, 88, 20, 'Strip', 'C1', 17],
  ['Blackmores Multi', 'Multivitamin', 'cat_vit', 189000, 152000, 9, 4, 'Botol', 'C2', 24],
  ['Imboost Force', 'Echinacea', 'cat_vit', 56000, 43500, 31, 10, 'Strip', 'C2', 16],
  ['Termometer Digital', '', 'cat_alkes', 35000, 22500, 24, 6, 'Pcs', 'D1', 0],
  ['Tensimeter Digital', '', 'cat_alkes', 285000, 215000, 7, 3, 'Pcs', 'D1', 0],
  ['Masker Medis 3-Ply', '', 'cat_alkes', 22000, 14500, 60, 20, 'Box', 'D2', 0],
  ['Hansaplast Plester', '', 'cat_alkes', 6500, 4300, 140, 30, 'Box', 'D2', 0],
  ['Alkohol 70% 100ml', 'Etanol', 'cat_alkes', 8500, 5600, 75, 20, 'Botol', 'D2', 0],
  ['Betadine 30ml', 'Povidone iodine', 'cat_rawat', 18500, 13200, 52, 15, 'Botol', 'E1', 24],
  ['Minyak Kayu Putih 60ml', 'Herbal', 'cat_rawat', 17500, 12800, 90, 20, 'Botol', 'E1', 30],
  ['Hand Sanitizer 100ml', '', 'cat_rawat', 12500, 7800, 120, 30, 'Botol', 'E2', 18],
  ['Sunscreen SPF 50', '', 'cat_rawat', 65000, 46000, 18, 6, 'Tube', 'E2', 20],
  ['Susu Formula 1 400g', '', 'cat_bayi', 118000, 98000, 21, 8, 'Kaleng', 'F1', 11],
  ['Popok Bayi M-34', '', 'cat_bayi', 89000, 72000, 16, 6, 'Pak', 'F1', 0],
  ['Minyak Telon 60ml', 'Herbal', 'cat_bayi', 19500, 14000, 66, 15, 'Botol', 'F2', 24],
  ['Air Mineral 600ml', '', 'cat_minum', 3500, 2200, 360, 60, 'Botol', 'G1', 0],
  ['Pocari Sweat 500ml', '', 'cat_minum', 8500, 6200, 144, 36, 'Botol', 'G1', 9],
  ['Madu Murni 250ml', '', 'cat_minum', 48000, 35500, 29, 8, 'Botol', 'G2', 24],
  ['Biskuit Gandum', '', 'cat_minum', 9500, 6600, 84, 20, 'Pak', 'G2', 8],
];

export interface Db {
  categories: Row[];
  brands: Row[];
  items: Row[];
  units: Row[];
  customers: Row[];
  suppliers: Row[];
  promos: Row[];
  sales: Row[];
  saleLines: Row[];
  payments: Row[];
  ledger: Row[];
  purchaseOrders: Row[];
  poLines: Row[];
  purchases: Row[];
  purchaseLines: Row[];
  purchasePayments: Row[];
  accounts: Row[];
  journals: Row[];
  users: Row[];
  health: Row[];
  settings: Record<string, string>;
  seq: number;
}

export function createDb(now = new Date()): Db {
  const rand = rng(20261127);
  const created = dateTimeStr(addDays(now, -120));

  const categories = CATEGORIES.map(([id, name]) => ({ id, name, created_at: created }));
  const brands = ['Kimia Farma', 'Kalbe', 'Sanbe', 'Bayer', 'Sido Muncul'].map((name, i) => ({
    id: `brand_${i + 1}`,
    name,
    created_at: created,
  }));

  const items: Row[] = [];
  const units: Row[] = [];
  const ledger: Row[] = [];
  ITEM_TABLE.forEach(([name, generic, cat, price, cost, stock, min, unit, rack, expMonths], i) => {
    const n = i + 1;
    const id = `item_${n}`;
    const unitId = `unit_${n}`;
    const categoryName = CATEGORIES.find((c) => c[0] === cat)![1];
    const tiers =
      price < 30000 && stock > 60
        ? [
            { id: `tier_${n}_1`, item_id: id, unit_id: unitId, tier_level: 1, max_qty: 10, price },
            { id: `tier_${n}_2`, item_id: id, unit_id: unitId, tier_level: 2, max_qty: 50, price: Math.round((price * 0.94) / 100) * 100 },
            { id: `tier_${n}_3`, item_id: id, unit_id: unitId, tier_level: 3, max_qty: 999, price: Math.round((price * 0.88) / 100) * 100 },
          ]
        : [];
    items.push({
      id,
      sku: `${cat === 'cat_keras' ? 'RX' : cat === 'cat_alkes' ? 'AK' : 'MED'}-${1000 + n}`,
      barcode: `899${String(1000000 + n * 7919).slice(0, 7)}${n % 10}`,
      name,
      generic_name: generic || undefined,
      category_id: cat,
      category_name: categoryName,
      brand_id: brands[n % brands.length].id,
      hpp_method: 'avg',
      min_stock: min,
      has_expiry: expMonths > 0 ? 1 : 0,
      requires_prescription: cat === 'cat_keras' ? 1 : 0,
      cost_price: cost,
      rack_location: rack,
      item_type: 'goods',
      is_active: 1,
      created_at: created,
      wholesale_price: Math.round((price * 0.92) / 100) * 100,
      price,
      base_unit_id: unitId,
      base_unit_name: unit,
      avg_hpp: cost,
      current_stock: stock,
      price_tiers: tiers,
      _expMonths: expMonths,
    });
    units.push({ id: unitId, item_id: id, unit_name: unit, conversion: 1, is_base: 1, created_at: created });
    ledger.push({
      id: `led_${n}_0`,
      item_id: id,
      unit_id: unitId,
      branch_id: BRANCH_ID,
      qty_change: stock + 40,
      direction: 'in',
      source_type: 'purchase',
      hpp_value: cost,
      expiry_date: expMonths > 0 ? dateStr(addDays(now, expMonths * 30)) : undefined,
      batch_no: expMonths > 0 ? `B${n}-26${pad((n % 12) + 1)}` : undefined,
      notes: 'Penerimaan barang',
      created_by: 'Dewi Lestari',
      created_at: dateTimeStr(addDays(now, -40)),
    });
  });

  const tierLabel = ['regular', 'member', 'vip'];
  const customerSeed: [string, string, number, number, string][] = [
    ['Siti Rahmawati', '0812-3456-7890', 1, 8, 'Jakarta Selatan'],
    ['Budi Santoso', '0857-1111-2222', 2, 240, 'Tangerang'],
    ['Ani Wijaya', '0813-9000-1212', 1, -20, 'Depok'],
    ['Dedi Kurniawan', '0877-0000-1111', 0, 0, 'Bekasi'],
    ['Rina Marlina', '0821-5550-7788', 1, 120, 'Jakarta Timur'],
    ['Agus Prasetyo', '0819-2323-4545', 2, 300, 'Bogor'],
    ['Lestari Putri', '0896-7777-8888', 1, 20, 'Jakarta Barat'],
    ['Hendra Gunawan', '0852-1010-2020', 0, 0, 'Jakarta Utara'],
    ['Maya Anggraini', '0838-4444-5656', 1, 190, 'Depok'],
    ['Fajar Nugroho', '0878-3030-9090', 0, 0, 'Bekasi'],
    ['Putri Ayu', '0815-6767-1818', 1, 5, 'Tangerang Selatan'],
    ['Yusuf Hakim', '0859-2121-3434', 2, 410, 'Jakarta Pusat'],
  ];
  const customers: Row[] = [
    {
      id: 'customer_umum',
      name: 'Pelanggan Umum',
      customer_tier: 'regular',
      loyalty_points: 0,
      is_active: 1,
      created_at: created,
      updated_at: created,
    },
    ...customerSeed.map(([name, phone, tier, expiryDays, region], i) => ({
      id: `cust_${i + 1}`,
      name,
      phone: phone.replace(/-/g, ''),
      region,
      customer_tier: tierLabel[tier],
      loyalty_points: Math.round(rand() * 900),
      membership_expiry: tier === 0 ? undefined : `${dateStr(addDays(now, expiryDays))} 23:59:59`,
      is_active: 1,
      created_at: dateTimeStr(addDays(now, -90 + i * 5)),
      updated_at: created,
    })),
  ];

  const suppliers = [
    ['PT Kimia Farma Trading', 'Hendra Wijaya', '021-5551234', 'Net 30'],
    ['PT Kalbe Farma Distribusi', 'Sari Dewi', '021-5558899', 'Net 14'],
    ['PT Enseval Putera', 'Bambang S.', '021-5557766', 'Net 30'],
    ['CV Sehat Alkes Jaya', 'Rudi Hartono', '0812-8888-1234', 'Tunai'],
  ].map(([name, contact, phone, terms], i) => ({
    id: `sup_${i + 1}`,
    name,
    contact_person: contact,
    phone,
    payment_terms: terms,
    is_active: 1,
    created_at: created,
    updated_at: created,
  }));

  const promoBase = {
    discount_percent: 0,
    min_qty: 1,
    member_only: 0,
    active: 1,
    stack_rule: 'best',
    priority: 1,
    created_at: created,
    start_date: dateStr(addDays(now, -10)),
    end_date: dateStr(addDays(now, 45)),
  };
  const promos: Row[] = [
    { ...promoBase, id: 'promo_1', name: 'Diskon Vitamin 10%', description: 'Semua vitamin & suplemen', promo_type: 'percentage', discount_percent: 10, applies_to: 'category', category_id: 'cat_vit' },
    { ...promoBase, id: 'promo_2', name: 'Beli 2 Gratis 1 Tolak Angin', promo_type: 'bogo', applies_to: 'item', item_id: 'item_7', min_qty: 3 },
    { ...promoBase, id: 'promo_3', name: 'Member Hemat 5%', promo_type: 'percentage', discount_percent: 5, applies_to: 'transaction', member_only: 1 },
    { ...promoBase, id: 'promo_4', name: 'Grosir Masker', promo_type: 'tiered', applies_to: 'item', item_id: 'item_22', min_qty: 5 },
    { ...promoBase, id: 'promo_5', name: 'Paket Flu & Batuk', promo_type: 'bundle', applies_to: 'item', discount_value: 5000 },
  ];

  // ----- Sales: 30 days of believable traffic -----
  const sales: Row[] = [];
  const saleLines: Row[] = [];
  const payments: Row[] = [];
  const cashiers = [
    { id: 'user_001', name: 'Dewi Lestari' },
    { id: 'user_002', name: 'Rizky Pratama' },
    { id: 'user_003', name: 'Nadia Putri' },
  ];
  const weights = items.map((it) => (it.price < 25000 ? 3 : it.price < 100000 ? 1.4 : 0.35) * (it.current_stock > 5 ? 1 : 0.4));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = rand() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[0];
  };
  const methods: [string, number][] = [
    ['cash', 0.52],
    ['qris', 0.28],
    ['debit', 0.12],
    ['transfer', 0.08],
  ];
  let trx = 0;
  for (let day = 30; day >= 0; day--) {
    const d = addDays(now, -day);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const count = Math.round((weekend ? 30 : 24) + rand() * 12 + (30 - day) * 0.15);
    const isToday = day === 0;
    for (let k = 0; k < count; k++) {
      const hour = 8 + Math.floor(rand() * 13);
      const minute = Math.floor(rand() * 60);
      const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, Math.floor(rand() * 60));
      if (isToday && when > now) continue;
      trx++;
      const id = `sale_${trx}`;
      const lineCount = 1 + Math.floor(rand() * 3.4);
      let total = 0;
      let cogs = 0;
      let discount = 0;
      const chosen = new Set<string>();
      for (let l = 0; l < lineCount; l++) {
        const it = pick();
        if (chosen.has(it.id)) continue;
        chosen.add(it.id);
        const qty = it.price > 100000 ? 1 : 1 + Math.floor(rand() * 3);
        const lineDiscount = rand() < 0.08 ? Math.round((it.price * qty * 0.1) / 100) * 100 : 0;
        const subtotal = it.price * qty - lineDiscount;
        total += it.price * qty;
        discount += lineDiscount;
        cogs += it.cost_price * qty;
        saleLines.push({
          id: `sl_${trx}_${l}`,
          sale_id: id,
          item_id: it.id,
          item_name: it.name,
          sku: it.sku,
          category_name: it.category_name,
          unit_id: it.base_unit_id,
          unit_name: it.base_unit_name,
          qty,
          price_type: 'retail',
          price: it.price,
          discount_amount: lineDiscount,
          subtotal,
          hpp_value: it.cost_price,
        });
      }
      const grand = total - discount;
      const cashier = cashiers[Math.floor(rand() * cashiers.length)];
      const cust = rand() < 0.32 ? customers[1 + Math.floor(rand() * (customers.length - 1))] : customers[0];
      let m = rand();
      let method = 'cash';
      for (const [name, w] of methods) {
        if (m < w) {
          method = name;
          break;
        }
        m -= w;
      }
      sales.push({
        id,
        transaction_no: `TRX-${dateStr(when).replace(/-/g, '').slice(2)}-${String(trx).padStart(4, '0')}`,
        branch_id: BRANCH_ID,
        customer_id: cust.id,
        user_id: cashier.id,
        total_amount: total,
        discount_amount: discount,
        tax_amount: 0,
        grand_total: grand,
        status: 'completed',
        price_type: 'retail',
        created_at: dateTimeStr(when).replace(' ', 'T'),
        total_cogs: cogs,
        _cashier: cashier.name,
        _customer: cust,
        _method: method,
      });
      payments.push({ id: `pay_${trx}`, sale_id: id, amount: grand, method, created_at: dateTimeStr(when) });
    }
  }

  // ----- Purchasing -----
  const purchaseOrders: Row[] = [];
  const poLines: Row[] = [];
  const poStatuses = ['draft', 'ordered', 'ordered', 'received', 'received'];
  poStatuses.forEach((status, i) => {
    const id = `po_${i + 1}`;
    purchaseOrders.push({
      id,
      branch_id: BRANCH_ID,
      supplier_id: suppliers[i % suppliers.length].id,
      supplier_name: suppliers[i % suppliers.length].name,
      status,
      expected_date: dateStr(addDays(now, 3 - i * 2)),
      notes: i === 0 ? 'Restock obat flu' : undefined,
      created_by: 'Dewi Lestari',
      created_at: dateTimeStr(addDays(now, -i * 3 - 1)),
    });
    for (let l = 0; l < 3; l++) {
      const it = items[(i * 5 + l * 2) % items.length];
      poLines.push({
        id: `pol_${i}_${l}`,
        po_id: id,
        item_id: it.id,
        item_name: it.name,
        unit_id: it.base_unit_id,
        unit_name: it.base_unit_name,
        qty_ordered: 20 + l * 10,
        qty_received: status === 'received' ? 20 + l * 10 : 0,
        price_estimate: it.cost_price,
      });
    }
  });
  const purchases: Row[] = [];
  const purchaseLines: Row[] = [];
  const purchasePayments: Row[] = [];
  [0, 1, 2, 3].forEach((i) => {
    const id = `pur_${i + 1}`;
    let total = 0;
    for (let l = 0; l < 3; l++) {
      const it = items[(i * 4 + l * 3) % items.length];
      const qty = 24 + l * 12;
      total += qty * it.cost_price;
      purchaseLines.push({
        id: `purl_${i}_${l}`,
        purchase_id: id,
        item_id: it.id,
        item_name: it.name,
        unit_id: it.base_unit_id,
        unit_name: it.base_unit_name,
        qty_received: qty,
        price_per_unit: it.cost_price,
        expiry_date: it._expMonths ? dateStr(addDays(now, it._expMonths * 30)) : undefined,
        batch_no: it._expMonths ? `LOT-${i}${l}A` : undefined,
      });
    }
    purchases.push({
      id,
      branch_id: BRANCH_ID,
      supplier_id: suppliers[i % suppliers.length].id,
      invoice_no: `INV/${now.getFullYear()}/${String(1040 + i)}`,
      total_amount: total,
      status: i < 2 ? 'paid' : 'unpaid',
      created_at: dateTimeStr(addDays(now, -i * 5 - 2)),
      _paid: i < 2 ? total : i === 2 ? Math.round(total * 0.4) : 0,
    });
    if (i < 3) {
      purchasePayments.push({
        id: `purp_${i}`,
        purchase_id: id,
        amount: i < 2 ? total : Math.round(total * 0.4),
        method: 'transfer',
        created_at: dateTimeStr(addDays(now, -i * 5 - 1)),
      });
    }
  });

  // ----- Accounting: chart of accounts and a few journals -----
  const coa: [string, string, string, string][] = [
    ['1-1100', 'Kas', 'asset', 'debit'],
    ['1-1200', 'Bank', 'asset', 'debit'],
    ['1-1300', 'Piutang Usaha', 'asset', 'debit'],
    ['1-1400', 'Persediaan Barang', 'asset', 'debit'],
    ['1-2100', 'Peralatan Toko', 'asset', 'debit'],
    ['2-1100', 'Utang Usaha', 'liability', 'credit'],
    ['2-1200', 'Utang Pajak', 'liability', 'credit'],
    ['3-1000', 'Modal Pemilik', 'equity', 'credit'],
    ['3-2000', 'Laba Ditahan', 'equity', 'credit'],
    ['4-1000', 'Penjualan', 'revenue', 'credit'],
    ['4-2000', 'Potongan Penjualan', 'revenue', 'debit'],
    ['5-1000', 'Harga Pokok Penjualan', 'cogs', 'debit'],
    ['6-1000', 'Beban Gaji', 'expense', 'debit'],
    ['6-2000', 'Beban Sewa', 'expense', 'debit'],
    ['6-3000', 'Beban Listrik & Air', 'expense', 'debit'],
    ['6-4000', 'Beban Pemasaran', 'expense', 'debit'],
  ];
  const accounts = coa.map(([code, name, type, nb], i) => ({
    id: `acc_${i + 1}`,
    code,
    name,
    type,
    normal_balance: nb,
    is_system: 1,
    is_active: 1,
  }));
  const journals: Row[] = [];
  const acc = (code: string) => accounts.find((a) => a.code === code)!;
  const journalSeed: [string, string, [string, number, number][]][] = [
    ['sale', 'Penjualan harian', [['1-1100', 3200000, 0], ['4-1000', 0, 3200000]]],
    ['sale', 'HPP penjualan harian', [['5-1000', 2050000, 0], ['1-1400', 0, 2050000]]],
    ['purchase', 'Pembelian dari PT Kimia Farma', [['1-1400', 4800000, 0], ['2-1100', 0, 4800000]]],
    ['manual', 'Pembayaran sewa toko', [['6-2000', 3500000, 0], ['1-1200', 0, 3500000]]],
    ['manual', 'Pembayaran gaji karyawan', [['6-1000', 6800000, 0], ['1-1200', 0, 6800000]]],
    ['cash', 'Setoran modal tambahan', [['1-1200', 10000000, 0], ['3-1000', 0, 10000000]]],
  ];
  journalSeed.forEach(([source, desc, lines], i) => {
    journals.push({
      entry: {
        id: `je_${i + 1}`,
        entry_no: `JV-${now.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        date: dateStr(addDays(now, -i * 2)),
        description: desc,
        source_type: source,
        source_id: `src_${i + 1}`,
        branch_id: BRANCH_ID,
        created_at: dateTimeStr(addDays(now, -i * 2)),
      },
      lines: lines.map(([code, debit, credit], j) => ({
        id: `jl_${i}_${j}`,
        journal_entry_id: `je_${i + 1}`,
        account_id: acc(code).id,
        debit,
        credit,
        account_code: code,
        account_name: acc(code).name,
      })),
    });
  });

  const users = [
    { id: 'user_001', username: 'dewi', name: 'Dewi Lestari', role: 'owner', is_active: true, created_at: created, avatar_color: '#9B1EC8' },
    { id: 'user_002', username: 'rizky', name: 'Rizky Pratama', role: 'kasir', is_active: true, created_at: created, avatar_color: '#1D5FA8' },
    { id: 'user_003', username: 'nadia', name: 'Nadia Putri', role: 'apoteker', is_active: true, created_at: created, avatar_color: '#13733A' },
  ];

  const health = [
    {
      id: 'hr_1',
      customer_id: 'cust_2',
      checked_at: dateTimeStr(addDays(now, -6)),
      blood_sugar: 118,
      blood_sugar_context: 'fasting',
      systolic: 128,
      diastolic: 82,
      cholesterol_total: 196,
      uric_acid: 5.8,
      weight: 72,
      height: 170,
      notes: 'Kontrol rutin',
      created_at: created,
      updated_at: created,
      medicines: [
        { id: 'hm_1', record_id: 'hr_1', item_id: 'item_12', name: 'Metformin 500mg', qty: 2, unit: 'Strip', price: 8500, instructions: '2x sehari sesudah makan' },
        { id: 'hm_2', record_id: 'hr_1', item_id: 'item_13', name: 'Amlodipine 10mg', qty: 1, unit: 'Strip', price: 12500, instructions: '1x sehari pagi' },
      ],
    },
  ];

  const settings: Record<string, string> = {
    company_name: 'Apotek Sehat Sentosa',
    branch_name: 'Cabang Utama',
    company_address: 'Jl. Melati No. 12, Jakarta Selatan',
    company_phone: '021-5550123',
    has_completed_setup: 'true',
    tax_mode: 'none',
    tax_rate: '0',
    tier_member_discount: '5',
    tier_vip_discount: '10',
    tier_member_duration_months: '12',
    tier_vip_duration_months: '12',
    beep_enabled: 'true',
    receipt_footer: 'Terima kasih. Semoga lekas sehat!',
    lan_role: 'parent',
    lan_device_name: 'Kasir Utama',
  };

  return {
    categories,
    brands,
    items,
    units,
    customers,
    suppliers,
    promos,
    sales,
    saleLines,
    payments,
    ledger,
    purchaseOrders,
    poLines,
    purchases,
    purchaseLines,
    purchasePayments,
    accounts,
    journals,
    users,
    health,
    settings,
    seq: 1000,
  };
}
