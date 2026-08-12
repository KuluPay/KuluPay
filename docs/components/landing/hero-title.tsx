'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { appName, gitConfig } from '@/lib/shared';

export function HeroTitle() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative z-[2] w-full py-16 flex flex-col justify-center h-full pointer-events-none"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 pointer-events-auto rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 transition-colors mb-4">
          <span className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-100 font-light">
            Open Source <span className="font-medium">| MIT Licensed</span>
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl xl:text-4xl text-neutral-800 dark:text-neutral-200 tracking-tight leading-tight text-balance">
          Unified Payments.
          <br />
          One API, Every Provider.
        </h1>

        <p className="mt-4 text-sm sm:text-base text-neutral-500 dark:text-neutral-400 max-w-md leading-relaxed">
          Integrate Stripe, PayPal, Chapa, and crypto through a single, type-safe SDK.
          Modular imports, server-side pricing, auto-customers.
        </p>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-5 pointer-events-auto">
          <Link
            href="/docs/introduction"
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 text-neutral-600 dark:text-neutral-300 text-xs sm:text-sm font-medium transition-colors group"
          >
            <span className="absolute top-0 -left-[6px] -right-[6px] h-px bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute bottom-0 -left-[6px] -right-[6px] h-px bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute left-0 -top-[6px] -bottom-[6px] w-px bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute right-0 -top-[6px] -bottom-[6px] w-px bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg xmlns="http://www.w3.org/2000/svg" width="0.95em" height="0.95em" viewBox="0 0 24 24" className="relative">
              <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
            </svg>
            <span className="relative">Star on GitHub</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
