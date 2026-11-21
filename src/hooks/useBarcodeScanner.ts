import { useEffect, useRef } from 'react';

export interface BarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxKeyIntervalMs?: number;
  allowInInputs?: boolean;
  playBeep?: boolean;
}

let sharedAudioCtx: AudioContext | null = null;

export function playScanBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = success ? 1480 : 420;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + (success ? 0.07 : 0.14));
  } catch {
    // Ignore audio context errors on restricted devices
  }
}

/**
 * Global hardware barcode scanner listener (USB / Bluetooth HID keyboard wedge).
 * Detects rapid keystroke bursts (< 65ms between chars) terminated by Enter or Tab.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {}
) {
  const {
    enabled = true,
    minLength = 3,
    maxKeyIntervalMs = 65,
    allowInInputs = false,
    playBeep = true,
  } = options;

  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      buffer.current = '';
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isEditable && !allowInInputs) {
        buffer.current = '';
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTime.current;

      if (lastKeyTime.current > 0 && elapsed > maxKeyIntervalMs) {
        buffer.current = '';
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const scanned = buffer.current.trim();
        buffer.current = '';
        lastKeyTime.current = 0;

        if (scanned.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          if (playBeep) playScanBeep(true);
          onScanRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        lastKeyTime.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, minLength, maxKeyIntervalMs, allowInInputs, playBeep]);
}
