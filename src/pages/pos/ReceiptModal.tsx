import { Printer, CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getSaleDetail, SaleDetail, getSettings, printRawReceipt } from '../../lib/api';
import { EscPosBuilder } from '../../lib/escpos';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface ReceiptModalProps {
    saleId: string;
    onClose: () => void;
}

function generateReceiptBytes(data: SaleDetail, settings: { key: string; value: string }[]): number[] {
    const pWidth = settings.find(s => s.key === 'printer_width')?.value || '80mm';
    const pChars = settings.find(s => s.key === 'printer_chars_per_line')?.value;
    const rHeader = settings.find(s => s.key === 'receipt_header')?.value || 'KIVO ERP';
    const rAddress = settings.find(s => s.key === 'receipt_address')?.value || '';
    const rFooter = settings.find(s => s.key === 'receipt_footer')?.value || 'Terima kasih atas kunjungan Anda!';
    const pCut = settings.find(s => s.key === 'printer_autocut')?.value !== 'false';

    let width = pWidth === '58mm' ? 32 : 48;
    if (pChars) {
        const parsed = parseInt(pChars, 10);
        if (!isNaN(parsed) && parsed > 0) width = parsed;
    }
    
    const builder = new EscPosBuilder();
    builder.kickDrawer();
    builder.align('left');
    builder.bold(true).textLine(rHeader).bold(false);
    if (rAddress) builder.textLine(rAddress);
    builder.feed(1);

    let dateFormatted = '-';
    try {
        if (data.sale?.created_at) {
            const dt = new Date(data.sale.created_at.replace(' ', 'T'));
            dateFormatted = isNaN(dt.getTime()) ? data.sale.created_at : dt.toLocaleString('id-ID');
        }
    } catch {
        dateFormatted = data.sale?.created_at || '-';
    }

    builder.leftRight(`No: ${data.sale?.transaction_no || '-'}`, dateFormatted, width);
    const cashierName = data.cashier_name || 'Kasir';
    const priceTypeLabel = data.sale?.price_type === 'wholesale' ? 'Grosir' : 'Eceran';
    builder.leftRight(`Kasir: ${cashierName}`, `Tipe: ${priceTypeLabel}`, width);
    builder.feed(1);

    builder.drawLine(width, '-');
    if (data.lines && data.lines.length > 0) {
        data.lines.forEach(line => {
            const itemName = line.item_name || 'Produk';
            builder.bold(true).textLine(itemName).bold(false);
            
            const qty = line.qty || 1;
            const unit = line.unit_name || 'Pcs';
            const price = line.price || 0;
            const lineSubtotal = line.subtotal || (qty * price - (line.discount_amount || 0));

            builder.leftRight(`  ${qty} ${unit} x ${price.toLocaleString('id-ID')}`, lineSubtotal.toLocaleString('id-ID'), width);

            if (line.discount_amount && line.discount_amount > 0) {
                builder.leftRight(`  (Diskon Item)`, `-${line.discount_amount.toLocaleString('id-ID')}`, width);
            }
        });
    }
    builder.drawLine(width, '-');

    const totalAmount = Math.round(data.sale?.total_amount ?? 0);
    builder.leftRight('Subtotal:', `Rp ${totalAmount.toLocaleString('id-ID')}`, width);

    if (data.sale?.discount_amount && data.sale.discount_amount > 0) {
        builder.leftRight('Diskon Total:', `-Rp ${Math.round(data.sale.discount_amount).toLocaleString('id-ID')}`, width);
    }

    if (data.sale?.tax_amount && data.sale.tax_amount > 0) {
        builder.leftRight('Pajak:', `Rp ${Math.round(data.sale.tax_amount).toLocaleString('id-ID')}`, width);
    }

    const grandTotal = Math.round(data.sale?.grand_total ?? 0);
    builder.bold(true);
    builder.leftRight('TOTAL:', `Rp ${grandTotal.toLocaleString('id-ID')}`, width);
    builder.bold(false);
    builder.drawLine(width, '-');

    if (data.payments && data.payments.length > 0) {
        data.payments.forEach(p => {
            builder.leftRight(`${(p.method || 'TUNAI').toUpperCase()}:`, `Rp ${Math.round(p.amount ?? 0).toLocaleString('id-ID')}`, width);
        });

        const totalPaid = data.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (totalPaid > grandTotal) {
            builder.bold(true);
            builder.leftRight('KEMBALI:', `Rp ${Math.round(totalPaid - grandTotal).toLocaleString('id-ID')}`, width);
            builder.bold(false);
        }
    } else {
        builder.leftRight('BAYAR (TUNAI):', `Rp ${grandTotal.toLocaleString('id-ID')}`, width);
    }
    builder.drawLine(width, '-');

    builder.feed(1);
    if (rFooter) builder.textLine(rFooter);
    builder.textLine('Kivo POS & Business Platform');
    builder.feed(5);

    if (pCut) builder.cut();
    return builder.build();
}

