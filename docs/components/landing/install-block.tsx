'use client';

import { useState } from 'react';
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

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mb-6 rounded-md border border-[#E1E1E1] bg-white overflow-hidden">
      <div className="flex items-center border-b border-[#E1E1E1]">
        {installCommands.map((cmd, i) => (
          <button
            key={cmd.label}
            onClick={() => {
              setActiveTab(i);
              setCopied(false);
            }}
            className={cn(
              'px-4 py-2 text-[12px] font-medium transition-colors duration-150 relative',
              activeTab === i
                ? 'text-[#DD7627]'
                : 'text-[#171717]/50 hover:text-[#171717]',
            )}
          >
            {cmd.label}
            {activeTab === i && (
              <div className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-[#DD7627]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-[#F5F5F5] px-4 py-3">
        <code className="text-[13px] font-mono">
          <span className="text-[#DD7627]">
            {installCommands[activeTab].label}
          </span>{' '}
          <span className="text-[#171717]/70">
            {installCommands[activeTab].command.replace(installCommands[activeTab].label + ' ', '')}
          </span>
        </code>
        <button
          onClick={() => copy(installCommands[activeTab].command)}
          className="text-[#171717]/40 hover:text-[#DD7627] transition-colors p-1"
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
  );
}
