import { useEffect, useState } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { getJournalDetail, JournalEntryWithLines } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface JournalVoucherProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: string | null;
}

export default function JournalVoucher({ isOpen, onClose, entryId }: JournalVoucherProps) {
  const [detail, setDetail] = useState<JournalEntryWithLines | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entryId) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [isOpen, entryId]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getJournalDetail(entryId!);
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalDebit = detail?.lines.reduce((sum, l) => sum + l.debit, 0) || 0;
  const totalCredit = detail?.lines.reduce((sum, l) => sum + l.credit, 0) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title="Voucher Jurnal"
      subtitle={detail ? detail.entry.entry_no : undefined}
      icon={Receipt}
      footer={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {loading ? (
        <div className="text-center py-14 text-dim flex flex-col items-center justify-center">
          <Loader2 className="animate-spin mb-2 text-primary" size={24} />
          <p className="text-xs">Memuat voucher jurnal...</p>
        </div>
      ) : detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs bg-muted/60 p-4 rounded-xl border border-line">
            <div>
              <div className="text-dim mb-0.5 font-medium">Tanggal</div>
              <div className="font-semibold text-heading text-sm tnum">
                {new Date(detail.entry.date).toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-dim mb-0.5 font-medium">Sumber</div>
              <div className="font-semibold text-heading text-sm capitalize">
                {detail.entry.source_type.replace('_', ' ')}
              </div>
            </div>
            <div className="col-span-2 pt-3 border-t border-line">
              <div className="text-dim mb-0.5 font-medium">Keterangan</div>
              <div className="font-medium text-heading text-sm">{detail.entry.description || '-'}</div>
            </div>
          </div>

          <div className="border border-line rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-xs text-dim bg-muted/60 font-semibold border-b border-line">
                  <tr>
                    <th className="px-4 py-2.5">Akun</th>
                    <th className="px-4 py-2.5">Catatan</th>
                    <th className="px-4 py-2.5 text-right">Debit (Rp)</th>
                    <th className="px-4 py-2.5 text-right">Kredit (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {detail.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-muted/40 bg-card">
                      <td className="px-4 py-2.5 font-medium text-heading">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-dim">{line.account_code}</span>
                          <span>{line.account_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-body">{line.notes || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-heading tnum whitespace-nowrap">
                        {line.debit > 0 ? line.debit.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-heading tnum whitespace-nowrap">
                        {line.credit > 0 ? line.credit.toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/60 font-bold border-t border-line">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-right text-body">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right text-heading tnum whitespace-nowrap">
                      Rp {totalDebit.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-heading tnum whitespace-nowrap">
                      Rp {totalCredit.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {detail.entry.source_type === 'sale' && (
            <p className="text-xs text-dim">
              Mencakup pasangan jurnal Kas/Pendapatan dan HPP/Persediaan.
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-dim text-sm">Gagal memuat voucher jurnal.</div>
      )}
    </Modal>
  );
}
