import { useState, useEffect, useCallback } from 'react';
import { getSuppliers, Supplier } from '../../lib/api';
import { Loader2, Plus, Building2, Edit2, Search, Phone, AlertCircle } from 'lucide-react';
import SupplierDrawer from './SupplierDrawer';
import Button from '../../components/ui/Button';

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      setError(e?.message || String(e) || 'Gagal memuat data pemasok.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setSupplierToEdit(null);
    setIsDrawerOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setSupplierToEdit(s);
    setIsDrawerOpen(true);
  };

  const query = search.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter(
    (s) =>
      !query ||
      s.name.toLowerCase().includes(query) ||
      (s.contact_person || '').toLowerCase().includes(query) ||
      (s.phone || '').includes(search.trim()) ||
      (s.email || '').toLowerCase().includes(query),
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-heading">Pemasok</h1>
        <Button variant="primary" size="md" onClick={openAdd}>
          <Plus size={15} />
          Tambah Pemasok
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="p-3 sm:px-4 border-b border-line bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex-1 w-full sm:max-w-md h-9 flex items-center bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
            <Search size={15} className="text-dim mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, PIC, telepon, atau email..."
              className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
            />
          </div>

          <span className="text-xs font-medium text-dim tnum shrink-0">
            {filteredSuppliers.length} pemasok
          </span>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-dim gap-2">
            <Loader2 className="animate-spin text-primary" size={24} />
            <span className="text-xs">Memuat data pemasok...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
            <AlertCircle size={24} className="text-danger" />
            <p className="text-sm text-body max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={loadData}>
              Muat Ulang
            </Button>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-dim mb-1">
              <Building2 size={20} />
            </div>
            <p className="text-sm font-semibold text-heading">
              {search ? 'Pemasok tidak ditemukan' : 'Belum ada pemasok'}
            </p>
            <p className="text-xs text-dim">
              {search
                ? 'Coba kata kunci pencarian lain.'
                : 'Tambahkan pemasok untuk mencatat penerimaan barang.'}
            </p>
            <div className="mt-2">
              {search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Reset Pencarian
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus size={14} />
                  Tambah Pemasok
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 bg-muted border-b border-line text-xs text-dim font-semibold z-10">
                <tr>
                  <th className="py-3 px-4">Pemasok</th>
                  <th className="py-3 px-4">PIC</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Tempo</th>
                  <th className="py-3 px-4">Alamat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-heading">{s.name}</p>
                      {s.notes && (
                        <p className="text-xs text-dim mt-0.5 line-clamp-1">{s.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-body">
                      {s.contact_person || <span className="text-dim">-</span>}
                    </td>
                    <td className="py-3 px-4">
                      {s.phone ? (
                        <a
                          href={`https://wa.me/${s.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-heading hover:text-primary hover:underline"
                        >
                          <Phone size={12} className="text-dim shrink-0" />
                          {s.phone}
                        </a>
                      ) : (
                        <span className="text-dim text-xs">-</span>
                      )}
                      {s.email && <p className="text-xs text-dim mt-0.5">{s.email}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-body border border-line text-xs font-medium">
                        {s.payment_terms || 'NET 30'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-body text-xs max-w-xs truncate">
                      {s.address || <span className="text-dim">-</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(s)}
                        aria-label={`Edit ${s.name}`}
                      >
                        <Edit2 size={13} />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SupplierDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={loadData}
        supplierToEdit={supplierToEdit}
      />
    </div>
  );
}
