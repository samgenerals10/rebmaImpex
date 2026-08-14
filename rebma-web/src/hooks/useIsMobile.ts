import { useEffect, useState } from 'react';

// Matches the app's one real breakpoint (Tailwind `lg`, 1024px) so any
// component that needs to branch in JS (not just CSS) agrees with every
// lg:hidden / hidden lg:block split already used throughout the app.
const QUERY = '(max-width: 1023px)';

export default function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
