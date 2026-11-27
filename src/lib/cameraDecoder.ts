// Frame decoder for camera barcode scanning.
//
// Chrome-based browsers expose the native BarcodeDetector API, but the Android System
// WebView (what the Kivo Android app runs in) does not. In that case we fall back to
// ZXing, loaded on demand so it never weighs down the normal startup path.

export type FrameDecoder = (video: HTMLVideoElement) => Promise<string | null>;

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'];

async function createNativeDecoder(): Promise<FrameDecoder | null> {
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) return null;

  let formats = NATIVE_FORMATS;
  try {
    const supported: string[] | undefined = await Detector.getSupportedFormats?.();
    if (supported?.length) formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    if (!formats.length) return null;
    const detector = new Detector({ formats });
    return async (video) => {
      const results = await detector.detect(video);
      const value = results?.[0]?.rawValue;
      return value ? String(value).trim() : null;
    };
  } catch {
    return null;
  }
}

async function createZxingDecoder(): Promise<FrameDecoder> {
  const zx = await import('@zxing/library');
  const hints = new Map<any, any>();
  hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
    zx.BarcodeFormat.EAN_13,
    zx.BarcodeFormat.EAN_8,
    zx.BarcodeFormat.UPC_A,
    zx.BarcodeFormat.UPC_E,
    zx.BarcodeFormat.CODE_128,
    zx.BarcodeFormat.CODE_39,
    zx.BarcodeFormat.ITF,
    zx.BarcodeFormat.QR_CODE,
    zx.BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(zx.DecodeHintType.TRY_HARDER, true);

  const reader = new zx.MultiFormatReader();
  reader.setHints(hints);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return async (video) => {
    if (!ctx || !video.videoWidth || !video.videoHeight) return null;
    // Downscale big camera frames: decoding gets faster and 1D codes stay readable.
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const bitmap = new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.HTMLCanvasElementLuminanceSource(canvas)));
      const text = reader.decode(bitmap).getText();
      return text ? text.trim() : null;
    } catch {
      return null; // No code in this frame
    }
  };
}

export async function createFrameDecoder(): Promise<{ decode: FrameDecoder; native: boolean }> {
  const native = await createNativeDecoder();
  if (native) return { decode: native, native: true };
  return { decode: await createZxingDecoder(), native: false };
}
