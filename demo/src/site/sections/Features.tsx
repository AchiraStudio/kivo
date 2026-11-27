import {
  ScanBarcode, Camera, PauseCircle, Wallet, Printer, Archive, Tags, Undo2,
  Layers, Calculator, ClipboardCheck, Zap, FileSpreadsheet, Boxes,
  Crown, Star, HeartPulse, Percent, Gift, Ticket,
  ClipboardList, PackageCheck, Receipt,
  BookOpen, Scale, TrendingUp, ArrowLeftRight,
  WifiOff, Network, CloudCog, Building2, ShieldCheck, Plug, Sparkles, Smartphone, MonitorSmartphone, RefreshCw, SunMoon, KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n';

type Item = [LucideIcon, string, string];

// Short labels on purpose: the live app above does the explaining.
const GROUPS: { en: string; id: string; items: Item[] }[] = [
  {
    en: 'Sell', id: 'Jual',
    items: [
      [ScanBarcode, '1D & 2D barcodes', 'Barcode 1D & 2D'],
      [Camera, 'Camera scanning', 'Scan kamera'],
      [PauseCircle, 'Hold & resume', 'Tahan & lanjut'],
      [Wallet, 'Split payments', 'Bayar campur'],
      [Printer, 'Thermal receipts', 'Struk thermal'],
      [Archive, 'Cash drawer', 'Laci kasir'],
      [Tags, 'Retail, wholesale, tiers', 'Eceran, grosir, tier'],
      [Undo2, 'Returns', 'Retur'],
    ],
  },
  {
    en: 'Stock', id: 'Stok',
    items: [
      [Layers, 'Batches & expiry', 'Batch & kedaluwarsa'],
      [Calculator, 'Average cost (HPP)', 'HPP rata-rata'],
      [ClipboardCheck, 'Stock opname', 'Stock opname'],
      [Zap, 'Rapid registration', 'Registrasi cepat'],
      [FileSpreadsheet, 'Excel import & export', 'Impor & ekspor Excel'],
      [Boxes, 'Multi-unit items', 'Multi satuan'],
    ],
  },
  {
    en: 'Members', id: 'Member',
    items: [
      [Crown, 'Member & VIP tiers', 'Tier Member & VIP'],
      [Star, 'Loyalty points', 'Poin loyalti'],
      [HeartPulse, 'Health records', 'Riwayat kesehatan'],
      [Percent, 'Promos: %, BOGO, bundle', 'Promo: %, BOGO, paket'],
      [Gift, 'Quantity pricing', 'Harga bertingkat'],
      [Ticket, 'Vouchers', 'Voucher'],
    ],
  },
  {
    en: 'Buy & books', id: 'Beli & buku',
    items: [
      [ClipboardList, 'Purchase orders', 'Pesanan pembelian'],
      [PackageCheck, 'Goods receiving', 'Terima barang'],
      [Receipt, 'Payables', 'Hutang dagang'],
      [BookOpen, 'Auto journals', 'Jurnal otomatis'],
      [Scale, 'Balance sheet', 'Neraca'],
      [TrendingUp, 'Profit & loss', 'Laba rugi'],
      [ArrowLeftRight, 'Cash in / out', 'Kas masuk / keluar'],
    ],
  },
  {
    en: 'Platform', id: 'Platform',
    items: [
      [WifiOff, 'Offline-first', 'Offline-first'],
      [Network, 'LAN sync', 'Sinkron LAN'],
      [CloudCog, 'Cloud sync, your keys', 'Sinkron cloud, kunci Anda'],
      [Building2, 'Multi-branch', 'Multi cabang'],
      [ShieldCheck, 'Roles & permissions', 'Hak akses per peran'],
      [KeyRound, '100% BYOK', '100% BYOK'],
      [Plug, 'MCP server', 'Server MCP'],
      [Sparkles, 'Kivo AI', 'Kivo AI'],
      [MonitorSmartphone, 'Windows + Android', 'Windows + Android'],
      [Smartphone, 'Phone as terminal', 'HP jadi terminal'],
      [RefreshCw, 'Auto-update', 'Update otomatis'],
      [SunMoon, 'Light & dark', 'Terang & gelap'],
    ],
  },
];

export function Features() {
  const { t, lang } = useI18n();
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{t('features.eyebrow')}</div>
          <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-heading">
            {t('features.title')}
          </h2>
        </div>

        <div className="mt-12 space-y-10">
          {GROUPS.map((g, gi) => (
            <div key={g.en} data-reveal style={{ '--d': `${gi * 50}ms` } as React.CSSProperties}>
              <h3 className="text-sm font-extrabold text-dim mb-3.5 tracking-wide">{lang === 'id' ? g.id : g.en}</h3>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {g.items.map(([Icon, en, id]) => (
                  <li
                    key={en}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft/40"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-muted flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <Icon size={17} />
                    </span>
                    <span className="text-[13.5px] font-bold leading-tight text-heading">{lang === 'id' ? id : en}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