export default function ReceiptModal({ saleId, onClose }: ReceiptModalProps) {
    const [detail, setDetail] = useState<SaleDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
    const [printMsg, setPrintMsg] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const hasPrinted = useRef(false);

    useEffect(() => {
        setLoadingDetail(true);
        getSaleDetail(saleId)
            .then(res => {
                setDetail(res);
                setLoadingDetail(false);
            })
            .catch(err => {
                console.error("Failed to load sale details:", err);
                setPrintStatus('error');
                setPrintMsg('Gagal memuat rincian transaksi: ' + (err?.message || String(err)));
                setLoadingDetail(false);
            });
    }, [saleId]);

    const printReceipt = useCallback(async (data: SaleDetail) => {
        setPrintStatus('printing');
        setPrintMsg('Menghubungi printer...');
        try {
            const settings = await getSettings();
            const pName = settings.find(s => s.key === 'printer_name')?.value;

            if (!pName) {
                setPrintStatus('error');
                setPrintMsg('Printer belum dipilih. Buka Pengaturan > Hardware untuk memilih printer default.');
                return;
            }

            const rawBytes = generateReceiptBytes(data, settings);
            await printRawReceipt(pName, rawBytes);
            setPrintStatus('success');
            setPrintMsg(`Struk berhasil dikirim ke printer (${pName})`);
            setTimeLeft(4);
        } catch (e: any) {
            console.error("Print receipt failed:", e);
            setPrintStatus('error');
            setPrintMsg(`Gagal mencetak struk: ${e?.message || String(e)}`);
        }
    }, []);

    useEffect(() => {
        if (!detail || hasPrinted.current) return;
        hasPrinted.current = true;
        printReceipt(detail);
    }, [detail, printReceipt]);

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onClose]);

    const handleManualPrint = () => {
        if (detail) {
            setTimeLeft(null);
            printReceipt(detail);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="md"
            title="Struk Transaksi"
            subtitle={detail?.sale?.transaction_no}
            icon={Printer}
            footer={
                <div className="flex items-center justify-between w-full gap-3">
                    <div>
                        {timeLeft !== null && printStatus === 'success' && (
                            <span className="text-xs text-dim tnum">
                                Menutup dalam <strong className="text-heading">{timeLeft}s</strong>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={onClose}>
                            Tutup
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            type="button"
                            onClick={handleManualPrint}
                            disabled={loadingDetail || printStatus === 'printing'}
                        >
                            <RefreshCw size={14} className={printStatus === 'printing' ? 'animate-spin' : ''} />
                            <span>Cetak Ulang</span>
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-3.5">
                {loadingDetail && printStatus === 'idle' && (
                    <div className="py-6 flex flex-col items-center justify-center gap-2">
                        <Loader2 size={22} className="animate-spin text-primary" />
                        <span className="text-xs text-dim">Memuat faktur...</span>
                    </div>
                )}

                {printStatus === 'printing' && (
                    <div className="p-3.5 rounded-xl bg-info-soft border border-info/25 flex items-center gap-3 text-info">
                        <Loader2 size={18} className="animate-spin shrink-0" />
                        <span className="text-xs font-semibold">{printMsg}</span>
                    </div>
                )}

                {printStatus === 'success' && (
                    <div className="p-3.5 rounded-xl bg-success-soft border border-success/25 flex items-center gap-3 text-success">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <div className="text-xs">
                            <p className="font-semibold">Struk Dicetak</p>
                            <p className="mt-0.5 opacity-90">{printMsg}</p>
                        </div>
                    </div>
                )}

                {printStatus === 'error' && (
                    <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/25 flex items-center gap-3 text-danger">
                        <AlertTriangle size={18} className="shrink-0" />
                        <div className="text-xs">
                            <p className="font-semibold">Gagal Mencetak</p>
                            <p className="mt-0.5 opacity-90">{printMsg}</p>
                        </div>
                    </div>
                )}

                {detail?.sale && (
                    <div className="bg-muted/60 p-3.5 rounded-xl border border-line space-y-2 text-xs">
                        <div className="flex justify-between text-dim border-b border-line pb-2">
                            <span className="font-mono font-semibold text-body">{detail.sale.transaction_no}</span>
                            <span className="tnum">
                                {new Date(detail.sale.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex justify-between font-bold text-heading pt-0.5">
                            <span>Total</span>
                            <span className="tnum">Rp {Math.round(detail.sale.grand_total).toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
