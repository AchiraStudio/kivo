import { useCallback, useEffect, useState } from 'react';
import { getHostUrl, isRemoteClient } from '../lib/runtime';

export type HostLink = 'online' | 'offline' | 'checking';

/**
 * Pings the cashier PC while this device is a remote terminal (phone browser or the
 * Android app in client mode), so the UI can warn before a sale fails mid-checkout.
 * Always "online" for devices that own their data.
 */
export function useHostReachability(intervalMs = 15000) {
  const remote = isRemoteClient();
  const [link, setLink] = useState<HostLink>(remote ? 'checking' : 'online');

  const check = useCallback(async () => {
    if (!remote) return;
    try {
      const res = await fetch(`${getHostUrl()}/api/lan/version`, {
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      });
      setLink(res.ok ? 'online' : 'offline');
    } catch {
      setLink('offline');
    }
  }, [remote]);

  useEffect(() => {
    if (!remote) return;
    check();
    const id = setInterval(check, intervalMs);
    const onWake = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', check);
    };
  }, [remote, intervalMs, check]);

  return { link, remote, recheck: check };
}
