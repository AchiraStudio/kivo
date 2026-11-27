import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'id';

// Deliberately tiny: the site shows the real app instead of describing it.
const DICT = {
  en: {
    'nav.download': 'Download',
    'nav.live': 'Live demo',
    'hero.eyebrow': 'Windows + Android',
    'hero.l1': 'Run the store.',
    'hero.l2': 'Even offline.',
    'hero.sub': 'POS, stock, members and books. One app, every device.',
    'hero.try': 'Try it live',
    'hero.hint': 'This is the real app. Click anything.',
    'tour.eyebrow': 'The real app',
    'tour.dashboard': 'Overview',
    'tour.dashboard.tag': 'Your whole day at a glance.',
    'tour.pos': 'Checkout',
    'tour.pos.tag': 'Scan. Pay. Receipt.',
    'tour.inventory': 'Stock',
    'tour.inventory.tag': 'Every batch, every expiry.',
    'tour.customers': 'Members',
    'tour.customers.tag': 'Know your regulars.',
    'tour.purchasing': 'Purchasing',
    'tour.purchasing.tag': 'Restock, pay, track.',
    'tour.reports': 'Books',
    'tour.reports.tag': 'Profit in plain sight.',
    'tour.ai': 'Kivo AI',
    'tour.ai.tag': 'Just ask.',
    'tour.settings': 'Control',
    'tour.settings.tag': 'Printers, network, roles.',
    'phone.eyebrow': 'In your pocket',
    'phone.title': 'The same store, in your hand.',
    'phone.connect': 'Join',
    'phone.pos': 'Sell',
    'phone.customer': 'Add members',
    'phone.update': 'Update',
    'phone.home': 'Menu',
    'offline.eyebrow': 'Offline-first',
    'offline.title': 'Wi-Fi drops. Sales don\'t.',
    'offline.wifi': 'Store Wi-Fi',
    'offline.internet': 'Internet',
    'offline.pc': 'Cashier PC',
    'offline.cloud': 'Cloud',
    'offline.phone': 'Phone',
    'offline.sales': 'sales today',
    'features.eyebrow': 'Everything included',
    'features.title': 'All of it. Out of the box.',
    'dl.eyebrow': 'Download',
    'dl.title': 'Get Kivo',
    'dl.windows': 'Windows',
    'dl.android': 'Android',
    'dl.get': 'Download',
    'dl.latest': 'Latest',
    'dl.scan': 'Scan to install',
    'dl.free': 'Free and open source',
    'dl.github': 'View on GitHub',
    'dl.autoupdate': 'Updates itself',
    'footer.rights': 'MIT licensed',
    'frame.loading': 'Starting Kivo',
    'frame.tap': 'Tap to try',
  },
  id: {
    'nav.download': 'Unduh',
    'nav.live': 'Demo langsung',
    'hero.eyebrow': 'Windows + Android',
    'hero.l1': 'Jalankan toko.',
    'hero.l2': 'Tanpa internet.',
    'hero.sub': 'Kasir, stok, member, dan pembukuan. Satu aplikasi, semua perangkat.',
    'hero.try': 'Coba langsung',
    'hero.hint': 'Ini aplikasi aslinya. Klik apa saja.',
    'tour.eyebrow': 'Aplikasi aslinya',
    'tour.dashboard': 'Ringkasan',
    'tour.dashboard.tag': 'Seluruh hari Anda sekilas.',
    'tour.pos': 'Kasir',
    'tour.pos.tag': 'Scan. Bayar. Struk.',
    'tour.inventory': 'Stok',
    'tour.inventory.tag': 'Tiap batch, tiap kedaluwarsa.',
    'tour.customers': 'Member',
    'tour.customers.tag': 'Kenali pelanggan setia.',
    'tour.purchasing': 'Pembelian',
    'tour.purchasing.tag': 'Restock, bayar, pantau.',
    'tour.reports': 'Pembukuan',
    'tour.reports.tag': 'Laba terlihat jelas.',
    'tour.ai': 'Kivo AI',
    'tour.ai.tag': 'Tinggal tanya.',
    'tour.settings': 'Kontrol',
    'tour.settings.tag': 'Printer, jaringan, hak akses.',
    'phone.eyebrow': 'Di genggaman',
    'phone.title': 'Toko yang sama, di tangan Anda.',
    'phone.connect': 'Sambung',
    'phone.pos': 'Jual',
    'phone.customer': 'Tambah member',
    'phone.update': 'Update',
    'phone.home': 'Menu',
    'offline.eyebrow': 'Offline-first',
    'offline.title': 'Wi-Fi putus. Jualan jalan terus.',
    'offline.wifi': 'Wi-Fi toko',
    'offline.internet': 'Internet',
    'offline.pc': 'PC kasir',
    'offline.cloud': 'Cloud',
    'offline.phone': 'HP',
    'offline.sales': 'penjualan hari ini',
    'features.eyebrow': 'Semua sudah termasuk',
    'features.title': 'Lengkap. Langsung pakai.',
    'dl.eyebrow': 'Unduh',
    'dl.title': 'Pasang Kivo',
    'dl.windows': 'Windows',
    'dl.android': 'Android',
    'dl.get': 'Unduh',
    'dl.latest': 'Terbaru',
    'dl.scan': 'Scan untuk pasang',
    'dl.free': 'Gratis dan open source',
    'dl.github': 'Lihat di GitHub',
    'dl.autoupdate': 'Update otomatis',
    'footer.rights': 'Lisensi MIT',
    'frame.loading': 'Memulai Kivo',
    'frame.tap': 'Ketuk untuk coba',
  },
} as const;

export type Key = keyof (typeof DICT)['en'];

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}

const Ctx = createContext<I18n | null>(null);

const initial = (): Lang => {
  try {
    const saved = localStorage.getItem('kivo-site-lang');
    if (saved === 'en' || saved === 'id') return saved;
  } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('kivo-site-lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<I18n>(() => ({ lang, setLang, t: (k) => DICT[lang][k] ?? DICT.en[k] }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
};
