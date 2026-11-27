// src/pages/pos/CustomerPickerModal.tsx
import { useState, useEffect } from 'react';
import { Search, UserCheck, Loader2, Users, Check, UserPlus } from 'lucide-react';
import { getCustomers, Customer } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Sheet from '../../components/ui/Sheet';
import CustomerModal from '../customers/CustomerModal';
import { useIsPhone } from '../../hooks/useIsPhone';
import { usePermissions } from '../../lib/permissions';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (customer: Customer | null) => void;
    selectedId?: string;
}

const TIER_CONFIG = {
    regular: { label: 'Regular', color: 'bg-muted text-body' },
    member:  { label: 'Member',  color: 'bg-info-soft text-info' },
    vip:     { label: 'VIP',     color: 'bg-warning-soft text-warning' },
};

export default function CustomerPickerModal({ isOpen, onClose, onSelect, selectedId }: Props) {
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [showNew, setShowNew] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const isPhone = useIsPhone();
    const { can } = usePermissions();
    const canCreate = can('crm.customers');

    // Arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || showNew) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, customers.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex === 0) {
                    onSelect(null);
                    onClose();
                } else if (focusedIndex > 0 && customers[focusedIndex - 1]) {
                    onSelect(customers[focusedIndex - 1]);
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showNew, customers, focusedIndex, onSelect, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const results = await getCustomers(search, '', true);
                const filtered = results.filter(
                    c => c.id !== 'cust_umum' && c.name.trim().toLowerCase() !== 'pelanggan umum'
                );
                setCustomers(filtered);
            } catch (err) {
                console.error(err);
                setError('Gagal memuat daftar pelanggan.');
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [search, isOpen, reloadKey]);

    if (!isOpen) return null;

    const isWalkInSelected = !selectedId || selectedId === 'cust_umum';

    if (isPhone) {
        return (
            <>
                <Sheet isOpen={isOpen && !showNew} onClose={onClose} title="Pilih Pelanggan">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 h-12 bg-input border border-line rounded-xl px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                            <Search size={17} className="text-dim shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari nama atau nomor HP"
                                aria-label="Cari pelanggan"
                                className="flex-1 bg-transparent outline-none text-base text-heading placeholder:text-dim"
                            />
                        </div>

                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => setShowNew(true)}
                                className="w-full h-12 rounded-xl border border-dashed border-primary/50 bg-primary-soft/50 text-primary text-sm font-bold flex items-center justify-center gap-2 cursor-pointer active:bg-primary-soft"
                            >
                                <UserPlus size={17} /> Pelanggan baru{search.trim() && !/\d{5,}/.test(search) ? `: ${search.trim()}` : ''}
                            </button>
                        )}

                        <div className="rounded-2xl border border-line overflow-hidden divide-y divide-line">
                            <button
                                type="button"
                                onClick={() => { onSelect(null); onClose(); }}
                                className={`w-full flex items-center gap-3 px-3.5 min-h-[56px] text-left cursor-pointer active:bg-muted ${isWalkInSelected ? 'bg-primary-soft/60' : ''}`}
                            >
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isWalkInSelected ? 'bg-primary-soft text-primary' : 'bg-muted text-dim'}`}>
                                    <UserCheck size={17} />
                                </span>
                                <span className="text-sm font-bold text-heading flex-1 truncate">Pelanggan Umum</span>
                                {isWalkInSelected && <Check size={17} className="text-primary shrink-0" />}
                            </button>

                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-primary" /></div>
                            ) : error ? (
                                <p className="text-center text-sm text-danger py-8 px-4">{error}</p>
                            ) : customers.length === 0 ? (
                                <p className="text-center text-sm text-dim py-8 px-4">{search ? 'Pelanggan tidak ditemukan.' : 'Belum ada pelanggan.'}</p>
                            ) : (
                                customers.map(c => {
                                    const tier = TIER_CONFIG[c.customer_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.regular;
                                    const isSelected = c.id === selectedId;
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { onSelect(c); onClose(); }}
                                            className={`w-full flex items-center gap-3 px-3.5 min-h-[60px] text-left cursor-pointer active:bg-muted ${isSelected ? 'bg-primary-soft/60' : ''}`}
                                        >
                                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 ${isSelected ? 'bg-primary-soft text-primary' : 'bg-muted text-heading'}`}>
                                                {c.name.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-bold text-heading truncate">{c.name}</span>
                                                {c.phone && <span className="block text-xs text-dim truncate tnum">{c.phone}</span>}
                                            </span>
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${tier.color}`}>{tier.label}</span>
                                            {isSelected && <Check size={17} className="text-primary shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </Sheet>

                <CustomerModal
                    isOpen={showNew}
                    onClose={() => setShowNew(false)}
                    onSuccess={(saved) => {
                        setReloadKey(k => k + 1);
                        // Straight into the sale: the cashier should not have to search for who they just added.
                        if (saved) { onSelect(saved); setShowNew(false); onClose(); }
                    }}
                />
            </>
        );
    }

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title="Pilih Pelanggan"
            icon={Users}
            noPadding={true}
        >
            <div className="p-3.5 border-b border-line flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
                    <Search size={15} className="text-dim shrink-0" />
                    <input
                        type="text"
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari nama atau nomor HP..."
                        className="flex-1 bg-transparent outline-none text-sm text-heading placeholder:text-dim"
                    />
                </div>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => setShowNew(true)}
                        title="Pelanggan baru"
                        aria-label="Pelanggan baru"
                        className="h-9 px-3 rounded-lg border border-line bg-card text-heading text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-muted cursor-pointer shrink-0"
                    >
                        <UserPlus size={14} /> Baru
                    </button>
                )}
            </div>

            <button
                type="button"
                onClick={() => { onSelect(null); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-line cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    isWalkInSelected ? 'bg-primary-soft/60' : ''
                } ${focusedIndex === 0 ? 'ring-2 ring-inset ring-primary bg-primary-soft/60' : ''}`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isWalkInSelected ? 'bg-primary-soft text-primary' : 'bg-muted text-dim'
                }`}>
                    <UserCheck size={15} />
                </div>
                <span className="text-sm font-semibold text-heading flex-1 truncate">Pelanggan Umum</span>
                {isWalkInSelected && <Check size={15} className="text-primary shrink-0" />}
            </button>

            <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-line">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 size={22} className="animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <p className="text-center text-sm text-danger py-8 px-4">{error}</p>
                ) : customers.length === 0 ? (
                    <p className="text-center text-sm text-dim py-8 px-4">
                        {search ? 'Pelanggan tidak ditemukan.' : 'Belum ada pelanggan.'}
                    </p>
                ) : (
                    customers.map((c, idx) => {
                        const tier = TIER_CONFIG[c.customer_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.regular;
                        const isSelected = c.id === selectedId;
                        const isFocused = focusedIndex === idx + 1;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => { onSelect(c); onClose(); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                                    isSelected ? 'bg-primary-soft/60' : ''
                                } ${isFocused ? 'ring-2 ring-inset ring-primary bg-primary-soft/60' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                                    isSelected
                                        ? 'bg-primary-soft text-primary border-primary/30'
                                        : 'bg-muted text-heading border-line'
                                }`}>
                                    {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-heading truncate">{c.name}</p>
                                    {c.phone && <p className="text-xs text-dim truncate tnum">{c.phone}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tier.color}`}>
                                        {tier.label}
                                    </span>
                                    {isSelected && <Check size={15} className="text-primary" />}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </Modal>
            <CustomerModal
                isOpen={showNew}
                onClose={() => setShowNew(false)}
                onSuccess={(saved) => {
                    setReloadKey(k => k + 1);
                    if (saved) { onSelect(saved); setShowNew(false); onClose(); }
                }}
            />
        </>
    );
}
