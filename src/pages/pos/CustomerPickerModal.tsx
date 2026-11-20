// src/pages/pos/CustomerPickerModal.tsx
import { useState, useEffect } from 'react';
import { Search, UserCheck, Loader2, Users, Check } from 'lucide-react';
import { getCustomers, Customer } from '../../lib/api';
import Modal from '../../components/ui/Modal';

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

    // Arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
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
    }, [isOpen, customers, focusedIndex, onSelect, onClose]);

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
    }, [search, isOpen]);

    if (!isOpen) return null;

    const isWalkInSelected = !selectedId || selectedId === 'cust_umum';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title="Pilih Pelanggan"
            icon={Users}
            noPadding={true}
        >
            <div className="p-3.5 border-b border-line">
                <div className="flex items-center gap-2 h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
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
    );
}
