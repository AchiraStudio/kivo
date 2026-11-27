import type { Ctx } from './autoplay';

// Every scene drives the real Kivo screens. Text matches the Indonesian UI.
type Scene = (c: Ctx) => Promise<void>;


// ---------------------------------------------------------------- desktop

const dashboard: Scene = async (c) => {
  c.navigate('dashboard');
  await c.wait(1800);
  await c.click('button', /^\s*7 Hari/);
  await c.wait(1300);
  await c.click('button', /Bulan Ini/);
  await c.wait(1300);
  await c.click('button', /Hari Ini/);
  await c.wait(900);
  await c.click('tbody button');
  await c.wait(2200);
  c.key('Escape');
};

const pos: Scene = async (c) => {
  c.navigate('pos');
  await c.wait(1500);
  await c.click('button', /Paracetamol 500mg/);
  await c.click('button', /Tolak Angin Cair/);
  await c.click('button', /Tolak Angin Cair/);
  await c.click('button', /Tolak Angin Cair/);
  await c.click('button', /Vitamin C 1000mg/);
  await c.wait(900);
  await c.click('button', /F3\s*Ubah/);
  await c.wait(700);
  await c.click('button', /Siti Rahmawati/);
  await c.wait(1300);
  await c.click('button', /^\s*Bayar/);
  await c.wait(1200);
  await c.click('button', /Uang Pas/);
  await c.wait(900);
  await c.click('button', /\bSimpan\(End\)/);
  await c.wait(3200);
  c.key('Escape');
};

const inventory: Scene = async (c) => {
  c.navigate('inventory');
  await c.wait(1500);
  await c.type('input[placeholder^="Cari nama"]', 'vit');
  await c.wait(1500);
  await c.click('button[aria-label="Lihat Detail"]');
  await c.wait(2600);
  await c.click('button[aria-label="Kembali ke katalog"]');
  await c.wait(500);
  await c.click('button', /Stok & Ledger/);
  await c.wait(2200);
  await c.click('button', /Stock Opname/);
  await c.wait(2200);
};

const customers: Scene = async (c) => {
  c.navigate('customers');
  await c.wait(1500);
  await c.click('button', /Tambah Pelanggan/);
  await c.wait(600);
  await c.type('input[placeholder="Nama lengkap"]', 'Rina Marlina');
  await c.type('input[placeholder="08..."]', '081299887766');
  await c.click('button[role="radio"]', /Member/);
  await c.wait(1400);
  await c.click('button', /Simpan Pelanggan/);
  await c.wait(1500);
  await c.click('button', /Promosi/);
  await c.wait(2200);
};

const purchasing: Scene = async (c) => {
  c.navigate('purchasing');
  await c.wait(1500);
  await c.click('tbody button', /Detail/);
  await c.wait(2400);
  c.key('Escape');
  await c.wait(500);
  await c.click('button', /Pemasok/);
  await c.wait(2000);
};

const reports: Scene = async (c) => {
  c.navigate('reports');
  await c.wait(1500);
  await c.click('button', /Item Terlaris/);
  await c.wait(2600);
  await c.click('button', /Akuntansi/);
  await c.wait(1600);
  await c.click('button', /Laba Rugi/);
  await c.wait(2400);
  await c.click('button', /^\s*Neraca\s*$/);
  await c.wait(2200);
};

const ai: Scene = async (c) => {
  c.navigate('dashboard');
  await c.wait(1200);
  await c.click('button[aria-label="Buka Kivo AI"]');
  await c.wait(900);
  await c.type('textarea', 'Produk apa yang perlu di-restock?');
  c.key('Enter');
  const box = document.querySelector<HTMLTextAreaElement>('textarea');
  box?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await c.wait(3500);
};

const settings: Scene = async (c) => {
  c.navigate('settings');
  await c.wait(1500);
  await c.click('button', /Hardware POS/);
  await c.wait(1800);
  await c.click('button', /Jaringan LAN/);
  await c.wait(2000);
  await c.click('button', /Pengguna/);
  await c.wait(2000);
};

