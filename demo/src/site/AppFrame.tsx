import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSiteTheme } from './theme';
import { useI18n } from './i18n';

export interface AppFrameHandle {
  play: (scene: string) => void;
  stop: () => void;
  setOffline: (value: boolean) => void;
}

interface Props {
  device: 'desktop' | 'phone';
  /** Desktop only: render the app at this CSS width (smaller = bigger UI inside the frame). */
  virtualWidth?: number;
  /** Scene to play as soon as the app is ready. */
  scene?: string;
  className?: string;
  /** Called when the visitor takes over (pointer enters), so loops can pause. */
  onTakeover?: () => void;
  /** Called a few seconds after the pointer leaves, so loops can resume. */
  onRelease?: () => void;
}

const SIZE = { desktop: { w: 1280, h: 800 }, phone: { w: 393, h: 852 } } as const;
const sizeFor = (device: 'desktop' | 'phone', virtualWidth?: number) =>
  device === 'desktop' && virtualWidth ? { w: virtualWidth, h: Math.round(virtualWidth * 0.625) } : SIZE[device];

// Wraps the real Kivo app (app.html) in a device frame. The app is the genuine UI from /src,
// running against an in-memory host, so everything inside is clickable.
export const AppFrame = forwardRef<AppFrameHandle, Props>(function AppFrame(
  { device, virtualWidth, scene, className = '', onTakeover, onRelease },
  ref,
) {
  const { theme } = useSiteTheme();
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0.5);
  // Touch screens: a live frame would swallow every swipe, so it asks for a tap before taking input.
  const coarse = useRef(window.matchMedia('(pointer: coarse)').matches).current;
  const [engaged, setEngaged] = useState(!coarse);
  const queue = useRef<object[]>([]);
  const readyRef = useRef(false);
  const releaseTimer = useRef<number>(0);
  const initialTheme = useRef(theme);

  const send = useCallback((msg: object) => {
    const win = iframeRef.current?.contentWindow;
    if (win && readyRef.current) win.postMessage(msg, '*');
    else queue.current.push(msg);
  }, []);

  useImperativeHandle(ref, () => ({
    play: (s) => send({ kivo: 'play', scene: s }),
    stop: () => send({ kivo: 'stop' }),
    setOffline: (v) => send({ kivo: 'offline', value: v }),
  }), [send]);

  // Only boot the app when it is about to be seen.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setMounted(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Scale the fixed-size app to whatever width the layout gives it.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = sizeFor(device, virtualWidth).w;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    setScale(el.clientWidth / w);
    return () => ro.disconnect();
  }, [device, virtualWidth]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.kivo === 'wheel' && typeof e.data.dy === 'number') {
        window.scrollBy({ top: e.data.dy, behavior: 'instant' as ScrollBehavior });
        return;
      }
      if (e.data?.kivo !== 'ready') return;
      readyRef.current = true;
      setReady(true);
      const win = iframeRef.current!.contentWindow!;
      win.postMessage({ kivo: 'theme', theme: initialTheme.current }, '*');
      queue.current.splice(0).forEach((m) => win.postMessage(m, '*'));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (readyRef.current) send({ kivo: 'theme', theme });
  }, [theme, send]);

  // Tapping anywhere outside a touch frame hands the page back to scrolling.
  useEffect(() => {
    if (!coarse || !engaged) return;
    const off = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setEngaged(false);
    };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [coarse, engaged]);

  const src = `./app.html?device=${device === 'phone' ? 'android' : 'desktop'}&theme=${initialTheme.current}${scene ? `&scene=${scene}` : ''}${scene === 'p-update' ? '' : '&update=0'}`;
  const { w, h } = sizeFor(device, virtualWidth);

  const screen = (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `${w} / ${h}` }}
      onPointerEnter={() => {
        window.clearTimeout(releaseTimer.current);
        send({ kivo: 'stop' });
        onTakeover?.();
      }}
      onPointerLeave={() => {
        window.clearTimeout(releaseTimer.current);
        releaseTimer.current = window.setTimeout(() => onRelease?.(), 7000);
      }}
    >
      {mounted && (
        <iframe
          ref={iframeRef}
          title={`Kivo ${device}`}
          src={src}
          loading="lazy"
          className="absolute left-0 top-0 border-0 origin-top-left"
          style={{ width: w, height: h, transform: `scale(${scale})`, pointerEvents: engaged ? 'auto' : 'none' }}
          // The real app's modals and scripted taps stay inside this frame.
          allow="clipboard-write"
        />
      )}
      {coarse && !engaged && ready && (
        <button
          type="button"
          onClick={() => {
            setEngaged(true);
            send({ kivo: 'stop' });
            onTakeover?.();
          }}
          className="absolute inset-0 z-10 flex items-end justify-center pb-4 cursor-pointer"
          aria-label={t('frame.tap')}
        >
          <span className="h-9 px-4 inline-flex items-center rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur">{t('frame.tap')}</span>
        </button>
      )}
      <div
        className={`absolute inset-0 flex items-center justify-center bg-card transition-opacity duration-500 ${ready ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        aria-hidden={ready}
      >
        <div className="flex flex-col items-center gap-3">
          <img src="./kivo.png" alt="" className="w-10 h-10 animate-pulse" />
          <span className="text-xs font-semibold text-dim">{t('frame.loading')}</span>
        </div>
      </div>
    </div>
  );

  if (device === 'desktop') {
    return (
      <div className={`rounded-2xl p-[7px] bg-gradient-to-b from-line to-line/40 frame-shadow ${className}`}>
        <div className="rounded-[11px] overflow-hidden bg-background ring-1 ring-black/20">{screen}</div>
      </div>
    );
  }

  return (
    <div className={`relative mx-auto w-full rounded-[2.6rem] p-[9px] bg-gradient-to-b from-line-strong/60 to-line frame-shadow ${className}`}>
      <div className="rounded-[2.1rem] overflow-hidden bg-background ring-1 ring-black/30 relative">
        {screen}
      </div>
    </div>
  );
});
