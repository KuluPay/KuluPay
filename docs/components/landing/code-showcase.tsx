'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';

type FileEntry = {
  label: string;
  code: string;
};

const files: FileEntry[] = [
  {
    label: 'lib/pay.ts',
    code: `import { kuluPay } from "@kulupay/kulupay";
import { onchain } from "@kulupay/kulupay/plugins/onchain";
import { pg } from "@kulupay/adapter-sql";
import { stripe } from "@kulupay/kulupay/providers";
import { Pool } from "pg";

export const pay = kuluPay({
  database: pg(new Pool({ connectionString: process.env.DATABASE_URL! })),
  plugins: [
    onchain({
      ethereum: { recipientAddress: "0x...", tokens: ["USDC"] },
      base:     { recipientAddress: "0x...", tokens: ["USDC"] },
      tron:     { recipientAddress: "T...",  tokens: ["USDT"] },
    }),
  ],
  providers: [stripe({ apiKey: process.env.STRIPE_API_KEY! })],
});`,
  },
  {
    label: 'lib/pay-client.ts',
    code: `import { createPayClient } from "@kulupay/kulupay/client";
import { onchainClient } from "@kulupay/kulupay/plugins/onchain/client";

export const payClient = createPayClient({
  baseURL: process.env.NEXT_PUBLIC_KULUPAY_URL ?? "http://localhost:3000",
  plugins: [
    onchainClient({
      walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    }),
  ],
});`,
  },
  {
    label: 'checkout.tsx',
    code: `"use client";

import { KuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { payClient } from "@/lib/pay-client";

export default function Checkout({ intentId, clientSecret }) {
  return (
    <KuluPayCheckout
      client={payClient}
      intentId={intentId}
      clientSecret={clientSecret}
      onSuccess={(txHash) => console.log("Paid:", txHash)}
      onError={(err) => console.error("Failed:", err)}
    />
  );
}`,
  },
];

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(import|from|export|const|let|var|await|async|return|new|function|type|if|else|as|class)\b)/g;

function renderLine(line: string, key: number): ReactNode {
  const parts = line.split(TOKEN_RE);
  return (
    <span key={key} className="block whitespace-pre">
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^\/\//.test(part) || /^\/\*/.test(part)) {
          return (
            <span key={i} className="text-foreground/35 italic">
              {part}
            </span>
          );
        }
        if (/^["'`]/.test(part)) {
          return (
            <span key={i} className="text-amber-600 dark:text-amber-300">
              {part}
            </span>
          );
        }
        if (/^(import|from|export|const|let|var|await|async|return|new|function|type|if|else|as|class)$/.test(part.trim())) {
          return (
            <span key={i} className="font-medium text-foreground/90">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function CodeShowcase() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(files[active].code.replace(/\r\n?/g, '\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-md border border-foreground/[0.1] bg-white dark:bg-[#0a0a0f] shadow-lg overflow-hidden">
      <div className="flex items-center justify-between border-b border-foreground/[0.08] bg-foreground/[0.02]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {files.map((file, i) => (
              <button
                key={file.label}
                onClick={() => setActive(i)}
                className={cn(
                  'relative px-2 py-0.5 text-[11px] font-mono transition-colors whitespace-nowrap',
                  active === i
                    ? 'text-foreground'
                    : 'text-foreground/45 hover:text-foreground/80',
                )}
              >
                {file.label}
                {active === i && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-foreground/60" />
                )}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="mr-2 flex items-center gap-1.5 rounded border border-foreground/[0.1] px-2 py-0.5 text-[10px] font-mono text-foreground/50 transition hover:border-foreground/25 hover:text-foreground"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-6 text-foreground/80">
            <code>{files[active].code.replace(/\r\n?/g, '\n').split('\n').map(renderLine)}</code>
          </pre>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
