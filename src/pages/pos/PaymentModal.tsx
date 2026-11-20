// src/pages/pos/PaymentModal.tsx
import { useState, useEffect, useRef } from 'react';
import { PosLine } from './POSStore';
import { createSale, CreateSaleInput, invoke } from '../../lib/api';
import {
    Banknote, CreditCard, Smartphone, ArrowRightLeft,
    CheckCircle2, Ticket, ShoppingBag, Percent
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useAuthStore } from '../../store/AuthStore';
import { toast } from '../../components/ui/Toast';

interface PaymentModalProps {
    branchId: string;
    cart: PosLine[];
    total: number;
    priceType: string;
    customerId?: string;
    taxAmount: number;
    discountAmount: number;
    onClose: () => void;
    onSuccess: (saleId: string, print: boolean) => void;
}

interface Bank { id: string; name: string; code: string; }

const PAYMENT_METHODS = [
    { key: 'cash',      label: 'Tunai',    icon: Banknote },
    { key: 'transfer',  label: 'Transfer', icon: ArrowRightLeft },
    { key: 'debit',     label: 'Debit',    icon: CreditCard },
    { key: 'credit',    label: 'Kredit',   icon: CreditCard },
    { key: 'qris',      label: 'QRIS',     icon: Smartphone },
] as const;

type MethodKey = typeof PAYMENT_METHODS[number]['key'];

