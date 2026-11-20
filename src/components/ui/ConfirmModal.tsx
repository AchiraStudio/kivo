import { useEffect } from 'react';
import { AlertTriangle, Info, LogOut } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'logout';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, loading]);

  const variants = {
    danger: {
      iconBg: 'bg-danger-soft text-danger',
      btnVariant: 'danger' as const,
      Icon: AlertTriangle,
    },
    warning: {
      iconBg: 'bg-warning-soft text-warning',
      btnVariant: 'primary' as const,
      Icon: AlertTriangle,
    },
    primary: {
      iconBg: 'bg-primary-soft text-primary',
      btnVariant: 'primary' as const,
      Icon: Info,
    },
    logout: {
      iconBg: 'bg-danger-soft text-danger',
      btnVariant: 'danger' as const,
      Icon: LogOut,
    },
  };

  const v = variants[variant];

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={title}
      icon={v.Icon}
      iconBg={v.iconBg}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={v.btnVariant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-body leading-relaxed">{message}</p>
    </Modal>
  );
}
