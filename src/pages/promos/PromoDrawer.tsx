import React, { useState, useEffect } from 'react';
import {
  Save, Plus, Trash2, Percent, Coins, Gift, Layers, Package, Calendar, Search,
  Tag, AlertCircle, ShoppingBag, Check, Loader2,
} from 'lucide-react';
import {
  CreatePromoInput, getPromoDetail, createPromo, updatePromo,
  getItemsFiltered, getCategories, Category, Item, getItem,
} from '../../lib/api';
import { useDebounce } from '../../lib/hooks/useDebounce';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

interface PromoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editPromoId: string | null;
}

const fieldCls =
  'w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors';

const labelCls = 'block text-xs font-semibold text-heading mb-1.5';

const PROMO_TYPES = [
  { id: 'percentage', label: 'Diskon Persen', sub: 'Diskon 20%', icon: Percent },
  { id: 'fixed_amount', label: 'Potongan Nominal', sub: 'Potongan Rp 10.000', icon: Coins },
  { id: 'bogo', label: 'Beli X Gratis Y', sub: 'Beli 2 Gratis 1', icon: Gift },
  { id: 'tiered', label: 'Diskon Bertingkat', sub: 'Diskon per jumlah beli', icon: Layers },
  { id: 'bundle', label: 'Paket Bundle', sub: 'Paket hemat beberapa item', icon: Package },
] as const;

const APPLIES_TO_OPTIONS = [
  { id: 'item', label: 'Per Item', desc: 'Produk tertentu', icon: Tag },
  { id: 'category', label: 'Per Kategori', desc: 'Semua item kategori', icon: Layers },
  { id: 'transaction', label: 'Total Transaksi', desc: 'Total keranjang', icon: ShoppingBag },
] as const;

const MEMBER_TIERS = [
  { id: '', label: 'Semua Pelanggan' },
  { id: 'regular', label: 'Reguler' },
  { id: 'member', label: 'Member' },
  { id: 'vip', label: 'VIP' },
] as const;