// ---------------------------------------------------------------- phone (Android app)

const pPos: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Kasir/);
  await c.wait(1200);
  await c.click('button', /Paracetamol 500mg/);
  await c.click('button', /Tolak Angin Cair/);
  await c.click('button', /Vitamin C 1000mg/);
  await c.wait(700);
  await c.click('button', /Lihat Keranjang/);
  await c.wait(900);
  await c.click('button', /^\s*Bayar/);
  await c.wait(1100);
  await c.click('button', /Uang Pas/);
  await c.wait(800);
  await c.click('button', /\bSimpan\(End\)|^\s*Simpan\b/);
  await c.wait(2600);
};

const pCustomer: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Menu/);
  await c.wait(700);
  await c.click('button', /Pelanggan & Promo/);
  await c.wait(1500);
  await c.click('button[aria-label="Tambah pelanggan"]');
  await c.wait(700);
  await c.type('#cust-name', 'Rina Marlina');
  await c.type('#cust-phone', '081299887766');
  await c.click('button[role="radio"]', /Member/);
  await c.wait(600);
  await c.click('button', /\+6 bln/);
  await c.wait(1200);
  await c.click('button', /^\s*Simpan\s*$/);
  await c.wait(1800);
};

const pConnect: Scene = async (c) => {
  if (localStorage.getItem('kivo_mobile_mode') === 'client') return; // already connected after the reload
  await c.wait(900);
  await c.type('input[aria-label="Alamat komputer kasir"]', '192.168.1.8');
  await c.wait(500);
  sessionStorage.setItem('demo_connected', '1');
  await c.click('button[type="submit"]', /Hubungkan/);
};

const pUpdate: Scene = async (c) => {
  await c.wait(3600); // the app checks for updates on its own a few seconds after launch
  await c.click('button', /Perbarui/);
  await c.wait(4200);
};

const pDashboard: Scene = async (c) => {
  await c.wait(1500);
  await c.click('button', /^\s*7 Hari/);
  await c.wait(1400);
  await c.click('button', /Bulan Ini/);
  await c.wait(1600);
  await c.click('tbody button, a, button', /TRX-/);
  await c.wait(1800);
};

const pInventory: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Stok/);
  await c.wait(1500);
  await c.type('input[placeholder^="Cari nama"]', 'vit');
  await c.wait(1400);
  await c.click('button', /Vitamin C 1000mg/);
  await c.wait(2600);
};

const pPurchasing: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Menu/);
  await c.wait(700);
  await c.click('button', /Pembelian/);
  await c.wait(1600);
  await c.click('button', /Detail/);
  await c.wait(2400);
};

const pReports: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Laporan/);
  await c.wait(1500);
  await c.click('button', /Item Terlaris/);
  await c.wait(2800);
};

const pAi: Scene = async (c) => {
  await c.wait(1200);
  await c.click('button[aria-label="Buka Kivo AI"]');
  await c.wait(900);
  await c.type('textarea', 'Produk apa yang perlu di-restock?');
  const box = document.querySelector<HTMLTextAreaElement>('textarea');
  box?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await c.wait(3200);
};

const pSettings: Scene = async (c) => {
  await c.wait(800);
  await c.click('nav button', /Menu/);
  await c.wait(700);
  await c.click('button', /Pengaturan/);
  await c.wait(1600);
  await c.click('button', /Hardware POS/);
  await c.wait(2000);
};

const pHome: Scene = async (c) => {
  await c.wait(2200);
  await c.click('nav button', /Menu/);
  await c.wait(2200);
};

export const SCENES: Record<string, Scene> = {
  dashboard,
  pos,
  inventory,
  customers,
  purchasing,
  reports,
  ai,
  settings,
  'p-pos': pPos,
  'p-customer': pCustomer,
  'p-connect': pConnect,
  'p-update': pUpdate,
  'p-home': pHome,
  'p-dashboard': pDashboard,
  'p-inventory': pInventory,
  'p-purchasing': pPurchasing,
  'p-reports': pReports,
  'p-ai': pAi,
  'p-settings': pSettings,
};
