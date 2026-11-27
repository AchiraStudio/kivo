import { useState, useEffect, useMemo } from 'react';
import { getCustomers, updateCustomer, getSettings, Customer } from '../../lib/api';
import { Loader2, Plus, UserCircle, Edit2, Search, Eye, HeartPulse, RefreshCw, Phone, MessageCircle, CalendarPlus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import { openExternal, toWhatsAppNumber } from '../../lib/androidBridge';
import CustomerModal from './CustomerModal';
import CustomerProfileDrawer, { ProfileTab } from './CustomerProfileDrawer';

const TIER_META: Record<string, { label: string; cls: string }> = {
  vip: { label: 'VIP', cls: 'bg-warning-soft text-warning border-warning/30' },
  member: { label: 'Member', cls: 'bg-accent-soft text-accent border-accent/30' },
  regular: { label: 'Reguler', cls: 'bg-muted text-body border-line' },
};

type TierFilter = 'all' | 'member' | 'vip' | 'regular' | 'due';

const FILTERS: { id: TierFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'member', label: 'Member' },
  { id: 'vip', label: 'VIP' },
  { id: 'regular', label: 'Reguler' },
  { id: 'due', label: 'Segera habis' },
];

const AVATAR_CLS: Record<string, string> = {
  vip: 'bg-warning-soft text-warning',
  member: 'bg-accent-soft text-accent',
  regular: 'bg-muted text-body',
};

