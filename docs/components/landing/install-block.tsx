'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

const installCommands = [
  { label: 'pnpm', command: 'pnpm add @kulupay/kulupay' },
  { label: 'npm', command: 'npm install @kulupay/kulupay' },
  { label: 'yarn', command: 'yarn add @kulupay/kulupay' },
  { label: 'bun', command: 'bun add @kulupay/kulupay' },
];

export function InstallBlock() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');
  const [overflow, setOverflow] = useState<'hidden' | 'visible'>('visible');

  useLayoutEffect(() => {
    setOverflow('hidden');
  }, [activeTab]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContentHeight(el.offsetHeight);
    });
    ro.observe(el);
    setContentHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mb-6 rounded-md border border-foreground/[0.1] relative">
      <div className="flex items-center border-b border-foreground/[0.1]">
        {installCommands.map((cmd, i) => (
          <button
            key={cmd.label}
            onClick={() => {
              setActiveTab(i);
              setCopied(false);
            }}
            className={cn(
              'px-4 py-2 text-[12px] transition-colors duration-150 relative',
              activeTab === i
                ? 'text-neutral-800 dark:text-neutral-200'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400',
            )}
          >
            {cmd.label}
            {activeTab === i && (
              <div className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-neutral-600 dark:bg-neutral-400" />
            )}
          </button>
        ))}
      </div>

      <motion.div
        animate={{ height: contentHeight }}
        initial={false}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        onAnimationComplete={() => setOverflow('visible')}
        style={{ overflow }}
      >
        <div ref={contentRef}>
          <AnimatePresence mode="wait" initial={false}>
            <div key={activeTab}>
              <div className="flex items-center justify-between bg-neutral-100/50 dark:bg-[#050505] px-4 py-3">
                <code className="text-[13px] font-mono">
                  <span className="text-purple-600/90 dark:text-purple-400/90">
                    {installCommands[activeTab].label}
                  </span>{' '}
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {installCommands[activeTab].command.replace(installCommands[activeTab].label + ' ', '')}
                  </span>
                </code>
                <button
                  onClick={() => copy(installCommands[activeTab].command)}
                  className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1"
                  aria-label="Copy command"
                >
                  {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
