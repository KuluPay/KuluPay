import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { baseUrl } from '@/lib/metadata';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const basePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl.toString(),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  const docPages: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${baseUrl.toString()}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...basePages, ...docPages];
}
