import { createClient } from '@neondatabase/neon-js';

const cleanUrl = (url?: string): string => {
  if (!url) return '';
  return url.replace(/^['"]|['"]$/g, '').trim();
};

export const neonClient = createClient({
  auth: {
    url: cleanUrl(import.meta.env.VITE_NEON_AUTH_URL),
  },
  dataApi: {
    url: cleanUrl(import.meta.env.VITE_NEON_DATA_API_URL),
  },
});
