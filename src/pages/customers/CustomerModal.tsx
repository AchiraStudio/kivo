import { useState, useEffect } from 'react';
import { Save, UserCircle, CalendarClock, ChevronDown, UserPlus } from 'lucide-react';
import { Customer, addCustomer, updateCustomer, getSettings } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Sheet from '../../components/ui/Sheet';
import { useIsPhone } from '../../hooks/useIsPhone';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a save. The saved customer is passed so callers (e.g. the cashier) can use it right away. */
  onSuccess: (saved?: Customer) => void;
  customerToEdit?: Customer | null;
}

const TIERS = [
  { id: 'regular', label: 'Reguler' },
  { id: 'member', label: 'Member' },
  { id: 'vip', label: 'VIP' },
] as const;

const fieldCls =
  'w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const labelCls = 'block text-xs font-semibold text-heading mb-1.5';

export default function CustomerModal({ isOpen, onClose, onSuccess, customerToEdit }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    region: '',
    customer_tier: 'regular',
    notes: '',
    membership_expiry: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const isPhone = useIsPhone();

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setShowMore(false);
      if (customerToEdit) {
        setFormData({
          name: customerToEdit.name,
          phone: customerToEdit.phone || '',
          email: customerToEdit.email || '',
          address: customerToEdit.address || '',
          region: customerToEdit.region || '',
          customer_tier: customerToEdit.customer_tier,
          notes: customerToEdit.notes || '',
          membership_expiry: customerToEdit.membership_expiry ? customerToEdit.membership_expiry.split(' ')[0] : '',
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          region: '',
          customer_tier: 'regular',
          notes: '',
          membership_expiry: '',
        });
      }
    }
  }, [isOpen, customerToEdit]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      const map: Record<string, string> = {};
      data.forEach(s => (map[s.key] = s.value));
      setSettings(map);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTierChange = (tier: string) => {
    let newExpiry = formData.membership_expiry;

    if (tier !== 'regular' && (!customerToEdit || customerToEdit.customer_tier === 'regular' || !newExpiry)) {
      const durationMonths = parseInt(settings[`tier_${tier}_duration_months`] || '12', 10);
      const date = new Date();
      date.setMonth(date.getMonth() + durationMonths);
      newExpiry = date.toISOString().split('T')[0];
    } else if (tier === 'regular') {
      newExpiry = '';
    }

    setFormData({ ...formData, customer_tier: tier, membership_expiry: newExpiry });
  };

  const handleExtend = () => {
    if (formData.customer_tier === 'regular') return;
    const durationMonths = parseInt(settings[`tier_${formData.customer_tier}_duration_months`] || '12', 10);

    let baseDate = new Date();
    if (formData.membership_expiry) {
      const currentExpiry = new Date(formData.membership_expiry);
      if (currentExpiry > baseDate) {
        baseDate = currentExpiry;
      }
    }

    baseDate.setMonth(baseDate.getMonth() + durationMonths);
    setFormData({ ...formData, membership_expiry: baseDate.toISOString().split('T')[0] });
  };

  const emptyForm = {
    name: '',
    phone: '',
    email: '',
    address: '',
    region: '',
    customer_tier: 'regular',
    notes: '',
    membership_expiry: '',
  };

  // Phone quick-picks: renew from today, or from the current expiry when it is still in the future.
  const addMonths = (months: number) => {
    let base = new Date();
    if (formData.membership_expiry) {
      const current = new Date(formData.membership_expiry);
      if (current > base) base = current;
    }
    base.setMonth(base.getMonth() + months);
    setFormData({ ...formData, membership_expiry: base.toISOString().split('T')[0] });
  };

  const handleSubmit = async (addAnother = false) => {
    if (!formData.name.trim()) return toast.info('Nama pelanggan wajib diisi.');
    setIsSubmitting(true);
    try {
      const expiry =
        formData.customer_tier !== 'regular' && formData.membership_expiry
          ? `${formData.membership_expiry} 23:59:59`
          : undefined;

      let saved: Customer;
      if (customerToEdit) {
        saved = await updateCustomer(
          customerToEdit.id,
          formData.name,
          formData.phone,
          formData.email,
          formData.address,
          formData.region,
          formData.customer_tier,
          formData.notes,
          expiry
        );
      } else {
        saved = await addCustomer(
          formData.name,
          formData.phone,
          formData.email,
          formData.address,
          formData.region,
          formData.customer_tier,
          formData.notes,
          expiry
        );
      }
      onSuccess(saved);
      if (addAnother && !customerToEdit) {
        // Batch entry: keep the tier the user just picked, clear the person.
        toast.success('Tersimpan', formData.name.trim());
        const tier = formData.customer_tier;
        let nextExpiry = '';
        if (tier !== 'regular') {
          const months = parseInt(settings[`tier_${tier}_duration_months`] || '12', 10);
          const d = new Date();
          d.setMonth(d.getMonth() + months);
          nextExpiry = d.toISOString().split('T')[0];
        }
        setFormData({ ...emptyForm, customer_tier: tier, membership_expiry: nextExpiry });
        setShowMore(false);
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(`Gagal menyimpan data pelanggan: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (isPhone) {
    const phoneField =
      'w-full h-12 bg-input border border-line rounded-xl px-3.5 text-base text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors disabled:opacity-50';
    const isMember = formData.customer_tier !== 'regular';
    const duration = parseInt(settings[`tier_${formData.customer_tier}_duration_months`] || '12', 10);

    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={customerToEdit ? 'Edit Pelanggan' : 'Pelanggan Baru'}
        footer={
          customerToEdit ? (
            <Button type="button" size="lg" fullWidth onClick={() => handleSubmit()} loading={isSubmitting} className="h-12 rounded-xl">
              {!isSubmitting && <Save size={16} />} Simpan
            </Button>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => handleSubmit(true)} disabled={isSubmitting} className="col-span-2 h-12 rounded-xl px-2 text-xs">
                <UserPlus size={15} /> Simpan + Baru
              </Button>
              <Button type="button" size="lg" onClick={() => handleSubmit()} loading={isSubmitting} className="col-span-3 h-12 rounded-xl">
                {!isSubmitting && <Save size={16} />} Simpan
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-4 pt-1">
          <div>
            <label htmlFor="cust-name" className={labelCls}>
              Nama <span className="text-danger">*</span>
            </label>
            <input
              id="cust-name"
              type="text"
              autoCapitalize="words"
              autoComplete="off"
              autoFocus={!customerToEdit}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={phoneField}
              disabled={customerToEdit?.id === 'customer_umum'}
              placeholder="Nama lengkap"
            />
          </div>

          <div>
            <label htmlFor="cust-phone" className={labelCls}>No. HP / WhatsApp</label>
            <input
              id="cust-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className={`${phoneField} tnum`}
              placeholder="08..."
            />
          </div>

          <div>
            <span className={labelCls}>Jenis pelanggan</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tier pelanggan">
              {TIERS.map(tier => {
                const active = formData.customer_tier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleTierChange(tier.id)}
                    className={`h-12 rounded-xl text-sm font-bold border cursor-pointer transition-colors ${
                      active ? 'bg-primary-soft text-primary border-primary/50' : 'bg-card text-body border-line active:bg-muted'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isMember && (
            <div className="p-3.5 bg-muted/50 border border-line rounded-2xl space-y-3">
              <label htmlFor="cust-expiry" className="block text-xs font-semibold text-heading">Masa berlaku member</label>
              <div className="relative">
                <CalendarClock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
                <input
                  id="cust-expiry"
                  type="date"
                  value={formData.membership_expiry}
                  onChange={e => setFormData({ ...formData, membership_expiry: e.target.value })}
                  className={`${phoneField} pl-10 tnum`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => addMonths(m)}
                    className="h-10 px-3.5 rounded-full border border-line bg-card text-xs font-bold text-heading active:bg-muted cursor-pointer"
                  >
                    +{m} bln
                  </button>
                ))}
                {duration > 0 && ![1, 3, 6, 12].includes(duration) && (
                  <button
                    type="button"
                    onClick={() => addMonths(duration)}
                    className="h-10 px-3.5 rounded-full border border-primary/40 bg-primary-soft text-xs font-bold text-primary cursor-pointer"
                  >
                    +{duration} bln
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            className="w-full h-11 flex items-center justify-between px-1 text-sm font-bold text-primary cursor-pointer"
          >
            Detail tambahan (email, alamat, catatan)
            <ChevronDown size={18} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>

          {showMore && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="cust-email" className={labelCls}>Email</label>
                <input
                  id="cust-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={phoneField}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label htmlFor="cust-region" className={labelCls}>Wilayah / Kota</label>
                <input
                  id="cust-region"
                  type="text"
                  value={formData.region}
                  onChange={e => setFormData({ ...formData, region: e.target.value })}
                  className={phoneField}
                  placeholder="Jakarta Selatan"
                />
              </div>
              <div>
                <label htmlFor="cust-address" className={labelCls}>Alamat</label>
                <textarea
                  id="cust-address"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-input border border-line rounded-xl px-3.5 py-3 text-base text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors h-24 resize-none"
                  placeholder="Alamat domisili"
                />
              </div>
              <div>
                <label htmlFor="cust-notes" className={labelCls}>Catatan internal</label>
                <input
                  id="cust-notes"
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className={phoneField}
                  placeholder="Alergi, preferensi, dll."
                />
              </div>
            </div>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={customerToEdit ? 'Edit Pelanggan' : 'Pelanggan Baru'}
      icon={UserCircle}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="button" onClick={() => handleSubmit()} loading={isSubmitting}>
            {!isSubmitting && <Save size={15} />}
            Simpan Pelanggan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                Nama Pelanggan <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={fieldCls}
                disabled={customerToEdit?.id === 'customer_umum'}
                placeholder="Nama lengkap"
              />
            </div>

            <div>
              <span className={labelCls}>Tier Pelanggan</span>
              <div className="flex bg-muted p-1 rounded-lg border border-line gap-0.5" role="radiogroup" aria-label="Tier pelanggan">
                {TIERS.map(tier => {
                  const active = formData.customer_tier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleTierChange(tier.id)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? 'bg-card text-heading border border-line'
                          : 'text-dim hover:text-heading border border-transparent'
                      }`}
                    >
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.customer_tier !== 'regular' && (
              <div className="p-3.5 bg-muted/50 border border-line rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-heading">Masa Berlaku Member</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <CalendarClock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
                    <input
                      type="date"
                      value={formData.membership_expiry}
                      onChange={e => setFormData({ ...formData, membership_expiry: e.target.value })}
                      className={`${fieldCls} pl-9 tnum`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExtend}
                    title={`Perpanjang ${settings['tier_' + formData.customer_tier + '_duration_months'] || '12'} bulan`}
                  >
                    Perpanjang
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>No. Telepon / WhatsApp</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className={`${fieldCls} tnum`}
                placeholder="08..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={fieldCls}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className={labelCls}>Wilayah / Kota</label>
              <input
                type="text"
                value={formData.region}
                onChange={e => setFormData({ ...formData, region: e.target.value })}
                className={fieldCls}
                placeholder="Jakarta Selatan"
              />
            </div>

            <div>
              <label className={labelCls}>Alamat</label>
              <textarea
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors h-[104px] resize-none"
                placeholder="Alamat domisili"
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Catatan Internal</label>
          <input
            type="text"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className={fieldCls}
            placeholder="Catatan tambahan pelanggan"
          />
        </div>
      </div>
    </Modal>
  );
}
