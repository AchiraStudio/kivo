import { useState, useEffect } from 'react';
import {
  Tag,
  FolderTree,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronRight,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  getBrands,
  addBrand,
  updateBrand,
  deleteBrand,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  Brand,
  Category,
  discoverPotentialBrands,
  DiscoveredBrand,
  invoke,
} from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import TabBar, { TabItem } from '../../components/ui/TabBar';
import { toast } from '../../components/ui/Toast';

type MasterTab = 'categories' | 'brands';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<MasterTab>('categories');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveredBrands, setDiscoveredBrands] = useState<DiscoveredBrand[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isAddingDiscovered, setIsAddingDiscovered] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [b, c] = await Promise.all([getBrands(), getCategories()]);
      setBrands(b);
      setCategories(c);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setIsSubmitting(true);
    try {
      if (activeTab === 'brands') {
        await addBrand(newItemName.trim());
        try {
          await invoke('auto_assign_brands');
        } catch (err) {
          console.warn('Failed to auto-assign brands', err);
        }
      } else {
        await addCategory(newItemName.trim(), undefined, undefined, selectedParentId || undefined);
      }
      setNewItemName('');
      setSelectedParentId('');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan data: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      if (activeTab === 'brands') {
        await updateBrand(id, editName);
      } else {
        await updateCategory(id, editName);
      }
      setEditingId(null);
      loadData();
    } catch (error) {
      toast.error('Gagal memperbarui: ' + error);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      if (activeTab === 'brands') {
        await deleteBrand(deleteTargetId);
      } else {
        await deleteCategory(deleteTargetId);
      }
      toast.success('Data dihapus.');
      loadData();
    } catch (error) {
      toast.error('Gagal menghapus. Data mungkin masih digunakan.');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleDiscover = async () => {
    setShowDiscovery(true);
    setIsDiscovering(true);
    setDiscoveredBrands([]);
    setSelectedDiscovered(new Set());
    try {
      const results = await discoverPotentialBrands();
      const existingNames = new Set(brands.map((b) => b.name.toUpperCase()));
      setDiscoveredBrands(results.filter((r) => !existingNames.has(r.name.toUpperCase())));
    } catch (e) {
      console.error(e);
      toast.error('Gagal memindai brand baru.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddDiscovered = async () => {
    if (selectedDiscovered.size === 0) return;
    setIsAddingDiscovered(true);
    try {
      for (const bName of Array.from(selectedDiscovered)) {
        await addBrand(bName);
      }
      const msg = await invoke('auto_assign_brands');
      toast.success(msg as string);
      setShowDiscovery(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Gagal menambahkan brand: ' + e);
    } finally {
      setIsAddingDiscovered(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: TabItem<MasterTab>[] = [
    { id: 'categories', label: 'Kategori', icon: FolderTree, badge: categories.length },
    { id: 'brands', label: 'Brand', icon: Tag, badge: brands.length },
  ];

  const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
    const children = (searchQuery ? filteredCategories : categories).filter(
      (c) => (c.parent_id || null) === parentId
    );
    if (children.length === 0) return null;

    return (
      <div className="space-y-1.5">
        {children.map((cat) => {
          const subChildrenCount = categories.filter((c) => c.parent_id === cat.id).length;
          return (
            <div key={cat.id}>
              <div
                className="flex items-center gap-2.5 py-2 px-3 bg-card hover:bg-muted/50 rounded-lg border border-line transition-colors group"
                style={{ marginLeft: `${depth * 1.25}rem` }}
              >
                {depth > 0 && <ChevronRight size={14} className="text-dim shrink-0" />}
                <div className="p-1.5 rounded-md bg-muted text-dim shrink-0">
                  <FolderTree size={14} />
                </div>

                {editingId === cat.id ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-8 bg-input border border-primary rounded-lg px-2.5 text-xs font-semibold text-heading outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdate(cat.id)}
                      className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover cursor-pointer"
                      aria-label="Simpan"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 bg-muted text-body rounded-lg hover:bg-muted-hover cursor-pointer"
                      aria-label="Batal"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-heading truncate">{cat.name}</p>
                      {subChildrenCount > 0 && (
                        <span className="text-[11px] text-dim tnum">{subChildrenCount} sub-kategori</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                        }}
                        className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Edit Kategori"
                        aria-label="Edit Kategori"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Hapus Kategori"
                        aria-label="Hapus Kategori"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
              {renderCategoryTree(cat.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in w-full h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-bold text-heading tracking-tight">Master Data</h1>
        <Button variant="outline" size="sm" onClick={handleDiscover}>
          <Search size={14} /> Deteksi Brand
        </Button>
      </div>

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setEditingId(null);
          setSearchQuery('');
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-4">
          <div className="bg-card rounded-xl border border-line p-4 space-y-4">
            <h2 className="text-sm font-bold text-heading">
              Tambah {activeTab === 'categories' ? 'Kategori' : 'Brand'}
            </h2>

            <form onSubmit={handleAddItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-heading mb-1.5">
                  Nama {activeTab === 'categories' ? 'Kategori' : 'Brand'}
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={activeTab === 'categories' ? 'Contoh: Vitamin' : 'Contoh: Kalbe Farma'}
                  disabled={isSubmitting}
                  className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              {activeTab === 'categories' && (
                <div>
                  <label className="block text-xs font-semibold text-heading mb-1.5">
                    Induk Kategori
                  </label>
                  <Select
                    value={selectedParentId}
                    onChange={(v) => setSelectedParentId(v)}
                    className="w-full"
                  >
                    <option value="">Tanpa Induk (Utama)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={!newItemName.trim()}
              >
                {!isSubmitting && <Plus size={15} />}
                Simpan {activeTab === 'categories' ? 'Kategori' : 'Brand'}
              </Button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 bg-card rounded-xl border border-line flex flex-col min-h-[420px] overflow-hidden">
          <div className="p-3.5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/40">
            <h3 className="font-bold text-heading text-sm">
              Daftar {activeTab === 'categories' ? 'Kategori' : 'Brand'}
            </h3>

            <div className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                type="text"
                placeholder={`Cari ${activeTab === 'categories' ? 'kategori' : 'brand'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-input border border-line rounded-lg pl-8 pr-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-dim">
                <Loader2 size={22} className="animate-spin mb-2 text-primary" />
                <p className="text-xs font-medium">Memuat data...</p>
              </div>
            ) : errorMsg ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <AlertCircle size={22} className="text-danger mb-2" />
                <p className="text-sm font-semibold text-heading">Gagal memuat master data</p>
                <p className="text-xs text-dim mt-0.5 mb-3">{errorMsg}</p>
                <Button variant="outline" size="sm" onClick={loadData}>
                  Coba Lagi
                </Button>
              </div>
            ) : activeTab === 'categories' ? (
              categories.length === 0 ? (
                <div className="text-center py-16 text-dim text-sm">Belum ada kategori.</div>
              ) : (
                renderCategoryTree(null, 0)
              )
            ) : filteredBrands.length === 0 ? (
              <div className="text-center py-16 text-dim text-sm">Tidak ada brand ditemukan.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredBrands.map((b) => (
                  <div
                    key={b.id}
                    className="group p-3 border border-line rounded-lg bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-2"
                  >
                    {editingId === b.id ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 h-8 bg-input border border-primary rounded-lg px-2 text-xs font-semibold text-heading outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdate(b.id)}
                          className="p-1.5 text-success hover:bg-success-soft rounded-md cursor-pointer"
                          aria-label="Simpan"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-dim hover:text-heading rounded-md cursor-pointer"
                          aria-label="Batal"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-md bg-muted text-heading border border-line flex items-center justify-center shrink-0 font-bold text-[11px]">
                            {b.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm text-heading truncate">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(b.id);
                              setEditName(b.name);
                            }}
                            className="p-1 text-dim hover:text-heading hover:bg-muted rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Edit Brand"
                            aria-label="Edit Brand"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            className="p-1 text-dim hover:text-danger hover:bg-danger-soft rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Hapus Brand"
                            aria-label="Hapus Brand"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDiscovery && (
        <Modal
          isOpen={true}
          onClose={() => setShowDiscovery(false)}
          size="2xl"
          title="Deteksi Brand Baru"
          icon={Search}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => setShowDiscovery(false)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleAddDiscovered}
                loading={isAddingDiscovered}
                disabled={selectedDiscovered.size === 0}
                className="tnum"
              >
                {!isAddingDiscovered && <Save size={15} />}
                Daftarkan ({selectedDiscovered.size})
              </Button>
            </div>
          }
        >
          {isDiscovering ? (
            <div className="flex flex-col items-center py-16 text-dim">
              <Loader2 size={24} className="animate-spin mb-2 text-primary" />
              <p className="text-xs font-medium">Memindai katalog...</p>
            </div>
          ) : discoveredBrands.length === 0 ? (
            <div className="text-center py-16 space-y-1.5">
              <Tag size={28} className="mx-auto text-dim" />
              <p className="text-sm font-semibold text-heading">Tidak ada brand baru terdeteksi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-body tnum">
                  Ditemukan <span className="font-semibold text-heading">{discoveredBrands.length}</span> brand baru.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedDiscovered.size === discoveredBrands.length) {
                      setSelectedDiscovered(new Set());
                    } else {
                      setSelectedDiscovered(new Set(discoveredBrands.map((b) => b.name)));
                    }
                  }}
                >
                  {selectedDiscovered.size === discoveredBrands.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {discoveredBrands.map((brand, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDiscovered.has(brand.name)
                        ? 'bg-primary-soft border-primary'
                        : 'bg-card border-line hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-line-strong text-primary focus:ring-primary"
                      checked={selectedDiscovered.has(brand.name)}
                      onChange={(e) => {
                        const newSet = new Set(selectedDiscovered);
                        if (e.target.checked) newSet.add(brand.name);
                        else newSet.delete(brand.name);
                        setSelectedDiscovered(newSet);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-heading text-xs truncate" title={brand.name}>
                        {brand.name}
                      </p>
                      <p className="text-[11px] text-dim mt-0.5 tnum">{brand.count} produk</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
      {deleteTargetId && (
        <ConfirmModal
          title={activeTab === 'brands' ? 'Hapus Brand' : 'Hapus Kategori'}
          message="Data yang dihapus tidak dapat dikembalikan."
          confirmLabel="Hapus"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
