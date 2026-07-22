import type { Metadata } from 'next';
import { appName, gitConfig } from './shared';

export const baseUrl =
  process.env.NODE_ENV === 'development' ||
  (!process.env.VERCEL_PROJECT_PRODUCTION_URL && !process.env.VERCEL_URL)
    ? new URL('http://localhost:3000')
    : new URL(
        process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL}`,
      );

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    metadataBase: baseUrl,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: baseUrl.toString(),
      images: '/og.png',
      siteName: appName,
      ...override.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: '/og.png',
      ...override.twitter,
    },
    icons: {
      icon: [
        { url: '/favicon/favicon.ico', sizes: 'any' },
        { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: '/favicon/apple-touch-icon.png',
    },
  };
}

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
