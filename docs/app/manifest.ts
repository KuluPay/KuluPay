import type { MetadataRoute } from 'next';
import { appName } from '@/lib/shared';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description: 'Unified Payment Gateway SDK — One API, Every Provider',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/favicon/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
