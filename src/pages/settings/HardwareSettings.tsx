import { useState, useEffect } from 'react';
import { Printer, RefreshCw, CheckCircle2, Cpu, Barcode, Sliders, Play, X, Check, Monitor, WifiOff, AlertTriangle, Network, Server, Banknote, Plug } from 'lucide-react';
import { getSettings, setSetting, listPrinters, kickCashDrawer, printRawReceipt, DetectedPrinterInfo, getLanStatus, LanStatus, setCachedPrinterName } from '../../lib/api';
import { EscPosBuilder } from '../../lib/escpos';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

export default function HardwareSettings() {
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [lanStatus, setLanStatus] = useState<LanStatus | null>(null);
  const [isTestingLan, setIsTestingLan] = useState(false);

  // Hardware config state (mirrored from DB via get_settings)
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [selectedPrinterPort, setSelectedPrinterPort] = useState('');
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [printerCharsPerLine, setPrinterCharsPerLine] = useState(32);
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(true);
  const [autoCutPaper, setAutoCutPaper] = useState(true);
  const [enableBarcodeSound, setEnableBarcodeSound] = useState(true);
  const [customerDisplay, setCustomerDisplay] = useState(false);

  // Template config state
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Live detected printers from Windows OS via Tauri invoke
  const [detectedPrinters, setDetectedPrinters] = useState<DetectedPrinterInfo[]>([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printersError, setPrintersError] = useState('');

  useEffect(() => {
    loadHardwareSettings();
    detectPrinters();
  }, []);

  const loadHardwareSettings = async () => {
    try {
      const data = await getSettings();
      const pName = data.find(s => s.key === 'printer_name')?.value;
      const pPort = data.find(s => s.key === 'printer_port')?.value;
      const pWidth = data.find(s => s.key === 'printer_width')?.value;
      const pChars = data.find(s => s.key === 'printer_chars_per_line')?.value;
      const pDrawer = data.find(s => s.key === 'drawer_auto_open')?.value;
      const pCut = data.find(s => s.key === 'printer_autocut')?.value;
      const pBip = data.find(s => s.key === 'barcode_sound')?.value;
      const pDisp = data.find(s => s.key === 'customer_display')?.value;

      const rHeader = data.find(s => s.key === 'receipt_header')?.value;
      const rAddress = data.find(s => s.key === 'receipt_address')?.value;
      const rFooter = data.find(s => s.key === 'receipt_footer')?.value;

      if (pName) {
        setSelectedPrinter(pName);
        setCachedPrinterName(pName);
      }
      if (pPort) setSelectedPrinterPort(pPort);
      if (pWidth === '58mm' || pWidth === '80mm') {
        setPaperWidth(pWidth);
        if (!pChars) setPrinterCharsPerLine(pWidth === '80mm' ? 48 : 32);
      }
      if (pChars) setPrinterCharsPerLine(parseInt(pChars, 10));
      if (pDrawer !== undefined) setAutoOpenDrawer(pDrawer === 'true');
      if (pCut !== undefined) setAutoCutPaper(pCut === 'true');
      if (pBip !== undefined) setEnableBarcodeSound(pBip === 'true');
      if (pDisp !== undefined) setCustomerDisplay(pDisp === 'true');

      if (rHeader) setReceiptHeader(rHeader);
      if (rAddress) setReceiptAddress(rAddress);
      if (rFooter) setReceiptFooter(rFooter);
    } catch (e) {
      console.error('Failed to load hardware settings:', e);
    }
  };

  const detectPrinters = async () => {
    setPrintersLoading(true);
    setPrintersError('');
    try {
      const [printers, lan] = await Promise.all([
        listPrinters().catch(() => []),
        getLanStatus().catch(() => null),
      ]);

      setLanStatus(lan);

      const allPrinters = [...printers];

      if (lan?.paired_parent_ip || lan?.role === 'child') {
        const lanPrinterName = `[LAN] Printer & Laci Server Induk (${lan.paired_parent_name || lan.paired_parent_ip || 'Server'})`;
        const exists = allPrinters.some(p => p.Name.startsWith('[LAN]'));
        if (!exists) {
          allPrinters.unshift({
            Name: lanPrinterName,
            DriverName: 'LAN Remote Spooler',
            PortName: 'LAN:3699',
            Default: false,
            PrinterStatus: 0,
          });
        }
      }

      setDetectedPrinters(allPrinters);

      if (!selectedPrinter && allPrinters.length > 0) {
        const defaultPrinter = allPrinters.find(p => p.Default) ?? allPrinters[0];
        setSelectedPrinter(defaultPrinter.Name);
        setSelectedPrinterPort(defaultPrinter.PortName);
      }
    } catch (e: any) {
      console.error('Printer detection failed:', e);
      setPrintersError(`Gagal mendeteksi printer: ${e?.message || String(e)}`);
    } finally {
      setPrintersLoading(false);
    }
  };

  const handlePrinterChange = (printerName: string) => {
    setSelectedPrinter(printerName);
    const printer = detectedPrinters.find(p => p.Name === printerName);
    if (printer) setSelectedPrinterPort(printer.PortName);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await setSetting('printer_name', selectedPrinter);
      setCachedPrinterName(selectedPrinter);
      await setSetting('printer_port', selectedPrinterPort);
      await setSetting('printer_width', paperWidth);
      await setSetting('printer_chars_per_line', String(printerCharsPerLine));
      await setSetting('drawer_auto_open', String(autoOpenDrawer));
      await setSetting('printer_autocut', String(autoCutPaper));
      await setSetting('barcode_sound', String(enableBarcodeSound));
      await setSetting('customer_display', String(customerDisplay));

      await setSetting('receipt_header', receiptHeader);
      await setSetting('receipt_address', receiptAddress);
      await setSetting('receipt_footer', receiptFooter);

      setSuccessMsg('Konfigurasi printer tersimpan.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setErrorMsg(`Gagal menyimpan: ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      setErrorMsg('Pilih printer terlebih dahulu.');
      return;
    }
    setDrawerLoading(true);
    setErrorMsg('');
    try {
      const builder = new EscPosBuilder();

      builder.align('left');
      builder.bold(true).textLine(receiptHeader || 'KIVO ERP').bold(false);
      if (receiptAddress) builder.textLine(receiptAddress);
      builder.feed(1);

      builder.drawLine(printerCharsPerLine, '-');
      builder.leftRight('1x ITEM UJI COBA A', '15.000', printerCharsPerLine);
      builder.leftRight('2x ITEM UJI COBA B', '30.000', printerCharsPerLine);
      builder.drawLine(printerCharsPerLine, '-');

      builder.bold(true);
      builder.leftRight('TOTAL:', 'Rp 45.000', printerCharsPerLine);
      builder.bold(false);
      builder.leftRight('TUNAI:', 'Rp 50.000', printerCharsPerLine);
      builder.bold(true);
      builder.leftRight('KEMBALI:', 'Rp 5.000', printerCharsPerLine);
      builder.bold(false);
      builder.drawLine(printerCharsPerLine, '-');

      if (receiptFooter) builder.textLine(receiptFooter);
      builder.textLine('PRINTER THERMAL TERHUBUNG');
      builder.textLine('Kivo POS & Business Platform');
      builder.feed(5);

      if (autoCutPaper) builder.cut();

      await printRawReceipt(selectedPrinter, builder.build());
      setSuccessMsg('Struk uji coba dikirim ke printer.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setErrorMsg(`Gagal mencetak: ${e?.message || String(e)}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleTestDrawer = async () => {
    if (!selectedPrinter) {
      setErrorMsg('Pilih printer terlebih dahulu sebelum menguji laci uang.');
      return;
    }
    setDrawerLoading(true);
    setErrorMsg('');
    try {
      const msg = await kickCashDrawer(selectedPrinter);
      setSuccessMsg(`Laci Uang: ${msg}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setErrorMsg(`Gagal membuka laci: ${e?.message || String(e)}. Pastikan kabel RJ11 terhubung ke printer.`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const printerStatusLabel = (status: number) => {
    if (status === 0 || status === undefined) return { label: 'Siap', tone: 'success' as const };
    if (status === 1) return { label: 'Mencetak', tone: 'info' as const };
    if (status === 4) return { label: 'Offline', tone: 'danger' as const };
    if (status === 8) return { label: 'Berhenti', tone: 'warning' as const };
    return { label: 'Siap', tone: 'success' as const };
  };

  return (
    <div className="space-y-4 animate-fade-in w-full">
      {/* Success / Error Banners */}
      {successMsg && (
        <div className="px-4 py-3 bg-success-soft border border-success/30 text-success rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            aria-label="Tutup pesan"
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="px-4 py-3 bg-danger-soft border border-danger/30 text-danger rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Tutup pesan"
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* Left Column: Printer Configuration (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card rounded-xl border border-line p-5 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                  <Printer size={16} strokeWidth={1.75} />
                </div>
                <h2 className="text-sm font-bold text-heading">Printer Thermal Kasir</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectPrinters}
                disabled={printersLoading}
              >
                <RefreshCw size={13} className={printersLoading ? 'animate-spin' : ''} />
                <span>{printersLoading ? 'Memindai...' : 'Pindai'}</span>
              </Button>
            </div>

            {/* Printer selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-heading">
                Printer Utama
              </label>
              {printersError ? (
                <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" /> {printersError}
                </div>
              ) : detectedPrinters.length === 0 && !printersLoading ? (
                <div className="p-3 bg-muted/50 border border-line rounded-lg text-xs text-dim flex items-center gap-2">
                  <WifiOff size={14} className="shrink-0" /> Tidak ada printer terdeteksi. Klik Pindai.
                </div>
              ) : (
                <Select
                  value={selectedPrinter}
                  onChange={v => handlePrinterChange(v)}
                  disabled={printersLoading || detectedPrinters.length === 0}
                  className="w-full"
                >
                  {detectedPrinters.map((p, idx) => (
                    <option key={idx} value={p.Name}>
                      {p.Name}{p.Default ? ' (Default)' : ''} | {p.PortName}
                    </option>
                  ))}
                </Select>
              )}

              {selectedPrinterPort && (
                <p className="text-xs text-dim">
                  Port aktif: <span className="font-mono font-semibold text-heading">{selectedPrinterPort}</span>
                </p>
              )}
            </div>

            {/* Paper Size Selector */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-heading mb-2">
                  Ukuran Kertas
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setPaperWidth('80mm'); setPrinterCharsPerLine(48); }}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      paperWidth === '80mm'
                        ? 'bg-primary-soft/70 border-primary text-primary'
                        : 'bg-card border-line text-body hover:border-line-strong hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-bold">80 mm</p>
                    <p className="text-xs text-dim mt-0.5">Standar kasir (48 karakter)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaperWidth('58mm'); setPrinterCharsPerLine(32); }}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      paperWidth === '58mm'
                        ? 'bg-primary-soft/70 border-primary text-primary'
                        : 'bg-card border-line text-body hover:border-line-strong hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-bold">58 mm</p>
                    <p className="text-xs text-dim mt-0.5">Mini / portabel (32 karakter)</p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-heading">
                    Lebar Cetak (Karakter per Baris)
                  </label>
                  <span className="text-xs font-bold tnum px-2 py-0.5 rounded-md bg-muted border border-line text-heading">
                    {printerCharsPerLine}
                  </span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="64"
                  value={printerCharsPerLine}
                  onChange={(e) => setPrinterCharsPerLine(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[11px] text-dim mt-1">
                  Kurangi nilai jika teks struk terpotong di tepi kanan.
                </p>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="divide-y divide-line border-t border-line">
              {[
                { label: 'Auto-Cut Kertas', desc: 'Potong kertas otomatis setelah cetak', val: autoCutPaper, set: setAutoCutPaper },
                { label: 'Buka Laci Uang Otomatis', desc: 'Kirim pulsa RJ11 saat pembayaran tunai', val: autoOpenDrawer, set: setAutoOpenDrawer },
                { label: 'Suara Beep Barcode', desc: 'Bunyi konfirmasi saat scan berhasil', val: enableBarcodeSound, set: setEnableBarcodeSound },
              ].map(({ label, desc, val, set }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-heading">{label}</p>
                    <p className="text-xs text-dim">{desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={val}
                    aria-label={label}
                    onClick={() => set(!val)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-card ${
                      val ? 'bg-primary' : 'bg-line-strong'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card transition-transform ${
                        val ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleTestPrint}
                disabled={drawerLoading || !selectedPrinter}
              >
                <Play size={14} /> Uji Cetak Struk
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSaveSettings}
                loading={saving}
              >
                {!saving && <Check size={15} />}
                <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
              </Button>
            </div>
          </div>

          {/* Receipt Template Editor */}
          <div className="bg-card rounded-xl border border-line p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                <Printer size={16} strokeWidth={1.75} />
              </div>
              <h3 className="font-bold text-heading text-sm">Template Struk (ESC/POS)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-heading mb-1.5">Header (Nama Toko)</label>
                <input
                  type="text"
                  value={receiptHeader}
                  onChange={e => setReceiptHeader(e.target.value)}
                  placeholder="KIVO MART"
                  className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-heading mb-1.5">Alamat Toko</label>
                <input
                  type="text"
                  value={receiptAddress}
                  onChange={e => setReceiptAddress(e.target.value)}
                  placeholder="Jl. Sudirman No. 123"
                  className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-heading mb-1.5">Footer (Pesan Bawah)</label>
                <input
                  type="text"
                  value={receiptFooter}
                  onChange={e => setReceiptFooter(e.target.value)}
                  placeholder="Terima kasih atas kunjungan Anda"
                  className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detected Printers + LAN + Accessories (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Detected Printers */}
          <div className="bg-card rounded-xl border border-line p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                  <Cpu size={16} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-heading text-sm">Perangkat Terdeteksi</h3>
                  <p className="text-xs text-dim tnum">
                    {printersLoading ? 'Memindai...' : `${detectedPrinters.length} printer di sistem`}
                  </p>
                </div>
              </div>
            </div>

            {printersLoading ? (
              <div className="py-8 flex flex-col items-center gap-2 text-dim">
                <RefreshCw size={20} className="animate-spin text-primary" />
                <p className="text-xs">Memindai printer Windows...</p>
              </div>
            ) : detectedPrinters.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-dim text-center">
                <WifiOff size={20} />
                <p className="text-xs font-medium text-heading">Tidak ada printer terdeteksi</p>
                <p className="text-xs text-dim">Pastikan printer terhubung dan driver terpasang.</p>
                <Button type="button" variant="outline" size="sm" onClick={detectPrinters} className="mt-1">
                  Coba Lagi
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {detectedPrinters.map((printer, idx) => {
                  const { label, tone } = printerStatusLabel(printer.PrinterStatus);
                  const isSelected = printer.Name === selectedPrinter;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePrinterChange(printer.Name)}
                      className={`w-full p-3 rounded-lg border flex items-center justify-between gap-2 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected
                          ? 'bg-primary-soft/60 border-primary/40'
                          : 'bg-muted/40 border-line hover:border-line-strong'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs font-semibold truncate ${isSelected ? 'text-primary' : 'text-heading'}`}>
                            {printer.Name}
                          </p>
                          {printer.Default && (
                            <span className="text-[10px] font-semibold bg-muted text-dim px-1.5 py-0.5 rounded-md">
                              Default
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] font-semibold bg-primary-soft text-primary px-1.5 py-0.5 rounded-md">
                              Dipilih
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-dim font-mono mt-0.5 truncate">{printer.PortName}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-md ${
                        tone === 'success' ? 'text-success bg-success-soft' :
                        tone === 'info' ? 'text-info bg-info-soft' :
                        tone === 'danger' ? 'text-danger bg-danger-soft' :
                        'text-warning bg-warning-soft'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          tone === 'success' ? 'bg-success' :
                          tone === 'info' ? 'bg-info' :
                          tone === 'danger' ? 'bg-danger' : 'bg-warning'
                        }`} />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Perangkat Hardware Jaringan Lokal (LAN) */}
          <div className="bg-card rounded-xl border border-line p-5 space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                <Network size={16} strokeWidth={1.75} />
              </div>
              <h3 className="font-bold text-heading text-sm">Printer & Laci LAN</h3>
            </div>

            {lanStatus?.paired_parent_ip ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg border border-line flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                      <Server size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-heading truncate">
                        {lanStatus.paired_parent_name || 'Server Induk'}
                      </p>
                      <p className="text-[11px] text-dim font-mono truncate">
                        {lanStatus.paired_parent_ip}:{lanStatus.paired_parent_port || 3699}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Terhubung
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsTestingLan(true);
                      try {
                        const msg = await kickCashDrawer(`[LAN] ${lanStatus.paired_parent_ip}`);
                        setSuccessMsg(`LAN Laci: ${msg}`);
                        setTimeout(() => setSuccessMsg(''), 4000);
                      } catch (err: any) {
                        setErrorMsg(`Gagal buka laci via LAN: ${err?.message || err}`);
                      } finally {
                        setIsTestingLan(false);
                      }
                    }}
                    disabled={isTestingLan}
                  >
                    <Plug size={13} /> Uji Laci LAN
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setIsTestingLan(true);
                      try {
                        const builder = new EscPosBuilder();
                        builder.align('center');
                        builder.bold(true).textLine('KIVO - LAN TEST').bold(false);
                        builder.textLine('Uji coba cetak struk via LAN');
                        builder.textLine('Terminal Kasir Anak -> Server Induk');
                        builder.feed(3);
                        if (autoCutPaper) builder.cut();

                        await printRawReceipt(`[LAN] ${lanStatus.paired_parent_ip}`, builder.build());
                        setSuccessMsg('Struk uji coba dikirim ke printer Server Induk.');
                        setTimeout(() => setSuccessMsg(''), 4000);
                      } catch (err: any) {
                        setErrorMsg(`Gagal cetak via LAN: ${err?.message || err}`);
                      } finally {
                        setIsTestingLan(false);
                      }
                    }}
                    disabled={isTestingLan}
                  >
                    <Play size={13} /> Uji Cetak LAN
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted/40 rounded-lg border border-line text-center space-y-1.5">
                <Network size={20} className="mx-auto text-dim" />
                <p className="text-xs text-body">
                  {lanStatus?.role === 'parent'
                    ? 'Perangkat ini adalah Server Induk dan siap menerima cetak dari klien LAN.'
                    : 'Belum terhubung ke Server Induk. Hubungkan melalui tab Jaringan Lokal (LAN).'}
                </p>
              </div>
            )}
          </div>

          {/* POS Hardware Accessories */}
          <div className="bg-card rounded-xl border border-line p-5 space-y-3.5">
            <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                <Sliders size={16} strokeWidth={1.75} />
              </div>
              <h3 className="font-bold text-heading text-sm">Aksesori Kasir</h3>
            </div>

            <div className="space-y-2.5">
              {/* Barcode scanner */}
              <div className="p-3 bg-muted/40 rounded-lg border border-line flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-card border border-line text-heading flex items-center justify-center shrink-0">
                    <Barcode size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-heading">Barcode Scanner</p>
                    <p className="text-[11px] text-dim truncate">USB HID / Bluetooth</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-md shrink-0">
                  Otomatis
                </span>
              </div>

              {/* Cash Drawer RJ11 */}
              <div className="p-3 bg-muted/40 rounded-lg border border-line flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-card border border-line text-heading flex items-center justify-center shrink-0">
                    <Banknote size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-heading">Laci Uang (RJ11)</p>
                    <p className="text-[11px] text-dim truncate">
                      {selectedPrinter || 'Printer belum dipilih'} · <span className="font-mono">Alt+C</span>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestDrawer}
                  disabled={drawerLoading || !selectedPrinter}
                >
                  {drawerLoading ? 'Mengirim...' : 'Tes (F2)'}
                </Button>
              </div>

              {/* Customer Display */}
              <div className="p-3 bg-muted/40 rounded-lg border border-line flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-card border border-line text-heading flex items-center justify-center shrink-0">
                    <Monitor size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-heading">Customer Display</p>
                    <p className="text-[11px] text-dim truncate">Layar kedua pelanggan</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={customerDisplay}
                  aria-label="Customer Display"
                  onClick={() => setCustomerDisplay(!customerDisplay)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    customerDisplay ? 'bg-primary' : 'bg-line-strong'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card transition-transform ${
                      customerDisplay ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
