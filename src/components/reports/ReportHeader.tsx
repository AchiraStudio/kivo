import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import Button from '../ui/Button';

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (val: string) => void;
  onDateToChange?: (val: string) => void;
  onFetch?: () => void;
  onExportCsv?: () => void;
  exportLabel?: string;
  children?: React.ReactNode;
}

export default function ReportHeader({
  title,
  subtitle,
  onBack,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onFetch,
  onExportCsv,
  exportLabel = 'Export CSV',
  children,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card px-4 py-3 rounded-xl border border-line shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onBack}
          aria-label="Kembali ke daftar laporan"
          title="Kembali ke daftar laporan"
          className="px-2 shrink-0"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </Button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-heading tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-dim mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {dateFrom !== undefined && onDateFromChange && (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              aria-label="Tanggal mulai"
              className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-xs text-dim">s/d</span>
          </>
        )}

        {dateTo !== undefined && onDateToChange && (
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            aria-label="Tanggal akhir"
            className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        )}

        {children}

        {onFetch && (
          <Button type="button" variant="primary" size="sm" onClick={onFetch}>
            Tampilkan
          </Button>
        )}

        {onExportCsv && (
          <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
            <Download size={14} strokeWidth={1.75} />
            {exportLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
