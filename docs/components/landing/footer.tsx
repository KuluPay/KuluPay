import Link from 'next/link';
import { appName, gitConfig } from '@/lib/shared';

const footerLinks = [
  { label: 'Docs', href: '/docs/introduction' },
  { label: 'Installation', href: '/docs/installation' },
  { label: 'Providers', href: '/docs/providers/stripe' },
  { label: 'CLI', href: '/docs/cli/init' },
];

export function Footer() {
  return (
    <footer className="relative mt-10 py-6 px-5 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {footerLinks.map((link, i) => (
            <span key={link.label} className="flex items-center">
              <Link
                href={link.href}
                className="group inline-flex items-center gap-1 text-[11px] font-mono text-[#171717]/50 hover:text-[#DD7627] transition-colors"
              >
                {link.label}
              </Link>
              {i < footerLinks.length - 1 && (
                <span className="text-[#171717]/10 mx-1 text-[10px] select-none">/</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 shrink-0">
          <span className="text-[10px] text-[#171717]/50 font-mono">
            © {new Date().getFullYear()} {appName}
          </span>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-[#171717]/10 select-none hidden sm:inline">·</span>
            <Link
              href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-[#171717]/50 hover:text-[#DD7627] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
