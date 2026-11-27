import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** True below Tailwind's `md` breakpoint, where forms and pickers switch to bottom sheets. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isPhone;
}
