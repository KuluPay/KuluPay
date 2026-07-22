import type { MetadataRoute } from 'next';
import { baseUrl } from '@/lib/metadata';
import { gitConfig } from '@/lib/shared';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl.toString()}/sitemap.xml`,
    host: baseUrl.toString(),
  };
}
