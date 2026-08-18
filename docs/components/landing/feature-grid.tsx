'use client';

import { motion } from 'framer-motion';

const features = [
  {
    title: 'On-Chain Verification',
    description: 'Server verifies the recipient, amount, and block confirmations on every single transaction — not just the client.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Multi-Chain by Default',
    description: 'Ethereum, Base, Arbitrum, Polygon and TRON from a single config. Add a chain — zero new architecture.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l9 5 9-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l9 5 9-5" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: 'Stablecoin-Native',
    description: 'USDC, USDT and DAI out of the box with built-in fiat conversion. Never touch a float for prices again.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M15 9.5c0-1.5-1.5-2.5-3-2.5S9 8 9 9.5 10.5 12 12 12s3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5" />
      </svg>
    ),
  },
  {
    title: 'Wallet Checkout',
    description: 'AppKit-powered connect, sign and pay flow your users already know. MetaMask, Coinbase, TronLink and more.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12h6M3 12h6" />
      </svg>
    ),
  },
  {
    title: 'Server-Side Pricing',
    description: 'Amounts and plans are locked on the server. Never trust client-side totals — for fiat or crypto.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: 'Signed Webhooks',
    description: 'Cryptographic signature verification on every event — Stripe, Chapa and on-chain settlement.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
];

export function FeatureGrid() {
  return (
    <div className="rounded-md border border-foreground/[0.08] divide-y divide-foreground/[0.06] overflow-hidden">
      {features.map((feature, i) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="flex items-start gap-3.5 p-4 group hover:bg-foreground/[0.02] transition-colors"
        >
          <div className="shrink-0 w-9 h-9 rounded-md border border-foreground/[0.08] bg-foreground/[0.02] flex items-center justify-center text-foreground/70 group-hover:text-foreground group-hover:border-foreground/20 transition-colors">
            {feature.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground/90">{feature.title}</h3>
            <p className="mt-0.5 text-[13px] text-foreground/50 leading-relaxed">
              {feature.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
