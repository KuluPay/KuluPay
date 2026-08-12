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
      className="w-full py-12 md:py-16 flex flex-col justify-center h-full"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDEDED] border border-[#E1E1E1] mb-4">
          <span className="text-xs text-[#171717]/70 font-medium">
            Open Source <span className="text-[#DD7627]">|</span> MIT Licensed
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl xl:text-5xl font-semibold text-[#171717] tracking-tight leading-tight text-balance">
          Unified Payments.
          <br />
          One API, Every Provider.
        </h1>

        <p className="mt-4 text-sm sm:text-base text-[#171717]/60 max-w-md leading-relaxed">
          Integrate Stripe, PayPal, Chapa, and crypto through a single, type-safe SDK.
          Modular imports, server-side pricing, auto-customers.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-6">
          <Link
            href="/docs/introduction"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#DD7627] text-white text-sm font-semibold rounded-full hover:bg-[#c56820] transition-colors"
          >
            Get Started
          </Link>
          <Link
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#EDEDED] text-[#171717] border border-[#E1E1E1] text-sm font-semibold rounded-full hover:bg-[#E1E1E1] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="0.95em" height="0.95em" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
            </svg>
            Star on GitHub
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
