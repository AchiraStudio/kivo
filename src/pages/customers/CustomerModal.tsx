import { useState, useEffect } from 'react';
import { Save, UserCircle, CalendarClock } from 'lucide-react';
import { Customer, addCustomer, updateCustomer, getSettings } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

  useEffect(() => {
    if (isOpen) {
      loadSettings();
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

  const handleSubmit = async () => {
    if (!formData.name.trim()) return toast.info('Nama pelanggan wajib diisi.');
    setIsSubmitting(true);
    try {
      const expiry =
        formData.customer_tier !== 'regular' && formData.membership_expiry
          ? `${formData.membership_expiry} 23:59:59`
          : undefined;

      if (customerToEdit) {
        await updateCustomer(
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
        await addCustomer(
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
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Gagal menyimpan data pelanggan: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          <Button type="button" onClick={handleSubmit} loading={isSubmitting}>
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
