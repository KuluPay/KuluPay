'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { appName } from '@/lib/shared';
import { CodeShowcase } from '@/components/landing/code-showcase';

const pms = [
  { label: 'pnpm', cmd: 'pnpm add @kulupay/kulupay @kulupay/onchain' },
  { label: 'npm', cmd: 'npm install @kulupay/kulupay @kulupay/onchain' },
  { label: 'yarn', cmd: 'yarn add @kulupay/kulupay @kulupay/onchain' },
  { label: 'bun', cmd: 'bun add @kulupay/kulupay @kulupay/onchain' },
];

export function QuickStart() {
  const [pm, setPm] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-foreground/90 tracking-tight mb-1">Quick Start</h2>
      <p className="text-[13px] text-foreground/50 mb-4">
        Install {appName} and start accepting crypto in minutes.
      </p>

      <div className="mb-3 flex items-stretch rounded-md border border-foreground/[0.1] overflow-hidden">
        <div className="flex border-r border-foreground/[0.1]">
          {pms.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPm(i)}
              className={cn(
                'px-2.5 py-1.5 text-[11px] font-medium transition-colors text-left border-r last:border-r-0 border-foreground/[0.1]',
                pm === i
                  ? 'bg-foreground/[0.06] text-foreground'
                  : 'text-foreground/40 hover:text-foreground/70',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 bg-neutral-100/50 dark:bg-[#050505] px-3 py-1.5">
          <code className="text-[12px] font-mono text-foreground/80 truncate">
            <span className="text-foreground/60">$</span> {pms[pm].cmd}
          </code>
          <button
            onClick={() => copy(pms[pm].cmd)}
            className="shrink-0 text-foreground/40 hover:text-foreground transition-colors p-1"
            aria-label="Copy command"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <CodeShowcase />
    </div>
  );
}
