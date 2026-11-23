import { useEffect, useRef } from 'react';
import { GS } from '../lib/barcode';

export interface BarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxKeyIntervalMs?: number;
  /**
   * Whether scans are accepted while a form field has focus. `true` allows every field, or pass a
   * predicate to allow specific ones (e.g. only the POS search box). Defaults to `false`.
   */
  allowInInputs?: boolean | ((el: HTMLElement) => boolean);
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

// Scanner listeners that are currently enabled, oldest first. Only the newest one handles a scan, so a
// drawer or modal opened over a page owns the scanner instead of both reacting to the same barcode.
const activeScanners: symbol[] = [];

type TextField = HTMLInputElement | HTMLTextAreaElement;

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color',
]);

function asTextField(el: EventTarget | null): TextField | null {
  if (el instanceof HTMLTextAreaElement) return el;
  if (el instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(el.type)) return el;
  return null;
}

/** Set a field's value in a way React's controlled inputs notice. */
function setFieldValue(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Global hardware barcode scanner listener (USB / Bluetooth HID keyboard wedge, 1D and 2D).
 * Detects rapid keystroke bursts (< 65ms between chars) terminated by Enter or Tab.
 *
 * When a scan lands in a focused field, the characters the scanner "typed" into it are removed
 * again, so the field keeps whatever it held before the scan.
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

  const scannerId = useRef(Symbol('barcode-scanner'));
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const burstField = useRef<{ el: TextField; before: string } | null>(null);
  const onScanRef = useRef(onScan);
  const allowRef = useRef(allowInInputs);

  useEffect(() => {
    onScanRef.current = onScan;
    allowRef.current = allowInInputs;
  }, [onScan, allowInInputs]);

  useEffect(() => {
    if (!enabled) {
      buffer.current = '';
      burstField.current = null;
      return;
    }

    const id = scannerId.current;
    activeScanners.push(id);

    const reset = () => {
      buffer.current = '';
      burstField.current = null;
      lastKeyTime.current = 0;
    };

    const fieldAllowsScan = (target: HTMLElement | null) => {
      const allow = allowRef.current;
      return typeof allow === 'function' ? Boolean(target && allow(target)) : allow;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeScanners[activeScanners.length - 1] !== id) {
        reset();
        return;
      }
      // Use the time the browser received the key, not the time this handler ran: when the page is busy
      // re-rendering after every character, handlers run late but a scanner's keys are still ~ms apart.
      const now = e.timeStamp > 0 ? e.timeStamp : performance.now();

      // 2D scanners separate GS1 fields with the GS control character, which keyboard-wedge mode
      // delivers as Ctrl+]. Fold it into the burst instead of treating it as a shortcut.
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.key === ']') {
        if (buffer.current && now - lastKeyTime.current <= maxKeyIntervalMs) {
          buffer.current += GS;
          lastKeyTime.current = now;
          e.preventDefault();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isEditable && !fieldAllowsScan(target)) {
        reset();
        return;
      }

      if (lastKeyTime.current > 0 && now - lastKeyTime.current > maxKeyIntervalMs) {
        buffer.current = '';
        burstField.current = null;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const scanned = buffer.current.trim();
        const field = burstField.current;
        reset();

        if (scanned.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          if (field && field.el.value !== field.before) setFieldValue(field.el, field.before);
          if (playBeep) playScanBeep(true);
          onScanRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        // The first character of a burst: remember what the focused field held before it was typed.
        if (!buffer.current) {
          const field = asTextField(target);
          burstField.current = field ? { el: field, before: field.value } : null;
        }
        buffer.current += e.key;
        lastKeyTime.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      const at = activeScanners.indexOf(id);
      if (at !== -1) activeScanners.splice(at, 1);
    };
  }, [enabled, minLength, maxKeyIntervalMs, playBeep]);
}
