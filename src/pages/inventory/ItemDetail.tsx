import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  Activity,
  Edit,
  AlertCircle,
  TrendingUp,
  Tags,
  CalendarDays,
  DollarSign,
  Layers,
  MapPin,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { getItem, ItemDetailData, toggleItemActive } from '../../lib/api';
import Button from '../../components/ui/Button';

interface ItemDetailProps {
  itemId: string;
  onBack: () => void;
  onEditItem: () => void;
  refreshTrigger: number;
}

export default function ItemDetail({ itemId, onBack, onEditItem, refreshTrigger }: ItemDetailProps) {
  const [data, setData] = useState<ItemDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await getItem(itemId);
      setData(result);
    } catch (error: any) {
      console.error('Error fetching item details:', error);
      setErrorMsg(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [itemId, refreshTrigger]);

  const handleToggleActive = async () => {
    await toggleItemActive(itemId);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-dim py-20">
        <Loader2 size={24} className="mb-3 text-primary animate-spin" />
        <p className="text-xs font-medium">Memuat detail produk...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-dim py-16 max-w-md mx-auto text-center">
        <div className="p-3 bg-danger-soft text-danger rounded-xl mb-3 border border-danger/30">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-sm font-bold text-heading mb-1">Gagal Memuat Produk</h3>
        <p className="text-xs text-dim mb-4">{errorMsg || 'Data produk tidak ditemukan.'}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Kembali
          </Button>
          <Button variant="primary" size="sm" onClick={loadData}>
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const { item, units, prices, price_tiers, active_batches } = data;

  const costPrice = item.cost_price || 0;
  const baseUnit = units.find((u) => u.is_base === 1) || units[0];
  const regularPrice =
    prices.find((p) => p.unit_id === baseUnit?.id && p.customer_tier === 'regular')?.price || item.price || 0;
  const marginRp = regularPrice - costPrice;
  const marginPercent = costPrice > 0 ? ((marginRp / costPrice) * 100).toFixed(1) : regularPrice > 0 ? '100' : '0';

  const totalStock =
    active_batches && active_batches.length > 0
      ? active_batches.reduce((acc, b) => acc + b.current_qty, 0)
      : 0;
  const totalValuation = totalStock * costPrice;

  return (
    <div className="flex flex-col gap-4 animate-fade-in w-full pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="px-2 shrink-0"
            title="Kembali"
            aria-label="Kembali ke katalog"
          >
            <ArrowLeft size={16} />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-heading tracking-tight truncate">{item.name}</h1>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                  item.is_active ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                }`}
              >
                {item.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              {item.category_name && (
                <span className="px-2 py-0.5 rounded-md bg-muted text-body text-xs font-medium border border-line">
                  {item.category_name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-dim mt-1 flex-wrap">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded-md text-[11px] border border-line">
                SKU: {item.sku}
              </span>
              {item.barcode && (
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded-md text-[11px] border border-line">
                  Barcode: {item.barcode}
                </span>
              )}
              {item.rack_location && (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <MapPin size={12} className="text-dim" /> Rak: {item.rack_location}
                </span>
              )}
              {item.generic_name && <span className="text-dim">({item.generic_name})</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            <Activity size={14} className={item.is_active ? 'text-danger' : 'text-success'} />
            {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button variant="primary" size="sm" onClick={onEditItem}>
            <Edit size={14} /> Edit Produk
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card p-3.5 rounded-xl border border-line flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium text-dim block">Harga Beli (HPP)</span>
            <div className="text-base font-bold text-heading mt-0.5 tnum">
              Rp {costPrice.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-dim block mt-0.5">
              Per {baseUnit?.unit_name || 'Satuan'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-muted text-dim shrink-0">
            <DollarSign size={16} />
          </div>
        </div>

        <div className="bg-card p-3.5 rounded-xl border border-line flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium text-dim block">Harga Jual Eceran</span>
            <div className="text-base font-bold text-success mt-0.5 tnum">
              Rp {regularPrice.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-dim block mt-0.5 tnum">
              Margin Rp {Math.max(0, marginRp).toLocaleString('id-ID')} ({marginPercent}%)
            </span>
          </div>
          <div className="p-2 rounded-lg bg-success-soft text-success shrink-0">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-card p-3.5 rounded-xl border border-line flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium text-dim block">Stok Fisik</span>
            <div className="text-base font-bold text-heading mt-0.5 tnum">
              {totalStock}{' '}
              <span className="text-xs font-medium text-dim">{baseUnit?.unit_name || 'Unit'}</span>
            </div>
            <span className="text-[11px] text-dim block mt-0.5 tnum">
              Valuasi Rp {totalValuation.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-muted text-dim shrink-0">
            <Package size={16} />
          </div>
        </div>

        <div className="bg-card p-3.5 rounded-xl border border-line flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium text-dim block">Aturan Stok</span>
            <div className="text-xs font-bold text-heading mt-1 tnum">
              HPP {(item.hpp_method || 'AVG').toUpperCase()} / Min {item.min_stock} {baseUnit?.unit_name || 'Unit'}
            </div>
            <span className="text-[11px] text-dim block mt-0.5">
              {item.requires_prescription === 1 ? 'Wajib Resep' : 'Bebas'}
              {item.has_expiry === 1 ? ' | Expiry Aktif' : ''}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-muted text-dim shrink-0">
            <ShieldCheck size={16} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-line overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-dim" />
                <h3 className="font-bold text-heading text-sm">Satuan & Harga Jual</h3>
              </div>
              <span className="text-xs font-medium text-dim tnum">{units.length} satuan</span>
            </div>

            <div className="overflow-x-auto">
              {units.length === 0 ? (
                <div className="p-6 text-center text-dim text-xs">Belum ada satuan kemasan.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-dim font-semibold border-b border-line">
                    <tr>
                      <th className="py-2.5 px-3.5">Satuan / Konversi</th>
                      <th className="py-2.5 px-3 text-right">Eceran</th>
                      <th className="py-2.5 px-3 text-right">Member</th>
                      <th className="py-2.5 px-3.5 text-right">VIP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {units.map((u) => {
                      const regular =
                        prices.find((p) => p.unit_id === u.id && p.customer_tier === 'regular')?.price || 0;
                      const member =
                        prices.find((p) => p.unit_id === u.id && p.customer_tier === 'member')?.price || regular;
                      const vip =
                        prices.find((p) => p.unit_id === u.id && p.customer_tier === 'vip')?.price || regular;

                      return (
                        <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-heading flex items-center gap-1.5">
                              {u.unit_name}
                              {u.is_base === 1 && (
                                <span className="bg-muted text-dim text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-line">
                                  Dasar
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-dim mt-0.5 font-mono tnum">
                              {u.is_base === 1
                                ? '1 : 1'
                                : `= ${u.conversion} ${baseUnit?.unit_name || 'Dasar'}`}
                              {u.barcode ? ` | ${u.barcode}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-heading tnum">
                            Rp {regular.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-body tnum">
                            Rp {member.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-medium text-body tnum">
                            Rp {vip.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-line overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <Tags size={15} className="text-dim" />
                <h3 className="font-bold text-heading text-sm">Tier Harga Grosir</h3>
              </div>
              <span className="text-xs font-medium text-dim tnum">{price_tiers?.length || 0} tier</span>
            </div>

            <div className="overflow-x-auto">
              {!price_tiers || price_tiers.length === 0 ? (
                <div className="p-5 text-center text-dim text-xs">Tidak ada tier harga grosir.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-dim font-semibold border-b border-line">
                    <tr>
                      <th className="py-2 px-3.5">Level</th>
                      <th className="py-2 px-3.5">Batas Qty</th>
                      <th className="py-2 px-3.5 text-right">Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {price_tiers.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3.5 font-semibold text-heading">Tier {t.tier_level}</td>
                        <td className="py-2.5 px-3.5 text-body tnum">
                          Maks {t.max_qty} {baseUnit?.unit_name || 'Unit'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-heading tnum">
                          Rp {t.price.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-line mb-3">
              <ShieldCheck size={15} className="text-dim" />
              <h3 className="font-bold text-heading text-sm">Spesifikasi</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Kategori</span>
                <span className="font-semibold text-heading truncate block mt-0.5">
                  {item.category_name || '-'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Lokasi Rak</span>
                <span className="font-semibold font-mono text-heading truncate block mt-0.5">
                  {item.rack_location || '-'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Metode HPP</span>
                <span className="font-semibold uppercase text-heading truncate block mt-0.5">
                  {item.hpp_method || 'AVG'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Stok Minimum</span>
                <span className="font-semibold text-heading truncate block mt-0.5 tnum">
                  {item.min_stock} {baseUnit?.unit_name || 'Unit'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Resep Dokter</span>
                <span className="font-semibold text-heading truncate block mt-0.5">
                  {item.requires_prescription === 1 ? 'Wajib Resep' : 'Bebas'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/50 border border-line">
                <span className="text-dim text-[11px] block">Lacak Kadaluarsa</span>
                <span className="font-semibold text-heading truncate block mt-0.5">
                  {item.has_expiry === 1 ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
            </div>
          </div>

          {item.has_expiry === 1 && (
            <div className="bg-card rounded-xl border border-line overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-muted/40">
                <div className="flex items-center gap-2">
                  <CalendarDays size={15} className="text-dim" />
                  <h3 className="font-bold text-heading text-sm">Batch & Kadaluarsa</h3>
                </div>
                <span className="text-xs font-medium text-dim tnum">
                  {active_batches?.length || 0} batch
                </span>
              </div>

              <div className="overflow-x-auto">
                {!active_batches || active_batches.length === 0 ? (
                  <div className="p-5 text-center text-dim text-xs">Tidak ada batch aktif.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-dim font-semibold border-b border-line">
                      <tr>
                        <th className="py-2 px-3.5">No. Batch</th>
                        <th className="py-2 px-3">Kadaluarsa</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3.5 text-right">Sisa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {active_batches.map((b, idx) => {
                        const daysLeft = b.expiry_date
                          ? Math.ceil(
                              (new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                            )
                          : null;

                        let statusEl = <span className="text-dim">-</span>;
                        if (daysLeft !== null) {
                          if (daysLeft <= 0) {
                            statusEl = (
                              <span className="bg-danger-soft text-danger px-1.5 py-0.5 rounded-md text-[11px] font-semibold">
                                Kadaluarsa
                              </span>
                            );
                          } else if (daysLeft <= 30) {
                            statusEl = (
                              <span className="bg-warning-soft text-warning px-1.5 py-0.5 rounded-md text-[11px] font-semibold tnum">
                                Kritis ({daysLeft}h)
                              </span>
                            );
                          } else if (daysLeft <= 90) {
                            statusEl = (
                              <span className="bg-warning-soft text-warning px-1.5 py-0.5 rounded-md text-[11px] font-semibold tnum">
                                Waspada ({daysLeft}h)
                              </span>
                            );
                          } else {
                            statusEl = (
                              <span className="bg-success-soft text-success px-1.5 py-0.5 rounded-md text-[11px] font-semibold tnum">
                                Aman ({daysLeft}h)
                              </span>
                            );
                          }
                        }

                        return (
                          <tr key={idx} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-3.5 font-mono font-semibold text-heading">
                              {b.batch_no || '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-body tnum">{b.expiry_date || '-'}</td>
                            <td className="py-2.5 px-3">{statusEl}</td>
                            <td className="py-2.5 px-3.5 text-right font-semibold text-heading tnum">
                              {b.current_qty}{' '}
                              <span className="text-[11px] font-normal text-dim">
                                {baseUnit?.unit_name || 'Unit'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
