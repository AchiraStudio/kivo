import { useEffect, useState } from 'react';
import { getJournalEntries, JournalEntry, invoke } from '../../lib/api';
import { FileText, Plus, Search, Trash2, Loader2 } from 'lucide-react';
import JournalVoucher from './JournalVoucher';
import ManualJournalModal from './ManualJournalModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

export default function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteSale = async (entry: JournalEntry) => {
    setDeleting(true);
    try {
      await invoke('delete_sale', { id: entry.source_id });
      setDeleteConfirmEntry(null);
      fetchEntries();
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + (e?.message || String(e)));
    } finally {
      setDeleting(false);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJournalEntries();
      setEntries(data);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat daftar jurnal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  useEffect(() => {
    const handleSync = () => fetchEntries();
    window.addEventListener('kivo:sync', handleSync);
    return () => window.removeEventListener('kivo:sync', handleSync);
  }, []);

  const filteredEntries = entries.filter((e) => {
    const d = new Date(e.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && d < start) return false;
    if (end && d > new Date(new Date(endDate).getTime() + 86400000)) return false;

    return (
      e.entry_no?.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.source_id?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <h2 className="text-base font-bold tracking-tight text-heading">Jurnal Transaksi</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal mulai"
              className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-dim text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal akhir"
              className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="relative w-52">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
              size={14}
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari jurnal..."
              aria-label="Cari jurnal"
              className="w-full h-8 pl-8 pr-3 text-xs bg-input border border-line rounded-lg text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <Button type="button" variant="primary" size="sm" onClick={() => setIsManualModalOpen(true)}>
            <Plus size={15} strokeWidth={1.75} />
            Jurnal Manual
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-dim bg-muted/60 border-b border-line font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">No. Jurnal</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat jurnal...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="text-center py-14">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchEntries} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-dim text-sm">
                    Tidak ada entri jurnal ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/40 transition-colors fast-render-row">
                    <td className="px-4 py-3 whitespace-nowrap text-body text-xs tnum">
                      {new Date(entry.date).toLocaleDateString('id-ID')}{' '}
                      {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-heading whitespace-nowrap">
                      {entry.entry_no}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-body text-[11px] font-medium capitalize">
                        {entry.source_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-body text-xs truncate max-w-xs">
                      {entry.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEntryId(entry.id);
                            setIsVoucherOpen(true);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          <FileText size={13} strokeWidth={1.75} />
                          Lihat
                        </Button>
                        {entry.source_type === 'sale' && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmEntry(entry)}
                            aria-label={`Hapus transaksi ${entry.entry_no}`}
                            title="Hapus transaksi penjualan ini"
                            className="p-1.5 text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-line bg-muted/40 flex justify-between items-center gap-3 shrink-0">
            <span className="text-xs text-dim tnum">
              Menampilkan {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filteredEntries.length)} dari{' '}
              {filteredEntries.length} entri
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      <JournalVoucher
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        entryId={selectedEntryId}
      />

      <ManualJournalModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSaved={fetchEntries}
      />

      {deleteConfirmEntry && (
        <ConfirmModal
          title="Hapus Transaksi Penjualan?"
          message={`Jurnal ${deleteConfirmEntry.entry_no} (${deleteConfirmEntry.description || 'Penjualan'}) beserta transaksi penjualan dan seluruh baris jurnal terkait akan dihapus permanen.`}
          confirmLabel="Ya, Hapus"
          variant="danger"
          loading={deleting}
          onConfirm={() => handleDeleteSale(deleteConfirmEntry)}
          onCancel={() => setDeleteConfirmEntry(null)}
        />
      )}
    </div>
  );
}