export default function PromoDrawer({ isOpen, onClose, onSaved, editPromoId }: PromoDrawerProps) {
  const [formData, setFormData] = useState<CreatePromoInput>({
    name: '',
    description: '',
    discount_percent: 0,
    min_qty: 1,
    member_only: 0,
    promo_type: 'percentage',
    applies_to: 'item',
    stack_rule: 'best_only',
    priority: 1,
    bogo_rules: [],
    tiers: [],
    bundle_items: [],
  });

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Single Item Search
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const debouncedItemSearch = useDebounce(itemSearchQuery, 250);
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isSearchingItem, setIsSearchingItem] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Bundle Items Search
  const [bundleSearchQuery, setBundleSearchQuery] = useState('');
  const debouncedBundleSearch = useDebounce(bundleSearchQuery, 250);
  const [bundleSearchResults, setBundleSearchResults] = useState<Item[]>([]);
  const [isSearchingBundle, setIsSearchingBundle] = useState(false);
  const [showBundleDropdown, setShowBundleDropdown] = useState(false);
  const [bundleItemDetails, setBundleItemDetails] = useState<Record<string, Item>>({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (debouncedItemSearch && debouncedItemSearch.trim().length > 0) {
      searchItems(debouncedItemSearch);
    } else {
      setSearchResults([]);
    }
  }, [debouncedItemSearch]);

  const searchItems = async (query: string) => {
    setIsSearchingItem(true);
    try {
      const data = await getItemsFiltered(query, '', '', true, 1, 10);
      setSearchResults(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingItem(false);
    }
  };

  useEffect(() => {
    if (debouncedBundleSearch && debouncedBundleSearch.trim().length > 0) {
      searchBundleItems(debouncedBundleSearch);
    } else {
      setBundleSearchResults([]);
    }
  }, [debouncedBundleSearch]);

  const searchBundleItems = async (query: string) => {
    setIsSearchingBundle(true);
    try {
      const data = await getItemsFiltered(query, '', '', true, 1, 10);
      setBundleSearchResults(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingBundle(false);
    }
  };

  useEffect(() => {
    setErrorMessage(null);
    if (editPromoId && isOpen) {
      loadPromoDetails(editPromoId);
    } else if (!editPromoId && isOpen) {
      setFormData({
        name: '',
        description: '',
        discount_percent: 10,
        discount_value: undefined,
        min_qty: 1,
        member_only: 0,
        promo_type: 'percentage',
        applies_to: 'item',
        stack_rule: 'best_only',
        priority: 1,
        bogo_rules: [],
        tiers: [],
        bundle_items: [],
      });
      setItemSearchQuery('');
      setSelectedItem(null);
      setBundleSearchQuery('');
      setBundleItemDetails({});
    }
  }, [editPromoId, isOpen]);

  const loadPromoDetails = async (id: string) => {
    setLoadingDetail(true);
    try {
      const promoDetail = await getPromoDetail(id);
      const { promo, bogo_rules, tiers, bundle_items } = promoDetail;
      setFormData({
        name: promo.name,
        description: promo.description || '',
        promo_type: promo.promo_type as any,
        applies_to: promo.applies_to as any,
        category_id: promo.category_id,
        item_id: promo.item_id,
        discount_percent: promo.discount_percent || 0,
        discount_value: promo.discount_value,
        max_discount_amount: promo.max_discount_amount,
        min_qty: promo.min_qty || 1,
        start_date: promo.start_date ? promo.start_date.split('T')[0] : undefined,
        end_date: promo.end_date ? promo.end_date.split('T')[0] : undefined,
        member_only: promo.member_only ? 1 : 0,
        member_tier: promo.member_tier,
        stack_rule: promo.stack_rule as any,
        priority: promo.priority || 1,
        bogo_rules: bogo_rules.map(r => ({
          buy_qty: r.buy_qty,
          get_qty: r.get_qty,
          free_item_id: r.free_item_id,
          free_item_discount_percent: r.free_item_discount_percent,
        })),
        tiers: tiers.map(t => ({
          min_qty: t.min_qty,
          discount_percent: t.discount_percent,
        })),
        bundle_items: bundle_items.map(b => ({
          item_id: b.item_id,
          qty: b.qty,
        })),
      });

      if (promo.item_id) {
        try {
          const itemData = await getItem(promo.item_id);
          setSelectedItem(itemData.item);
          setItemSearchQuery(itemData.item.name);
        } catch (e) {
          console.error(e);
        }
      } else {
        setSelectedItem(null);
        setItemSearchQuery('');
      }

      if (bundle_items && bundle_items.length > 0) {
        const detailsMap: Record<string, Item> = {};
        for (const bi of bundle_items) {
          try {
            const itemData = await getItem(bi.item_id);
            detailsMap[bi.item_id] = itemData.item;
          } catch (e) {
            console.error(e);
          }
        }
        setBundleItemDetails(detailsMap);
      } else {
        setBundleItemDetails({});
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Gagal memuat detail promo.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddTier = () => {
    setFormData(prev => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        { min_qty: prev.tiers.length ? prev.tiers[prev.tiers.length - 1].min_qty + 2 : 2, discount_percent: 10 },
      ],
    }));
  };

  const handleRemoveTier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('Nama promo wajib diisi.');
      return;
    }

    if (formData.applies_to === 'item' && formData.promo_type !== 'bundle' && !formData.item_id) {
      setErrorMessage('Pilih item target promo.');
      return;
    }

    if (formData.applies_to === 'category' && !formData.category_id) {
      setErrorMessage('Pilih kategori target promo.');
      return;
    }

    if (formData.promo_type === 'bundle' && (!formData.bundle_items || formData.bundle_items.length === 0)) {
      setErrorMessage('Tambahkan minimal 1 item ke paket bundle.');
      return;
    }

    if (formData.promo_type === 'bogo' && (!formData.bogo_rules || formData.bogo_rules.length === 0)) {
      setErrorMessage('Tentukan aturan BOGO (Beli X Gratis Y).');
      return;
    }

    if (formData.promo_type === 'tiered' && (!formData.tiers || formData.tiers.length === 0)) {
      setErrorMessage('Tambahkan minimal 1 tingkatan diskon.');
      return;
    }

    setSaving(true);
    try {
      const payload: CreatePromoInput = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        discount_percent: Number(formData.discount_percent) || 0,
        discount_value: formData.discount_value ? Number(formData.discount_value) : undefined,
        max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : undefined,
        min_qty: Math.max(1, Number(formData.min_qty) || 1),
        priority: Number(formData.priority) || 1,
        item_id: formData.applies_to === 'item' && formData.promo_type !== 'bundle' ? formData.item_id : undefined,
        category_id: formData.applies_to === 'category' ? formData.category_id : undefined,
        start_date: formData.start_date ? `${formData.start_date}T00:00:00` : undefined,
        end_date: formData.end_date ? `${formData.end_date}T23:59:59` : undefined,
      };

      if (editPromoId) {
        await updatePromo(editPromoId, payload);
      } else {
        await createPromo(payload);
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error(error);
      const msg = typeof error === 'string' ? error : error?.message || 'Gagal menyimpan promo. Periksa kembali data.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const isPercentMode =
    formData.promo_type === 'percentage' || (formData.promo_type === 'bundle' && formData.discount_percent > 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={editPromoId ? 'Edit Promo' : 'Buat Promo Baru'}
      icon={Tag}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="promo-form" loading={saving} disabled={loadingDetail}>
            {!saving && <Save size={15} />}
            {editPromoId ? 'Simpan Perubahan' : 'Buat Promo'}
          </Button>
        </>
      }
    >
      {loadingDetail ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2" role="status" aria-label="Memuat detail promo">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="text-xs text-dim">Memuat detail promo</span>
        </div>
      ) : (
        <form id="promo-form" onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-danger-soft border border-danger/30 rounded-xl flex items-start gap-2.5 text-danger">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* 1. Basic Info */}
          <div className="space-y-3.5">
            <div>
              <label className={labelCls}>
                Nama Promo <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={fieldCls}
                placeholder="Mis. Diskon Gajian 20%"
              />
            </div>

            <div>
              <label className={labelCls}>Deskripsi</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors resize-none"
                rows={2}
                placeholder="Syarat atau catatan singkat promo"
              />
            </div>
          </div>

          {/* 2. Promo Strategy Type */}
          <div>
            <span className={labelCls}>
              Tipe Promo <span className="text-danger">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PROMO_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = formData.promo_type === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      const newAppliesTo = type.id === 'bundle' ? 'item' : formData.applies_to;
                      setFormData({
                        ...formData,
                        promo_type: type.id as any,
                        applies_to: newAppliesTo,
                        bogo_rules:
                          type.id === 'bogo' && formData.bogo_rules.length === 0
                            ? [{ buy_qty: 2, get_qty: 1, free_item_discount_percent: 100 }]
                            : formData.bogo_rules,
                        tiers:
                          type.id === 'tiered' && formData.tiers.length === 0
                            ? [{ min_qty: 3, discount_percent: 10 }]
                            : formData.tiers,
                      });
                    }}
                    className={`flex items-start gap-2.5 text-left p-3 rounded-xl border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected
                        ? 'border-primary bg-primary-soft'
                        : 'border-line bg-card hover:border-line-strong'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg border shrink-0 ${
                        isSelected
                          ? 'bg-card text-primary border-primary/30'
                          : 'bg-muted text-dim border-line'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-heading">{type.label}</div>
                      <div className="text-[11px] text-dim mt-0.5">{type.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Applies To Selection */}
          {formData.promo_type !== 'bundle' && (
            <div>
              <span className={labelCls}>
                Target Promo <span className="text-danger">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {APPLIES_TO_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = formData.applies_to === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, applies_to: opt.id as any })}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected
                          ? 'border-primary bg-primary-soft'
                          : 'border-line bg-card hover:border-line-strong'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg border shrink-0 ${
                          isSelected
                            ? 'bg-card text-primary border-primary/30'
                            : 'bg-muted text-dim border-line'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-heading">{opt.label}</div>
                        <div className="text-[11px] text-dim mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target Item Search */}
          {formData.applies_to === 'item' && formData.promo_type !== 'bundle' && (
            <div className="p-4 bg-muted/40 rounded-xl border border-line space-y-2.5">
              <label className="block text-xs font-semibold text-heading">
                Produk Target <span className="text-danger">*</span>
              </label>

              {selectedItem ? (
                <div className="flex items-center justify-between gap-3 p-3 bg-card rounded-xl border border-line">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                      <Check size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-heading truncate">{selectedItem.name}</div>
                      <div className="text-[11px] text-dim font-mono truncate">
                        {selectedItem.sku}
                        {selectedItem.category_name ? ` · ${selectedItem.category_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(null);
                      setFormData({ ...formData, item_id: undefined });
                      setItemSearchQuery('');
                    }}
                  >
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
                    <Search className="text-dim mr-2 shrink-0" size={15} />
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onChange={e => {
                        setItemSearchQuery(e.target.value);
                        setShowItemDropdown(true);
                      }}
                      onFocus={() => setShowItemDropdown(true)}
                      onBlur={() => setShowItemDropdown(false)}
                      className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
                      placeholder="Cari nama produk, SKU, atau barcode"
                    />
                    {isSearchingItem && <Loader2 size={14} className="animate-spin text-dim shrink-0" />}
                  </div>

                  {showItemDropdown && itemSearchQuery.trim() && (
                    <div className="absolute z-50 w-full mt-1 bg-elevated border border-line rounded-lg shadow-lg shadow-black/15 dark:shadow-black/45 p-1 max-h-56 overflow-y-auto custom-scrollbar">
                      {isSearchingItem ? (
                        <div className="px-2.5 py-3 text-xs text-dim text-center">Mencari produk</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setFormData({ ...formData, item_id: item.id });
                              setSelectedItem(item);
                              setItemSearchQuery(item.name);
                              setShowItemDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-md hover:bg-muted focus-visible:bg-muted focus-visible:outline-none transition-colors cursor-pointer"
                          >
                            <div className="font-semibold text-heading text-xs">{item.name}</div>
                            <div className="text-[11px] font-mono text-dim mt-0.5">{item.sku}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-2.5 py-3 text-xs text-dim text-center">Produk tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Target Category Selection */}
          {formData.applies_to === 'category' && formData.promo_type !== 'bundle' && (
            <div className="p-4 bg-muted/40 rounded-xl border border-line space-y-2">
              <label className="block text-xs font-semibold text-heading">
                Kategori Produk <span className="text-danger">*</span>
              </label>
              <Select
                value={formData.category_id || ''}
                onChange={v => setFormData({ ...formData, category_id: v || undefined })}
                placeholder="Pilih kategori"
                className="w-full"
                ariaLabel="Kategori produk"
              >
                <option value="">Pilih kategori</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Bundle Items Builder */}
          {formData.promo_type === 'bundle' && (
            <div className="p-4 bg-muted/40 rounded-xl border border-line space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-dim" />
                  <h3 className="font-bold text-sm text-heading">Item Paket Bundle</h3>
                </div>
                <span className="text-[11px] font-semibold text-body bg-card border border-line px-2 py-0.5 rounded-full tnum">
                  {formData.bundle_items?.length || 0} item
                </span>
              </div>

              <div className="relative">
                <div className="flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
                  <Search className="text-dim mr-2 shrink-0" size={15} />
                  <input
                    type="text"
                    value={bundleSearchQuery}
                    onChange={e => {
                      setBundleSearchQuery(e.target.value);
                      setShowBundleDropdown(true);
                    }}
                    onFocus={() => setShowBundleDropdown(true)}
                    onBlur={() => setShowBundleDropdown(false)}
                    className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
                    placeholder="Cari produk untuk ditambahkan ke bundle"
                  />
                  {isSearchingBundle && <Loader2 size={14} className="animate-spin text-dim shrink-0" />}
                </div>

                {showBundleDropdown && bundleSearchQuery.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-elevated border border-line rounded-lg shadow-lg shadow-black/15 dark:shadow-black/45 p-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {isSearchingBundle ? (
                      <div className="px-2.5 py-3 text-xs text-dim text-center">Mencari produk</div>
                    ) : bundleSearchResults.length > 0 ? (
                      bundleSearchResults.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            const exists = formData.bundle_items?.some(bi => bi.item_id === item.id);
                            if (!exists) {
                              setBundleItemDetails(prev => ({ ...prev, [item.id]: item }));
                              setFormData(prev => ({
                                ...prev,
                                bundle_items: [...(prev.bundle_items || []), { item_id: item.id, qty: 1 }],
                              }));
                            }
                            setBundleSearchQuery('');
                            setShowBundleDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-md hover:bg-muted focus-visible:bg-muted focus-visible:outline-none transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-heading text-xs truncate">{item.name}</div>
                            <div className="text-[11px] font-mono text-dim mt-0.5">{item.sku}</div>
                          </div>
                          <span className="text-[11px] font-semibold text-primary shrink-0">Tambah</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2.5 py-3 text-xs text-dim text-center">Item tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {!formData.bundle_items || formData.bundle_items.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-line-strong rounded-xl bg-card/50">
                    <Package size={22} className="mx-auto text-dim mb-1.5" />
                    <p className="text-xs font-medium text-dim">Belum ada item dalam bundle.</p>
                  </div>
                ) : (
                  formData.bundle_items.map(bi => {
                    const itemInfo = bundleItemDetails[bi.item_id];
                    return (
                      <div
                        key={bi.item_id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card rounded-lg border border-line"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-heading truncate">
                            {itemInfo?.name || `Item ID: ${bi.item_id}`}
                          </p>
                          <p className="text-[11px] font-mono text-dim truncate mt-0.5">
                            {itemInfo?.sku || '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-0.5 bg-muted p-0.5 border border-line rounded-lg">
                            <button
                              type="button"
                              aria-label="Kurangi jumlah"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  bundle_items: (prev.bundle_items || []).map(b =>
                                    b.item_id === bi.item_id ? { ...b, qty: Math.max(1, b.qty - 1) } : b
                                  ),
                                }));
                              }}
                              className="w-6 h-6 flex items-center justify-center text-body hover:bg-card rounded-md text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              aria-label="Jumlah item bundle"
                              value={bi.qty}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 1;
                                setFormData(prev => ({
                                  ...prev,
                                  bundle_items: (prev.bundle_items || []).map(b =>
                                    b.item_id === bi.item_id ? { ...b, qty: Math.max(1, val) } : b
                                  ),
                                }));
                              }}
                              className="w-10 bg-transparent text-center text-xs font-semibold text-heading focus:outline-none tnum"
                            />
                            <button
                              type="button"
                              aria-label="Tambah jumlah"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  bundle_items: (prev.bundle_items || []).map(b =>
                                    b.item_id === bi.item_id ? { ...b, qty: b.qty + 1 } : b
                                  ),
                                }));
                              }}
                              className="w-6 h-6 flex items-center justify-center text-body hover:bg-card rounded-md text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            aria-label={`Hapus ${itemInfo?.name || 'item'} dari bundle`}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                bundle_items: (prev.bundle_items || []).filter(b => b.item_id !== bi.item_id),
                              }));
                            }}
                            className="p-1.5 text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. Strategy Config */}
          <div className="p-4 bg-muted/40 rounded-xl border border-line space-y-4">
            {(formData.promo_type === 'percentage' ||
              formData.promo_type === 'fixed_amount' ||
              formData.promo_type === 'bundle') && (
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  {formData.promo_type === 'percentage' ? (
                    <Percent size={16} className="text-dim" />
                  ) : (
                    <Coins size={16} className="text-dim" />
                  )}
                  <h3 className="font-bold text-sm text-heading">Nilai Diskon</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {formData.promo_type === 'bundle' && (
                    <div>
                      <label className={labelCls}>Jenis Diskon Bundle</label>
                      <Select
                        value={formData.discount_percent > 0 ? 'percent' : 'fixed'}
                        onChange={v => {
                          if (v === 'percent') {
                            setFormData({ ...formData, discount_percent: 10, discount_value: undefined });
                          } else {
                            setFormData({ ...formData, discount_value: 5000, discount_percent: 0 });
                          }
                        }}
                        className="w-full"
                        ariaLabel="Jenis diskon bundle"
                      >
                        <option value="percent">Persentase (%)</option>
                        <option value="fixed">Nominal (Rp)</option>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>
                      Nilai Diskon {isPercentMode ? '(%)' : '(Rp)'} <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={isPercentMode ? formData.discount_percent : formData.discount_value || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        if (formData.promo_type === 'percentage') {
                          setFormData({ ...formData, discount_percent: val, discount_value: undefined });
                        } else if (formData.promo_type === 'bundle') {
                          if (formData.discount_percent > 0) {
                            setFormData({ ...formData, discount_percent: val, discount_value: undefined });
                          } else {
                            setFormData({ ...formData, discount_value: val, discount_percent: 0 });
                          }
                        } else {
                          setFormData({ ...formData, discount_value: val, discount_percent: 0 });
                        }
                      }}
                      className={`${fieldCls} tnum font-semibold`}
                      placeholder={isPercentMode ? '15' : '10000'}
                    />
                  </div>

                  {isPercentMode && (
                    <div>
                      <label className={labelCls}>Maksimal Diskon (Rp)</label>
                      <input
                        type="number"
                        value={formData.max_discount_amount || ''}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            max_discount_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className={`${fieldCls} tnum`}
                        placeholder="Opsional, mis. 50000"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tiered Discount Configuration */}
            {formData.promo_type === 'tiered' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-dim" />
                    <h3 className="font-bold text-sm text-heading">Tingkatan Diskon</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>
                    <Plus size={14} /> Tambah Tier
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {formData.tiers.map((tier, idx) => (
                    <div key={idx} className="flex gap-2.5 items-end">
                      <div className="flex-1 grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-dim mb-1">Min. beli (Qty)</label>
                          <input
                            type="number"
                            min="1"
                            value={tier.min_qty}
                            onChange={e => {
                              const newTiers = [...formData.tiers];
                              newTiers[idx].min_qty = parseFloat(e.target.value) || 1;
                              setFormData({ ...formData, tiers: newTiers });
                            }}
                            className={`${fieldCls} tnum`}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-dim mb-1">Diskon (%)</label>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={tier.discount_percent}
                            onChange={e => {
                              const newTiers = [...formData.tiers];
                              newTiers[idx].discount_percent = parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, tiers: newTiers });
                            }}
                            className={`${fieldCls} tnum font-semibold`}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Hapus tier ${idx + 1}`}
                        onClick={() => handleRemoveTier(idx)}
                        className="h-9 w-9 inline-flex items-center justify-center text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOGO Configuration */}
            {formData.promo_type === 'bogo' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-dim" />
                  <h3 className="font-bold text-sm text-heading">Aturan Beli X Gratis Y</h3>
                </div>

                {formData.bogo_rules.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    fullWidth
                    onClick={() => {
                      setFormData({
                        ...formData,
                        bogo_rules: [{ buy_qty: 2, get_qty: 1, free_item_discount_percent: 100 }],
                      });
                    }}
                  >
                    Aktifkan Aturan BOGO
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-3 bg-card p-3.5 rounded-xl border border-line">
                    <div>
                      <label className={labelCls}>Beli (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.bogo_rules[0].buy_qty}
                        onChange={e => {
                          const rules = [...formData.bogo_rules];
                          rules[0].buy_qty = parseInt(e.target.value) || 1;
                          setFormData({ ...formData, bogo_rules: rules });
                        }}
                        className={`${fieldCls} tnum font-semibold`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Gratis (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.bogo_rules[0].get_qty}
                        onChange={e => {
                          const rules = [...formData.bogo_rules];
                          rules[0].get_qty = parseInt(e.target.value) || 1;
                          setFormData({ ...formData, bogo_rules: rules });
                        }}
                        className={`${fieldCls} tnum font-semibold`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Validation Rules & Membership */}
          <div className="p-4 bg-muted/40 rounded-xl border border-line space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-dim" />
              <h3 className="font-bold text-sm text-heading">Periode & Member</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>Minimal Beli (Qty)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.min_qty}
                  onChange={e => setFormData({ ...formData, min_qty: parseFloat(e.target.value) || 1 })}
                  className={`${fieldCls} tnum`}
                />
              </div>

              <div>
                <label className={labelCls}>Prioritas</label>
                <input
                  type="number"
                  min="1"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                  className={`${fieldCls} tnum`}
                />
              </div>

              <div>
                <label className={labelCls}>Tanggal Mulai</label>
                <input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value || undefined })}
                  className={`${fieldCls} tnum`}
                />
              </div>

              <div>
                <label className={labelCls}>Tanggal Berakhir</label>
                <input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value || undefined })}
                  className={`${fieldCls} tnum`}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line">
              <span className={labelCls}>Target Member</span>
              <div className="flex flex-wrap gap-2">
                {MEMBER_TIERS.map(tier => {
                  const isSelected = (formData.member_tier || '') === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          member_tier: tier.id || undefined,
                          member_only: tier.id ? 1 : 0,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected
                          ? 'bg-primary-soft text-primary border-primary/40'
                          : 'bg-card border-line text-body hover:border-line-strong hover:text-heading'
                      }`}
                    >
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </form>
      )}
    </Drawer>
  );
}
