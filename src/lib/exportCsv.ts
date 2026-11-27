import { isMobilePlatform } from './runtime';
import { toast } from '../components/ui/Toast';

function buildCsv(headers: string[], rows: any[][]): string {
  return [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
}

/**
 * Saves a CSV report. Desktop and browsers download the file. Android's WebView cannot
 * handle blob downloads, so there we hand the file to the system share sheet when it is
 * available (WhatsApp, Drive, email...) and otherwise copy the CSV to the clipboard.
 */
export async function downloadCsv(filename: string, headers: string[], rows: any[][]): Promise<void> {
  const csvContent = buildCsv(headers, rows);

  if (isMobilePlatform()) {
    try {
      const file = new File([csvContent], filename, { type: 'text/csv' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(csvContent);
      toast.success('Laporan disalin', 'Data CSV ada di clipboard. Tempel di aplikasi lembar kerja.');
    } catch {
      toast.error('Gagal menyimpan laporan', 'Buka laporan ini dari komputer untuk mengunduh file.');
    }
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
