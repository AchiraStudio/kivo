import { useEffect, useRef, useState } from 'react';
import { Camera, ScanBarcode, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { playScanBeep } from '../../hooks/useBarcodeScanner';

interface BarcodeCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  title?: string;
}

export default function BarcodeCameraModal({
  isOpen,
  onClose,
  onDetected,
  title = 'Scan Barcode',
}: BarcodeCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    setManualCode('');

    const hasDetector = typeof (window as any).BarcodeDetector !== 'undefined';
    setDetectorSupported(hasDetector);

    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Kamera tidak tersedia di perangkat/browser ini. Gunakan scanner USB atau ketik kode di bawah.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!hasDetector) {
          return;
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        const scanFrame = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const results = await detector.detect(videoRef.current);
              if (results && results.length > 0 && results[0].rawValue) {
                const value = String(results[0].rawValue).trim();
                if (value) {
                  playScanBeep(true);
                  onDetected(value);
                  onClose();
                  return;
                }
              }
            }
          } catch {
            // Keep scanning next frame
          }
          rafId = requestAnimationFrame(scanFrame);
        };

        rafId = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        setCameraError(err?.message || 'Izin kamera ditolak atau perangkat kamera tidak ditemukan.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen, onDetected, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    playScanBeep(true);
    onDetected(clean);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Arahkan kamera ke barcode atau gunakan scanner USB/Bluetooth"
      icon={ScanBarcode}
      size="md"
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative rounded-xl overflow-hidden bg-black border border-line aspect-video flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center text-xs text-white/80 space-y-2">
              <Camera size={24} className="mx-auto text-white/60" />
              <p>{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-24 rounded-lg border-2 border-primary" />
              </div>
            </>
          )}
        </div>

        {!detectorSupported && !cameraError && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning-soft border border-warning/25 text-warning text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Deteksi barcode kamera otomatis belum didukung browser ini. Gunakan scanner USB atau ketik di bawah.</span>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Scan USB atau ketik barcode lalu Enter..."
            autoFocus
            className="flex-1 h-9 px-3 rounded-lg bg-input border border-line text-sm text-heading font-mono focus:outline-none focus:border-primary"
          />
          <Button type="submit" variant="primary" size="sm">
            Gunakan
          </Button>
        </form>
      </div>
    </Modal>
  );
}
