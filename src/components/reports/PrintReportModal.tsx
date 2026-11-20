import React, { useRef } from 'react';
import { Printer } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuthStore } from '../../store/AuthStore';

interface PrintColumn {
  header: string;
  accessor: (row: any, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  periodLabel?: string;
  filterDetails?: Array<{ label: string; value: string }>;
  columns: PrintColumn[];
  data: any[];
  summaryItems?: Array<{ label: string; value: string | number; isHighlight?: boolean }>;
}

export default function PrintReportModal({
  isOpen,
  onClose,
  title,
  subtitle = 'Format A4 / PDF',
  periodLabel,
  filterDetails,
  columns,
  data,
  summaryItems,
}: PrintReportModalProps) {
  const { user } = useAuthStore();
  const printContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      title="Pratinjau Cetak"
      subtitle={subtitle}
      icon={Printer}
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-xs text-dim tnum">{data.length} baris data</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Tutup
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handlePrint}>
              <Printer size={14} strokeWidth={1.75} />
              Cetak Dokumen
            </Button>
          </div>
        </div>
      }
    >
      <div
        ref={printContentRef}
        className="bg-card text-heading p-6 sm:p-8 rounded-xl border border-line print:border-0 print:p-0 font-sans text-xs"
      >
        {/* Document Header */}
        <div className="border-b border-line pb-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-heading">KIVO POS</h1>
              <p className="text-[11px] text-dim mt-0.5">
                Cabang: {user?.branch_id || 'branch_001'}
              </p>
            </div>

            <div className="text-right">
              <h2 className="text-sm font-bold text-heading">{title}</h2>
              {periodLabel && (
                <p className="text-xs font-semibold text-body mt-0.5 tnum">
                  Periode: {periodLabel}
                </p>
              )}
              <p className="text-[11px] text-dim mt-1">Dicetak: {currentDate}</p>
              <p className="text-[11px] text-dim">
                Oleh: {user?.name || user?.username || 'Administrator'}
              </p>
            </div>
          </div>

          {filterDetails && filterDetails.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-line text-[11px]">
              {filterDetails.map((f, i) => (
                <div key={i} className="text-body">
                  <strong className="text-heading">{f.label}:</strong> {f.value}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-dim">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    style={{ width: col.width }}
                    className={`py-2 px-2.5 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-8 text-center text-dim">
                    Tidak ada data pada periode ini.
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/40">
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={`py-2 px-2.5 text-heading text-[11px] tnum ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.accessor(row, rowIdx)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Box */}
        {summaryItems && summaryItems.length > 0 && (
          <div className="mt-5 pt-4 border-t border-line">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted p-4 rounded-xl border border-line">
              {summaryItems.map((item, idx) => (
                <div key={idx}>
                  <div className="text-[11px] font-medium text-dim">{item.label}</div>
                  <div
                    className={`text-sm mt-0.5 tnum ${
                      item.isHighlight ? 'text-heading font-bold' : 'text-body font-semibold'
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signatures Section */}
        <div className="mt-10 pt-6 border-t border-line grid grid-cols-3 text-center text-xs gap-4">
          <div>
            <p className="font-medium text-dim">Dibuat Oleh,</p>
            <div className="h-14" />
            <p className="font-semibold text-heading underline">
              ({user?.name || user?.username || 'Kasir / Staff'})
            </p>
            <p className="text-[11px] text-dim mt-0.5">Kasir / Operator</p>
          </div>

          <div>
            <p className="font-medium text-dim">Diperiksa Oleh,</p>
            <div className="h-14" />
            <p className="font-semibold text-heading underline">( ........................................ )</p>
            <p className="text-[11px] text-dim mt-0.5">Supervisor / Finance</p>
          </div>

          <div>
            <p className="font-medium text-dim">Disetujui Oleh,</p>
            <div className="h-14" />
            <p className="font-semibold text-heading underline">( ........................................ )</p>
            <p className="text-[11px] text-dim mt-0.5">Pemilik Toko</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
