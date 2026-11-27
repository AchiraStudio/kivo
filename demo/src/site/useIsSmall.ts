import { useEffect, useState } from 'react';

/** Phones: below this width the desktop app would be unreadably small, so show the phone app instead. */
const QUERY = '(max-width: 699px)';

export function useIsSmall(): boolean {
  const [small, setSmall] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const m = window.matchMedia(QUERY);
    const on = () => setSmall(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return small;
}
