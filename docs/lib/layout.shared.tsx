import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
  return {
    nav: {
      title: appName,
    },
    githubUrl,
    links: [
      {
        text: 'Docs',
        url: '/docs/introduction',
        active: 'nested-url',
      },
    ],
  };
}
