function EthereumIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
    </svg>
  );
}

function BaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2 13h-4v-2h4v-2h-4V9h4c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2z" />
    </svg>
  );
}

function ArbitrumIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.5L5.5 8v8l6.5 3.5 6.5-3.5V8L12 4.5z" />
      <path d="M12 7l4 6H8l4-6z" />
    </svg>
  );
}

function TronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M3.45 4.06l8.55 18.2L21 4.06H3.45zm6.04 3.36h5.04l-4.1 8.66-5.1-8.66h4.16z" />
    </svg>
  );
}

function UsdcIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v2M12 16v2M9.5 12h5" />
      <path d="M15 9.5c0-1.5-1.5-2.5-3-2.5M9 14.5c0 1.5 1.5 2.5 3 2.5" />
    </svg>
  );
}

function UsdtIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z" />
    </svg>
  );
}

function StripeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

function PayPalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" />
    </svg>
  );
}

const chains = [
  { name: 'Ethereum', icon: <EthereumIcon /> },
  { name: 'Base', icon: <BaseIcon /> },
  { name: 'Arbitrum', icon: <ArbitrumIcon /> },
  { name: 'TRON', icon: <TronIcon /> },
];

const tokens = [
  { name: 'USDC', icon: <UsdcIcon /> },
  { name: 'USDT', icon: <UsdtIcon /> },
  { name: 'ETH', icon: <EthereumIcon /> },
  { name: 'TRX', icon: <TronIcon /> },
];

const fiat = [
  { name: 'Stripe', icon: <StripeIcon /> },
  { name: 'PayPal', icon: <PayPalIcon /> },
  { name: 'Chapa', icon: null },
];

export function CryptoStrip() {
  return (
    <div className="mb-8">
      <h2 className="text-[11px] uppercase tracking-wider text-foreground/40 font-medium mb-3">
        Crypto-native
      </h2>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {chains.map((chain) => (
            <span
              key={chain.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.14] bg-foreground/[0.03] px-2.5 py-1 text-[11px] font-medium text-foreground/80"
            >
              <span className="text-foreground/60">{chain.icon}</span>
              {chain.name}
            </span>
          ))}
          {tokens.map((token) => (
            <span
              key={token.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.08] bg-foreground/[0.02] px-2.5 py-1 font-mono text-[11px] text-foreground/70"
            >
              <span className="text-foreground/60">{token.icon}</span>
              {token.name}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-foreground/35 font-medium mr-1">
            Cards &amp; fiat:
          </span>
          {fiat.map((p) => (
            <span
              key={p.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.07] px-2.5 py-1 text-[11px] text-foreground/50"
            >
              {p.icon && <span className="text-foreground/50">{p.icon}</span>}
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