/** Days until the membership ends (negative = already expired). null for regular customers. */
function daysLeft(c: Customer): number | null {
  if (c.customer_tier === 'regular' || !c.membership_expiry) return null;
  const end = new Date(c.membership_expiry.replace(' ', 'T'));
  if (isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

const DUE_WITHIN_DAYS = 14;

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('purchases');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const openProfile = (c: Customer, tab: ProfileTab) => {
    setProfileTab(tab);
    setProfileCustomer(c);
  };

  const loadData = () => {
    setLoading(true);
    setLoadError(null);
    getCustomers()
      .then(setCustomers)
      .catch(e => setLoadError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setCustomerToEdit(null);
    setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setCustomerToEdit(c);
    setIsModalOpen(true);
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (tierFilter === 'member' || tierFilter === 'vip' || tierFilter === 'regular') {
        if (c.customer_tier !== tierFilter) return false;
      } else if (tierFilter === 'due') {
        const d = daysLeft(c);
        if (d === null || d > DUE_WITHIN_DAYS) return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
    });
  }, [customers, search, tierFilter]);

  // One-tap renewal from the phone list: extend by the tier's configured duration (default 12 months).
  const renew = async (c: Customer) => {
    setRenewingId(c.id);
    try {
      const settings = await getSettings();
      const months = parseInt(settings.find(s => s.key === `tier_${c.customer_tier}_duration_months`)?.value || '12', 10) || 12;
      let base = new Date();
      if (c.membership_expiry) {
        const current = new Date(c.membership_expiry.replace(' ', 'T'));
        if (current > base) base = current;
      }
      base.setMonth(base.getMonth() + months);
      const expiry = `${base.toISOString().split('T')[0]} 23:59:59`;
      await updateCustomer(c.id, c.name, c.phone, c.email, c.address, c.region, c.customer_tier, c.notes, expiry);
      toast.success('Membership diperpanjang', `${c.name} s/d ${expiry.split(' ')[0]}`);
      loadData();
    } catch (e) {
      toast.error(`Gagal memperpanjang: ${e}`);
    } finally {
      setRenewingId(null);
    }
  };

  return (
    <div className="relative flex flex-col gap-3 md:gap-4 h-full animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold tracking-tight text-heading">Pelanggan</h1>
          {!loading && !loadError && (
            <span className="px-2 py-0.5 rounded-full bg-muted border border-line text-xs font-semibold text-dim tnum">
              {customers.length}
            </span>
          )}
        </div>
        <Button onClick={openAdd} className="max-md:hidden">
          <Plus size={15} /> Tambah Pelanggan
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-line">
          <div className="flex items-center h-11 md:h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
            <Search size={15} className="text-dim mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau nomor telepon"
              aria-label="Cari pelanggan"
              className="bg-transparent border-none outline-none text-base md:text-sm w-full text-heading placeholder:text-dim"
            />
          </div>
          <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar pt-2.5 -mx-3 px-3">
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTierFilter(f.id)}
                aria-pressed={tierFilter === f.id}
                className={`h-9 px-3.5 rounded-full border text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  tierFilter === f.id ? 'bg-primary-soft text-primary border-primary/40' : 'bg-card text-body border-line'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2" role="status" aria-label="Memuat pelanggan">
            <Loader2 className="animate-spin text-primary" size={24} />
            <span className="text-xs text-dim">Memuat data pelanggan</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center px-4">
            <p className="text-sm font-semibold text-danger">Data pelanggan gagal dimuat</p>
            <p className="text-xs text-dim mt-1 break-words max-w-md mx-auto">{loadError}</p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw size={14} /> Coba lagi
              </Button>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center px-4">
            <UserCircle size={28} className="mx-auto text-dim mb-2" />
            <p className="text-sm font-semibold text-heading">
              {search.trim() ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
            </p>
            <p className="text-xs text-dim mt-1">
              {search.trim()
                ? 'Coba kata kunci nama atau nomor telepon lain.'
                : 'Tambahkan data pelanggan untuk mencatat riwayat transaksi.'}
            </p>
            <div className="mt-3">
              {search.trim() ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Reset pencarian
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus size={14} /> Tambah Pelanggan
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {/* Phone layout: a card per customer with the actions people actually use */}
            <div className="md:hidden divide-y divide-line pb-24">
              {filteredCustomers.map(c => {
                const tier = TIER_META[c.customer_tier] ?? { label: c.customer_tier, cls: 'bg-muted text-body border-line' };
                const left = daysLeft(c);
                const expired = left !== null && left < 0;
                const due = left !== null && left <= DUE_WITHIN_DAYS;
                const isDefault = c.id === 'customer_umum';
                return (
                  <div key={c.id} className="px-3.5 py-3">
                    <button type="button" onClick={() => openProfile(c, 'purchases')} className="w-full flex items-center gap-3 text-left cursor-pointer">
                      <span className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-extrabold shrink-0 ${AVATAR_CLS[c.customer_tier] ?? AVATAR_CLS.regular}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-heading truncate">{c.name}</span>
                        <span className="block text-xs text-dim tnum truncate">{c.phone || 'Tanpa nomor HP'}</span>
                        <span className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tier.cls}`}>{tier.label}</span>
                          {left !== null && (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold tnum ${
                                expired ? 'bg-danger-soft text-danger' : due ? 'bg-warning-soft text-warning' : 'text-dim'
                              }`}
                            >
                              {expired ? 'Kedaluwarsa' : `s/d ${c.membership_expiry!.split(' ')[0]}`}
                            </span>
                          )}
                          {(c.loyalty_points ?? 0) > 0 && (
                            <span className="text-[11px] text-dim tnum">{c.loyalty_points.toLocaleString('id-ID')} poin</span>
                          )}
                        </span>
                      </span>
                    </button>

                    {!isDefault && (
                      <div className="flex items-center gap-2 mt-2.5 pl-14">
                        {c.phone && (
                          <>
                            <button
                              type="button"
                              onClick={() => openExternal(`tel:${c.phone}`)}
                              aria-label={`Telepon ${c.name}`}
                              className="h-10 w-10 rounded-full border border-line flex items-center justify-center text-heading active:bg-muted cursor-pointer"
                            >
                              <Phone size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openExternal(`https://wa.me/${toWhatsAppNumber(c.phone!)}`)}
                              aria-label={`WhatsApp ${c.name}`}
                              className="h-10 w-10 rounded-full border border-line flex items-center justify-center text-success active:bg-muted cursor-pointer"
                            >
                              <MessageCircle size={16} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          aria-label={`Edit ${c.name}`}
                          className="h-10 w-10 rounded-full border border-line flex items-center justify-center text-heading active:bg-muted cursor-pointer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openProfile(c, 'health')}
                          aria-label={`Catatan kesehatan ${c.name}`}
                          className="h-10 w-10 rounded-full border border-line flex items-center justify-center text-heading active:bg-muted cursor-pointer"
                        >
                          <HeartPulse size={16} />
                        </button>
                        {due && (
                          <button
                            type="button"
                            onClick={() => renew(c)}
                            disabled={renewingId === c.id}
                            className="ml-auto h-10 px-3.5 rounded-full bg-primary text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {renewingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
                            Perpanjang
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <table className="hidden md:table w-full text-left border-collapse">
              <thead className="sticky top-0 bg-muted/60 border-b border-line text-xs text-dim font-semibold z-10">
                <tr>
                  <th className="py-2.5 px-3 sm:px-4">Nama</th>
                  <th className="py-2.5 px-3 sm:px-4">Telepon</th>
                  <th className="py-2.5 px-3 sm:px-4">Tier</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right hidden md:table-cell">Poin</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filteredCustomers.map(c => {
                  const tier = TIER_META[c.customer_tier] ?? { label: c.customer_tier, cls: 'bg-muted text-body border-line' };
                  return (
                    <tr key={c.id} className="hover:bg-muted/40 transition-colors fast-render-row">
                      <td className="py-2.5 px-3 sm:px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-heading truncate">{c.name}</span>
                          {c.id === 'customer_umum' && (
                            <span className="text-[11px] font-medium bg-muted text-dim border border-line px-1.5 py-0.5 rounded-md shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono text-xs text-body tnum">
                        {c.phone || '-'}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tier.cls}`}>
                            {tier.label}
                          </span>
                          {c.membership_expiry && c.customer_tier !== 'regular' && (
                            <span className="text-[11px] text-dim tnum" title="Masa berlaku membership">
                              s/d {c.membership_expiry.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-xs font-semibold text-body tnum hidden md:table-cell">
                        {(c.loyalty_points ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right">
                        <div className="flex justify-end gap-1">
                          {c.id !== 'customer_umum' && (
                            <button
                              type="button"
                              onClick={() => openProfile(c, 'health')}
                              title="Catatan Kesehatan"
                              aria-label={`Catatan kesehatan ${c.name}`}
                              className="p-1.5 rounded-lg text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <HeartPulse size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openProfile(c, 'purchases')}
                            title="Lihat Profil"
                            aria-label={`Lihat profil ${c.name}`}
                            className="p-1.5 rounded-lg text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            title="Edit Pelanggan"
                            aria-label={`Edit ${c.name}`}
                            className="p-1.5 rounded-lg text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openAdd}
        aria-label="Tambah pelanggan"
        className="md:hidden absolute bottom-3 right-1 z-20 h-14 pl-4 pr-5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 inline-flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
      >
        <Plus size={20} /> Pelanggan
      </button>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        customerToEdit={customerToEdit}
      />
      <CustomerProfileDrawer
        isOpen={!!profileCustomer}
        onClose={() => setProfileCustomer(null)}
        customer={profileCustomer}
        initialTab={profileTab}
      />
    </div>
  );
}
