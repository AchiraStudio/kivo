// Scripted walkthroughs that drive the *real* Kivo UI through its DOM: a visible pointer moves,
// taps and types exactly like a person would. Scenes are cancellable and loop-safe.

import { revealWithin } from './frameGuards';

type Step = () => Promise<void>;

let runId = 0;
let cursor: HTMLDivElement | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ensureCursor() {
  if (cursor && document.body.contains(cursor)) return cursor;
  cursor = document.createElement('div');
  cursor.className = 'demo-cursor';
  document.body.appendChild(cursor);
  return cursor;
}

export const cancelScene = () => {
  runId++;
  cursor?.classList.remove('on');
};

class Cancelled extends Error {}

export interface Ctx {
  wait: (ms: number) => Promise<void>;
  /** Find a visible element by selector whose text matches. */
  find: (selector: string, text?: string | RegExp, timeout?: number) => Promise<HTMLElement>;
  click: (selector: string, text?: string | RegExp) => Promise<void>;
  type: (selector: string, value: string, text?: string | RegExp) => Promise<void>;
  navigate: (menu: string) => void;
  key: (name: string) => void;
}

const visible = (el: Element) => {
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

export async function playScene(scene: (c: Ctx) => Promise<void>) {
  const my = ++runId;
  const check = () => {
    if (my !== runId) throw new Cancelled();
  };
  const wait = async (ms: number) => {
    await sleep(ms);
    check();
  };

  const find: Ctx['find'] = async (selector, text, timeout = 6000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      check();
      const hit = [...document.querySelectorAll<HTMLElement>(selector)].find((el) => {
        if (!visible(el)) return false;
        if (!text) return true;
        const t = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
        return typeof text === 'string' ? t.toLowerCase().includes(text.toLowerCase()) : text.test(t);
      });
      if (hit) return hit;
      await sleep(120);
    }
    throw new Error(`demo: "${selector}" ${String(text ?? '')} not found`);
  };

  const moveTo = async (el: HTMLElement) => {
    const c = ensureCursor();
    revealWithin(el);
    await sleep(260);
    const r = el.getBoundingClientRect();
    c.classList.add('on');
    c.style.transform = `translate(${r.left + Math.min(r.width / 2, 120)}px, ${r.top + r.height / 2}px)`;
    await wait(620);
  };

  const click: Ctx['click'] = async (selector, text) => {
    const el = await find(selector, text);
    await moveTo(el);
    cursor?.classList.remove('tap');
    void cursor?.offsetWidth;
    cursor?.classList.add('tap');
    el.click();
    await wait(380);
  };

  const type: Ctx['type'] = async (selector, value, text) => {
    const el = (await find(selector, text)) as HTMLInputElement;
    await moveTo(el);
    el.focus({ preventScroll: true });
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
    let current = '';
    for (const ch of value) {
      current += ch;
      setter.call(el, current);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(55 + Math.random() * 45);
    }
    await wait(250);
  };

  const key = (name: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  const navigate = (menu: string) => window.dispatchEvent(new CustomEvent('kivo:navigate', { detail: menu }));

  try {
    await scene({ wait, find, click, type, navigate, key });
  } catch (e) {
    if (!(e instanceof Cancelled)) console.warn('[demo]', (e as Error).message);
  } finally {
    if (my === runId) cursor?.classList.remove('on');
  }
}

export type { Step };
