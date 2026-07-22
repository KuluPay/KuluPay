export const appName = process.env.KULUPAY_APP_NAME ?? 'KuluPay';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: process.env.KULUPAY_GIT_USER ?? 'kulupay',
  repo: process.env.KULUPAY_GIT_REPO ?? 'kulupay',
  branch: process.env.KULUPAY_GIT_BRANCH ?? 'main',
};
