import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  message: React.ReactNode;
  confirmText?: string;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  confirmText = 'Hapus',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={AlertTriangle}
      iconBg="bg-danger-soft text-danger"
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm text-body leading-relaxed">{message}</div>
    </Modal>
  );
}
