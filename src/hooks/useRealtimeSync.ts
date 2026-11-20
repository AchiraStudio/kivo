import { useEffect } from 'react';
import { listen } from '../lib/events';
import { isTauri, getHostUrl } from '../lib/runtime';

const IGNORED_SYNC_TABLES = new Set([
  'calculate_discounts',
  'init',
  'login',
  'logout',
  'send_ai_chat_request',
  'kick_cash_drawer',
  'print_escpos',
  'print_raw_escpos',
]);

export function useRealtimeSync() {
  useEffect(() => {
    const unlistens: (() => void)[] = [];

    if (isTauri()) {
      listen<string>('sync-received', (event) => {
        const table = event.payload;
        if (IGNORED_SYNC_TABLES.has(table)) return;
        window.dispatchEvent(new CustomEvent('kivo:sync', { detail: { table, source: 'cloud' } }));
      }).then(unsub => unlistens.push(unsub));

      listen('kivo:sync', (event) => {
        const payload = (event.payload as { table?: string } | null) || {};
        if (payload.table && IGNORED_SYNC_TABLES.has(payload.table)) return;
        window.dispatchEvent(new CustomEvent('kivo:sync', { detail: { source: 'lan', ...payload } }));
      }).then(unsub => unlistens.push(unsub));

      listen('kivo:lan_status_updated', () => {
        window.dispatchEvent(new CustomEvent('kivo:sync', { detail: { source: 'lan_status' } }));
      }).then(unsub => unlistens.push(unsub));
    }

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kivo_sync_channel') : null;
    if (bc) {
      bc.onmessage = (event) => {
        if (event.data && !IGNORED_SYNC_TABLES.has(event.data.table)) {
          window.dispatchEvent(new CustomEvent('kivo:sync', { detail: event.data }));
        }
      };
    }

    let isRunning = true;
    let currentVersion = 0;
    let abortController: AbortController | null = null;

    const pollServer = async () => {
      while (isRunning) {
        const startedAt = Date.now();
        try {
          abortController = new AbortController();
          const hostUrl = getHostUrl();
          const pollUrl = `${hostUrl}/api/lan/poll?version=${currentVersion}&timeout=20`;

          const res = await fetch(pollUrl, {
            signal: abortController.signal,
            headers: { Accept: 'application/json' },
          });

          if (!res.ok) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          const data = await res.json();
          if (data && typeof data.version === 'number') {
            const prevVersion = currentVersion;
            const nextVersion = data.version;

            if (nextVersion > prevVersion) {
              currentVersion = nextVersion;
              if (
                prevVersion > 0 &&
                data.changed &&
                (!data.table || !IGNORED_SYNC_TABLES.has(data.table))
              ) {
                window.dispatchEvent(
                  new CustomEvent('kivo:sync', {
                    detail: { table: data.table, version: nextVersion, source: 'lan_poll' },
                  }),
                );
                bc?.postMessage({ table: data.table, version: nextVersion, source: 'lan_poll' });
              }
            } else if (Date.now() - startedAt < 500) {
              // Guard against older hosts that return immediately without advancing version
              await new Promise(r => setTimeout(r, 2000));
            }
          } else if (Date.now() - startedAt < 500) {
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || !isRunning) break;
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const hostUrl = getHostUrl();
        fetch(`${hostUrl}/api/lan/version`)
          .then(r => r.json())
          .then(data => {
            if (data && typeof data.version === 'number' && data.version > currentVersion) {
              const oldV = currentVersion;
              currentVersion = data.version;
              if (oldV > 0 && (!data.table || !IGNORED_SYNC_TABLES.has(data.table))) {
                window.dispatchEvent(
                  new CustomEvent('kivo:sync', {
                    detail: { table: data.table, version: data.version, source: 'wake_poll' },
                  }),
                );
                bc?.postMessage({ table: data.table, version: data.version, source: 'wake_poll' });
              }
            }
          })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    if (!isTauri()) {
      pollServer();
    }

    return () => {
      isRunning = false;
      if (abortController) {
        abortController.abort();
      }
      unlistens.forEach(unsub => unsub());
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (bc) bc.close();
    };
  }, []);
}
