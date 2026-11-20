import { useState, useEffect } from 'react';
import { Save, Building2 } from 'lucide-react';
import { Supplier, addSupplier, updateSupplier } from '../../lib/api';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface SupplierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplierToEdit?: Supplier | null;
}

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-line bg-input px-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function SupplierDrawer({
  isOpen,
  onClose,
  onSuccess,
  supplierToEdit,
}: SupplierDrawerProps) {
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (supplierToEdit) {
        setFormData({
          name: supplierToEdit.name,
          contact_person: supplierToEdit.contact_person || '',
          phone: supplierToEdit.phone || '',
          email: supplierToEdit.email || '',
          address: supplierToEdit.address || '',
          payment_terms: supplierToEdit.payment_terms || '',
          notes: supplierToEdit.notes || '',
        });
      } else {
        setFormData({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          address: '',
          payment_terms: 'NET 30',
          notes: '',
        });
      }
    }
  }, [isOpen, supplierToEdit]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return toast.info('Nama pemasok wajib diisi.');
    setIsSubmitting(true);
    try {
      if (supplierToEdit) {
        await updateSupplier(
          supplierToEdit.id,
          formData.name.trim(),
          formData.contact_person.trim(),
          formData.phone.trim(),
          formData.email.trim(),
          formData.address.trim(),
          formData.payment_terms.trim(),
          formData.notes.trim(),
        );
      } else {
        await addSupplier(
          formData.name.trim(),
          formData.contact_person.trim(),
          formData.phone.trim(),
          formData.email.trim(),
          formData.address.trim(),
          formData.payment_terms.trim(),
          formData.notes.trim(),
        );
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Gagal menyimpan pemasok: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={supplierToEdit ? 'Edit Pemasok' : 'Tambah Pemasok'}
      icon={Building2}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} loading={isSubmitting}>
            {!isSubmitting && <Save size={15} />}
            {supplierToEdit ? 'Simpan Perubahan' : 'Simpan Pemasok'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-body mb-1.5">
              Nama Pemasok *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: PT Kimia Farma Trading"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">
              Contact Person (PIC)
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="Nama PIC"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">
              Syarat Bayar (TOP)
            </label>
            <input
              type="text"
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              placeholder="Contoh: NET 30, COD"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0812-3456-7890"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="order@pemasok.co.id"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-line space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Alamat</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Alamat kantor atau gudang"
              rows={3}
              className="w-full rounded-lg border border-line bg-input p-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Catatan</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Rekening bank, diskon, atau catatan lain"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
