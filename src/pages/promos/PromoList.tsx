import { useEffect, useState, useMemo, useCallback } from 'react';
import { getPromos, deletePromo, togglePromoActive, Promo } from '../../lib/api';
import {
  Plus, Edit2, Trash2, Tag, Percent, Gift, Package, Layers, Search, Coins,
  ToggleLeft, ToggleRight, Loader2, RefreshCw,
} from 'lucide-react';
import PromoDrawer from './PromoDrawer';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

export default function PromoList() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editPromoId, setEditPromoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPromos(activeOnly);
      setPromos(data);
    } catch (error) {
      console.error(error);
      setLoadError(String(error));
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const handleToggleActive = async (id: string) => {
    try {
      await togglePromoActive(id);
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deletePromo(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchPromos();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const filteredPromos = useMemo(() => {
    return promos.filter(p => {
      if (selectedType !== 'all' && p.promo_type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [promos, selectedType, searchQuery]);

  const totalPromos = promos.length;
  const activeCount = promos.filter(p => p.active === 1).length;
  const bundleCount = promos.filter(p => p.promo_type === 'bundle' || p.promo_type === 'bogo').length;
  const memberOnlyCount = promos.filter(p => p.member_only === 1 || p.member_tier).length;

  const hasFilters = Boolean(searchQuery.trim() || selectedType !== 'all' || activeOnly);

  const getPromoBadge = (type: string) => {
    switch (type) {
      case 'percentage':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-success-soft text-success border border-success/30">
            <Percent size={11} /> Diskon %
          </span>
        );
      case 'fixed_amount':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-accent-soft text-accent border border-accent/30">
            <Coins size={11} /> Potongan Rp
          </span>
        );
      case 'bogo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-warning-soft text-warning border border-warning/30">
            <Gift size={11} /> BOGO
          </span>
        );
      case 'tiered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-heading border border-line">
            <Layers size={11} /> Bertingkat
          </span>
        );
      case 'bundle':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-heading border border-line">
            <Package size={11} /> Bundle
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-body border border-line">
            {type}
          </span>
        );
    }
  };

  const getTargetLabel = (appliesTo: string) => {
    switch (appliesTo) {
      case 'item':
        return 'Item tertentu';
      case 'category':
        return 'Kategori';
      case 'transaction':
        return 'Total transaksi';
      default:
        return appliesTo;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-heading">Promosi & Diskon</h1>
        <Button
          onClick={() => {
            setEditPromoId(null);
            setIsDrawerOpen(true);
          }}
        >
          <Plus size={15} /> Buat Promo
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <div className="text-xs font-medium text-dim">Total promo</div>
          <div className="text-xl font-bold text-heading mt-1 tnum">{totalPromos}</div>
        </div>
        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <div className="text-xs font-medium text-dim">Aktif</div>
          <div className="text-xl font-bold text-success mt-1 tnum">{activeCount}</div>
        </div>
        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <div className="text-xs font-medium text-dim">Bundle & BOGO</div>
          <div className="text-xl font-bold text-heading mt-1 tnum">{bundleCount}</div>
        </div>
        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <div className="text-xs font-medium text-dim">Khusus member</div>
          <div className="text-xl font-bold text-heading mt-1 tnum">{memberOnlyCount}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="p-3 border-b border-line flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
            <Search size={15} className="text-dim mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau deskripsi promo"
              aria-label="Cari promo"
              className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={selectedType}
              onChange={v => setSelectedType(v)}
              ariaLabel="Filter tipe promo"
              className="flex-1 sm:w-48"
            >
              <option value="all">Semua tipe</option>
              <option value="percentage">Diskon %</option>
              <option value="fixed_amount">Potongan Rp</option>
              <option value="bogo">Beli X Gratis Y</option>
              <option value="tiered">Diskon bertingkat</option>
              <option value="bundle">Paket bundle</option>
            </Select>

            <label className="h-9 px-3 inline-flex items-center gap-2 text-xs font-semibold text-body cursor-pointer bg-input border border-line rounded-lg shrink-0 hover:border-line-strong transition-colors">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
                className="rounded border-line-strong text-primary focus:ring-primary accent-primary"
              />
              <span>Hanya aktif</span>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2" role="status" aria-label="Memuat promo">
            <Loader2 className="animate-spin text-primary" size={24} />
            <span className="text-xs text-dim">Memuat daftar promo</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center px-4">
            <p className="text-sm font-semibold text-danger">Daftar promo gagal dimuat</p>
            <p className="text-xs text-dim mt-1 break-words max-w-md mx-auto">{loadError}</p>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={fetchPromos}>
                <RefreshCw size={14} /> Coba lagi
              </Button>
            </div>
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Tag className="mx-auto text-dim mb-2" size={28} />
            <p className="text-sm font-semibold text-heading">
              {hasFilters ? 'Promo tidak ditemukan' : 'Belum ada promo'}
            </p>
            <p className="text-xs text-dim mt-1">
              {hasFilters
                ? 'Ubah filter atau kata kunci pencarian.'
                : 'Buat promo baru untuk diskon, bundle, atau BOGO di kasir.'}
            </p>
            <div className="mt-3">
              {hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('all');
                    setActiveOnly(false);
                  }}
                >
                  Reset filter
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditPromoId(null);
                    setIsDrawerOpen(true);
                  }}
                >
                  <Plus size={14} /> Buat Promo
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Nama promo</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3 hidden lg:table-cell">Target</th>
                  <th className="py-2.5 px-3">Nilai</th>
                  <th className="py-2.5 px-3 hidden md:table-cell">Periode</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredPromos.map(promo => {
                  const isExpired = promo.end_date && new Date(promo.end_date) < new Date();
                  return (
                    <tr key={promo.id} className="hover:bg-muted/40 transition-colors fast-render-row">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-heading text-sm">{promo.name}</div>
                        {promo.description && (
                          <div className="text-xs text-dim line-clamp-1 mt-0.5">{promo.description}</div>
                        )}
                        {(promo.member_tier || promo.min_qty > 1) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {promo.member_tier && (
                              <span className="text-[11px] font-semibold bg-muted text-body border border-line px-1.5 py-0.5 rounded-md">
                                Member {promo.member_tier.toUpperCase()}
                              </span>
                            )}
                            {promo.min_qty > 1 && (
                              <span className="text-[11px] text-dim tnum">Min. beli {promo.min_qty}</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">{getPromoBadge(promo.promo_type)}</td>

                      <td className="py-3 px-3 text-body font-medium whitespace-nowrap hidden lg:table-cell">
                        {getTargetLabel(promo.applies_to)}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-heading tnum">
                          {promo.promo_type === 'percentage' && `${promo.discount_percent}%`}
                          {promo.promo_type === 'fixed_amount' && `Rp ${(promo.discount_value || 0).toLocaleString('id-ID')}`}
                          {promo.promo_type === 'bogo' && 'Gratis produk'}
                          {promo.promo_type === 'tiered' && 'Bertingkat'}
                          {promo.promo_type === 'bundle' &&
                            (promo.discount_percent > 0
                              ? `Diskon ${promo.discount_percent}%`
                              : `Potongan Rp ${(promo.discount_value || 0).toLocaleString('id-ID')}`)}
                        </div>
                        {promo.max_discount_amount && (
                          <div className="text-[11px] text-dim mt-0.5 tnum">
                            Maks Rp {promo.max_discount_amount.toLocaleString('id-ID')}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap hidden md:table-cell">
                        {promo.start_date || promo.end_date ? (
                          <div className="text-xs text-body tnum">
                            {promo.start_date ? promo.start_date.split('T')[0] : 'Mulai'} s/d{' '}
                            {promo.end_date ? promo.end_date.split('T')[0] : 'Seterusnya'}
                            {isExpired && <span className="block text-[11px] font-semibold text-danger mt-0.5">Kadaluarsa</span>}
                          </div>
                        ) : (
                          <span className="text-dim">Tanpa batas</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(promo.id)}
                          aria-label={`Ubah status ${promo.name}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            promo.active
                              ? 'bg-success-soft text-success border border-success/30'
                              : 'bg-muted text-dim border border-line hover:text-heading'
                          }`}
                          title="Ubah status aktif"
                        >
                          {promo.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {promo.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditPromoId(promo.id);
                              setIsDrawerOpen(true);
                            }}
                            aria-label={`Edit promo ${promo.name}`}
                            className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Edit Promo"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(promo.id)}
                            aria-label={`Hapus promo ${promo.name}`}
                            className="p-1.5 text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Hapus Promo"
                          >
                            <Trash2 size={15} />
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

      <PromoDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaved={fetchPromos}
        editPromoId={editPromoId}
      />

      {deleteConfirmId !== null && (
        <ConfirmModal
          title="Hapus promo?"
          message="Aturan promosi ini akan dihapus permanen dan tidak lagi berlaku di kasir."
          confirmLabel="Hapus Promo"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