export default function PaymentModal({ branchId, cart, total, priceType, customerId, taxAmount, discountAmount, onClose, onSuccess }: PaymentModalProps) {
    const [adjustedTotalStr, setAdjustedTotalStr] = useState(total.toString());
    const lastResolvedTotal = useRef<number>(total);

    const [amounts, setAmounts] = useState<Record<MethodKey, string>>({
        cash: total.toString(), transfer: '', debit: '', credit: '', qris: ''
    });
    const lastResolvedAmounts = useRef<Record<MethodKey, number>>({
        cash: total, transfer: 0, debit: 0, credit: 0, qris: 0
    });

    const [activeMethod, setActiveMethod] = useState<MethodKey>('cash');
    const [bankIds, setBankIds] = useState<Record<string, string>>({ debit: '', credit: '', transfer: '' });
    const [banks, setBanks] = useState<Bank[]>([]);
    const [voucher, setVoucher] = useState('');
    const [manualDiscountStr, setManualDiscountStr] = useState('');
    const [loading, setLoading] = useState(false);
    const amountInputRef = useRef<HTMLInputElement>(null);
    const { user } = useAuthStore();

    // Parse manual discount: supports "5000" (fixed Rp) or "10%" (percent of total)
    const parseManualDiscount = (str: string, baseTotal: number): number => {
        const trimmed = str.trim();
        if (!trimmed) return 0;
        if (trimmed.endsWith('%')) {
            const pct = parseFloat(trimmed);
            return isNaN(pct) ? 0 : Math.round(baseTotal * Math.min(pct, 100) / 100);
        }
        const val = parseFloat(trimmed);
        return isNaN(val) ? 0 : Math.max(0, val);
    };

    const evaluateValue = (str: string, base: number): number => {
        const trimmed = str.trim();
        if (!trimmed) return 0;
        if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
            const val = parseFloat(trimmed);
            return isNaN(val) ? base : Math.max(0, base + val);
        }
        if (/[+-]/.test(trimmed)) {
            try {
                const tokens = trimmed.match(/([+-]?\d+(\.\d+)?)/g);
                if (tokens) {
                    return Math.max(0, tokens.reduce((sum, t) => sum + (parseFloat(t) || 0), 0));
                }
            } catch {}
        }
        const val = parseFloat(trimmed);
        return isNaN(val) ? 0 : val;
    };

    const totalBayar = PAYMENT_METHODS.reduce((sum, m) => sum + evaluateValue(amounts[m.key], lastResolvedAmounts.current[m.key]), 0);
    const resolvedTotal = evaluateValue(adjustedTotalStr, total);
    const manualDiscountAmt = parseManualDiscount(manualDiscountStr, resolvedTotal);
    // Combined discount = promo discounts (passed in as discountAmount) + manual input discount
    const totalDiscountAmt = discountAmount + manualDiscountAmt;
    // Net total after all discounts
    const netTotal = Math.max(0, resolvedTotal - manualDiscountAmt);
    const kembali = totalBayar - netTotal;
    const isReady = totalBayar >= netTotal;

    const evaluateMethodAmount = (method: MethodKey) => {
        const resolved = evaluateValue(amounts[method], lastResolvedAmounts.current[method]);
        lastResolvedAmounts.current[method] = resolved;
        setAmounts(prev => ({ ...prev, [method]: resolved === 0 ? '' : resolved.toString() }));
    };

    const evaluateTotal = () => {
        const resolved = evaluateValue(adjustedTotalStr, total);
        lastResolvedTotal.current = resolved;
        setAdjustedTotalStr(resolved.toString());
    };

    useEffect(() => {
        // Load banks from DB
        invoke<Bank[]>('get_banks').then(setBanks).catch(() => {});
        // Focus active input
        setTimeout(() => amountInputRef.current?.focus(), 150);
    }, []);

    useEffect(() => {
        // Focus input when active method changes
        amountInputRef.current?.focus();
    }, [activeMethod]);

    const keysPressed = useRef<Set<string>>(new Set());

    // Keyboard shortcut: End = Simpan, c+End / Ctrl+End = Simpan & Cetak, ESC = close
    useEffect(() => {
        const downHandler = (e: KeyboardEvent) => {
            keysPressed.current.add(e.key.toLowerCase());
            if (e.key === 'End' && isReady && !loading) {
                e.preventDefault();
                const isCetak = e.ctrlKey || e.altKey || keysPressed.current.has('c');
                handlePay(isCetak);
            }
            if (e.key === 'Escape') onClose();
        };
        const upHandler = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase());
        };
        window.addEventListener('keydown', downHandler);
        window.addEventListener('keyup', upHandler);
        return () => {
            window.removeEventListener('keydown', downHandler);
            window.removeEventListener('keyup', upHandler);
        };
    }, [isReady, loading, amounts, bankIds, voucher, resolvedTotal]);

    const setAmount = (method: MethodKey, val: string) => {
        const cleanVal = typeof val === 'string' ? val.replace(/[a-zA-Z]/g, '') : val;
        setAmounts(prev => ({ ...prev, [method]: cleanVal }));
    };

    const handleExact = () => {
        const nonActive = PAYMENT_METHODS
            .filter(m => m.key !== activeMethod)
            .reduce((sum, m) => sum + evaluateValue(amounts[m.key], lastResolvedAmounts.current[m.key]), 0);
        const remaining = Math.max(0, resolvedTotal - nonActive);
        lastResolvedAmounts.current[activeMethod] = remaining;
        setAmount(activeMethod, remaining > 0 ? remaining.toString() : '');
    };

    const handleQuickCash = (value: number, type: 'add' | 'set') => {
        const currentVal = lastResolvedAmounts.current[activeMethod];
        const resolved = type === 'add' ? currentVal + value : value;
        lastResolvedAmounts.current[activeMethod] = resolved;
        setAmount(activeMethod, resolved.toString());
    };

    const handleSelectMethod = (methodKey: MethodKey) => {
        if (methodKey === activeMethod) return;

        const filledMethods = PAYMENT_METHODS.filter(
            m => evaluateValue(amounts[m.key], lastResolvedAmounts.current[m.key]) > 0
        );

        // If only 1 method (e.g. the default cash) was filled, transfer the amount to the new method
        if (filledMethods.length <= 1) {
            const currentTotal = netTotal > 0 ? netTotal : total;
            setAmounts({
                cash: '', transfer: '', debit: '', credit: '', qris: '',
                [methodKey]: currentTotal.toString(),
            });
            lastResolvedAmounts.current = {
                cash: 0, transfer: 0, debit: 0, credit: 0, qris: 0,
                [methodKey]: currentTotal,
            };
        }
        setActiveMethod(methodKey);
    };

    const handleClear = () => {
        lastResolvedAmounts.current[activeMethod] = 0;
        setAmount(activeMethod, '');
    };

    const handlePay = async (print: boolean) => {
        if (!isReady || loading) return;
        setLoading(true);

        const payments = PAYMENT_METHODS
            .filter(m => evaluateValue(amounts[m.key], lastResolvedAmounts.current[m.key]) > 0)
            .map(m => ({
                amount: evaluateValue(amounts[m.key], lastResolvedAmounts.current[m.key]),
                method: m.key,
                reference: bankIds[m.key] || undefined,
            }));

        const totalAmount = cart.reduce((s, l) => s + l.qty * l.price, 0);

        const input: CreateSaleInput = {
            branch_id: branchId || 'branch_001',
            customer_id: customerId?.trim() ? customerId : undefined,
            user_id: user?.id?.trim() ? user.id : undefined,
            total_amount: totalAmount,
            discount_amount: totalDiscountAmt,
            tax_amount: taxAmount,
            grand_total: netTotal,
            price_type: priceType,
            lines: cart.map(l => ({
                item_id: l.item_id,
                unit_id: l.unit_id,
                qty: l.qty,
                price_type: l.price_type,
                price: l.price,
                discount_amount: l.discount_amount,
                hpp_value: l.hpp_value,
            })),
            payments,
            notes: voucher ? `VOUCHER: ${voucher}` : undefined,
        };

        try {
            const saleId = await createSale(input);
            window.dispatchEvent(new CustomEvent('kivo:sync', { detail: { table: 'sales', source: 'local_sale', saleId } }));
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('kivo_sync_channel');
                bc.postMessage({ table: 'sales', source: 'local_sale', saleId });
                bc.close();
            }
            onSuccess(saleId, print);
        } catch (e) {
            toast.error('Pembayaran gagal: ' + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="5xl"
            title="Pembayaran"
            noPadding={true}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                    <Button
                        variant="outline"
                        size="md"
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Batal
                    </Button>
                    <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
                        <Button
                            variant="secondary"
                            size="md"
                            type="button"
                            onClick={() => handlePay(false)}
                            disabled={!isReady || loading}
                            className="flex-1 sm:flex-none"
                        >
                            <span>Simpan</span>
                            <kbd className="hidden sm:inline font-mono text-[11px] text-dim">(End)</kbd>
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            type="button"
                            onClick={() => handlePay(true)}
                            disabled={!isReady}
                            loading={loading}
                            className="flex-1 sm:flex-none"
                        >
                            <span>{loading ? 'Memproses...' : 'Simpan & Cetak'}</span>
                            {!loading && <kbd className="hidden sm:inline font-mono text-[11px] opacity-80">(c+End)</kbd>}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="p-3.5 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-5">
                {/* Left Column: Payment Methods & Inputs */}
                <div className="lg:col-span-7 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-dim block mb-2">Metode Pembayaran</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {PAYMENT_METHODS.map((method) => {
                                const Icon = method.icon;
                                const isActive = activeMethod === method.key;
                                const hasValue = parseFloat(amounts[method.key]) > 0;
                                return (
                                    <button
                                        key={method.key}
                                        type="button"
                                        onClick={() => handleSelectMethod(method.key)}
                                        className={`relative p-2.5 rounded-lg flex flex-col items-center justify-center gap-1.5 border transition-colors text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                            isActive
                                                ? 'bg-primary-soft border-primary text-primary'
                                                : 'bg-card border-line hover:border-line-strong text-body hover:text-heading'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                                            isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-dim'
                                        }`}>
                                            <Icon size={16} />
                                        </div>
                                        <span className="text-xs font-semibold">{method.label}</span>

                                        {hasValue && !isActive && (
                                            <span className="absolute top-1.5 right-1.5 text-success" aria-label="Nominal terisi">
                                                <CheckCircle2 size={13} />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Input Field for Active Method */}
                    <div className="bg-muted/50 border border-line rounded-xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-heading">
                                Nominal ({PAYMENT_METHODS.find(m => m.key === activeMethod)?.label})
                            </span>
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs font-semibold text-danger hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1"
                            >
                                Hapus
                            </button>
                        </div>

                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim text-base font-semibold">Rp</span>
                            <input
                                ref={amountInputRef}
                                type="text"
                                value={amounts[activeMethod]}
                                onChange={e => setAmount(activeMethod, e.target.value)}
                                onBlur={() => evaluateMethodAmount(activeMethod)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        evaluateMethodAmount(activeMethod);
                                    }
                                    if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                placeholder="0"
                                className="w-full pl-11 pr-3.5 py-2.5 bg-input border border-line rounded-lg text-xl font-bold text-heading focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-right tnum"
                            />
                        </div>

                        {/* Bank Selection */}
                        {['transfer', 'debit', 'credit'].includes(activeMethod) && (
                            <div className="space-y-1.5 pt-1">
                                <label className="text-xs font-semibold text-dim block">Rekening Bank</label>
                                <Select
                                    value={bankIds[activeMethod] || ''}
                                    onChange={v => setBankIds(prev => ({ ...prev, [activeMethod]: v }))}
                                    placeholder="Pilih bank"
                                    className="w-full"
                                >
                                    <option value="">Pilih bank</option>
                                    {banks.map(b => (
                                        <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        {/* Quick Cash Buttons */}
                        {activeMethod === 'cash' && (
                            <div className="space-y-2 pt-1">
                                <span className="text-xs font-semibold text-dim block">Nominal Cepat</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExact}
                                        className="h-9 bg-primary-soft hover:opacity-90 text-primary font-semibold text-xs rounded-lg border border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        Uang Pas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickCash(50000, 'set')}
                                        className="h-9 bg-card hover:bg-muted text-heading font-semibold text-xs rounded-lg border border-line transition-colors cursor-pointer tnum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        Rp 50.000
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickCash(100000, 'set')}
                                        className="h-9 bg-card hover:bg-muted text-heading font-semibold text-xs rounded-lg border border-line transition-colors cursor-pointer tnum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        Rp 100.000
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[10000, 20000, 50000, 100000].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => handleQuickCash(val, 'add')}
                                            className="h-8 bg-card hover:bg-muted text-body hover:text-heading font-semibold text-xs rounded-lg border border-line transition-colors cursor-pointer tnum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        >
                                            +{val.toLocaleString('id-ID')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Split Payment Summary */}
                    {PAYMENT_METHODS.some(m => parseFloat(amounts[m.key]) > 0 && m.key !== activeMethod) && (
                        <div className="border border-line bg-card rounded-xl p-3.5 space-y-2">
                            <span className="text-xs font-semibold text-dim block">Rincian Pembayaran</span>
                            <div className="space-y-1.5">
                                {PAYMENT_METHODS.map(m => {
                                    const amount = parseFloat(amounts[m.key]) || 0;
                                    if (amount === 0) return null;
                                    return (
                                        <div key={m.key} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-body">{m.label}</span>
                                            <span className="font-semibold text-heading tnum">Rp {amount.toLocaleString('id-ID')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Voucher & Manual Discount */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-card border border-line rounded-xl p-3 flex items-center gap-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
                            <div className="w-8 h-8 bg-muted text-dim rounded-lg flex items-center justify-center shrink-0">
                                <Ticket size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <label className="text-xs font-semibold text-dim block">Voucher</label>
                                <input
                                    type="text"
                                    value={voucher}
                                    onChange={e => setVoucher(e.target.value.toUpperCase())}
                                    placeholder="Kode voucher"
                                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-heading placeholder:text-dim p-0 font-mono"
                                />
                            </div>
                        </div>

                        <div className="bg-card border border-line rounded-xl p-3 flex items-center gap-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
                            <div className="w-8 h-8 bg-danger-soft text-danger rounded-lg flex items-center justify-center shrink-0">
                                <Percent size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <label className="text-xs font-semibold text-dim block">Diskon Manual</label>
                                <input
                                    type="text"
                                    value={manualDiscountStr}
                                    onChange={e => setManualDiscountStr(e.target.value)}
                                    placeholder="Nominal atau 10%"
                                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-heading placeholder:text-dim p-0 tnum"
                                />
                            </div>
                            {manualDiscountAmt > 0 && (
                                <span className="text-xs font-semibold text-danger bg-danger-soft px-2 py-0.5 rounded-md whitespace-nowrap tnum">
                                    -Rp {manualDiscountAmt.toLocaleString('id-ID')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Summary, Items & Actions */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                    <div className="bg-card rounded-xl p-4 space-y-3.5 border border-line">
                        <div>
                            <label className="text-xs font-semibold text-dim block mb-1.5">Total Tagihan</label>
                            <div className="flex items-center bg-input rounded-lg border border-line px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                                <span className="text-base font-semibold text-dim mr-2">Rp</span>
                                <input
                                    type="text"
                                    value={adjustedTotalStr}
                                    onChange={e => setAdjustedTotalStr(e.target.value)}
                                    onBlur={evaluateTotal}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            evaluateTotal();
                                        }
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-2xl sm:text-3xl font-bold text-heading p-0 text-right tnum tracking-tight"
                                />
                            </div>
                        </div>

                        {(discountAmount > 0 || manualDiscountAmt > 0) && (
                            <div className="space-y-1.5 pt-2 border-t border-line">
                                {discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-dim">Diskon Promo{voucher ? ` (${voucher})` : ''}</span>
                                        <span className="font-semibold text-danger tnum">-Rp {discountAmount.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {manualDiscountAmt > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-dim">Diskon Manual</span>
                                        <span className="font-semibold text-danger tnum">-Rp {manualDiscountAmt.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-t border-line pt-1.5">
                                    <span className="text-xs font-semibold text-heading">Total Net</span>
                                    <span className="text-sm font-bold text-heading tnum">Rp {netTotal.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-line">
                            <span className="text-xs font-medium text-dim">Total Bayar</span>
                            <span className="text-sm font-bold text-heading tnum">Rp {totalBayar.toLocaleString('id-ID')}</span>
                        </div>

                        {kembali > 0 ? (
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs font-semibold text-success">Kembalian</span>
                                <span className="text-xl font-bold text-success tnum">Rp {kembali.toLocaleString('id-ID')}</span>
                            </div>
                        ) : totalBayar > 0 && totalBayar < netTotal ? (
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs font-semibold text-danger">Kurang</span>
                                <span className="text-xl font-bold text-danger tnum">Rp {(netTotal - totalBayar).toLocaleString('id-ID')}</span>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs font-medium text-dim">Status</span>
                                <span className="text-xs font-semibold bg-warning-soft text-warning px-2 py-0.5 rounded-md">
                                    Belum Lunas
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Items Summary */}
                    <div className="bg-muted/40 border border-line rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-line pb-2">
                            <div className="flex items-center gap-1.5 text-heading font-semibold text-xs">
                                <ShoppingBag size={14} className="text-dim" />
                                <span className="tnum">Item ({cart.reduce((s, i) => s + i.qty, 0)})</span>
                            </div>
                            <span className="text-xs text-dim tnum">{cart.length} produk</span>
                        </div>

                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {cart.map((item, idx) => {
                                const lineSubtotal = item.qty * item.price - (item.discount_amount || 0);
                                return (
                                    <div key={idx} className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-card border border-line/70">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <p className="font-semibold text-heading truncate">
                                                {item.item_name}
                                                {item.is_bogo_free && (
                                                    <span className="ml-1.5 text-[10px] bg-success-soft text-success font-semibold px-1.5 py-0.5 rounded-md">
                                                        Gratis
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[11px] text-dim tnum mt-0.5">
                                                {item.qty} {item.unit_name} × Rp {item.price.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-semibold text-heading tnum">
                                                Rp {lineSubtotal.toLocaleString('id-ID')}
                                            </span>
                                            {item.discount_amount > 0 && (
                                                <p className="text-[10px] text-danger tnum">
                                                    -Rp {item.discount_amount.toLocaleString('id-ID')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
