"use client";

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

export function StripeIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

export function PayPalIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" />
    </svg>
  );
}

export function EthereumIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
    </svg>
  );
}

export function BaseIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} fill="currentColor">
      <path d="M15.9 0c.7 0 1.4.1 2.1.2 2.6.4 4.9 1.5 6.9 3.2 2.7 2.3 4.6 5.3 5.4 8.8.2 1 .3 2 .3 3 0 .7-.1 1.4-.2 2.1-.4 2.6-1.5 4.9-3.2 6.9-2.3 2.7-5.3 4.6-8.8 5.4-1 .2-2 .3-3 .3-.7 0-1.4-.1-2.1-.2-2.6-.4-4.9-1.5-6.9-3.2-2.7-2.3-4.6-5.3-5.4-8.8-.2-1-.3-2-.3-3 0-.7.1-1.4.2-2.1.4-2.6 1.5-4.9 3.2-6.9 2.3-2.7 5.3-4.6 8.8-5.4 1-.2 2-.3 3-.3zm3.6 14.4c-.4-1.7-1.9-2.9-3.7-2.9-1.5 0-2.9.9-3.5 2.3l-3.4 7.7c-.1.3-.1.6.1.8.2.2.5.3.8.2l1.6-.7c.3-.1.5-.4.6-.7l.8-1.8c.1-.3.4-.5.7-.5h4.6c.3 0 .6.2.7.5l.8 1.8c.1.3.3.5.6.7l1.6.7c.3.1.6.1.8-.2.2-.2.2-.5.1-.8l-3.4-7.7z" />
    </svg>
  );
}

export function PolygonIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M16.13 2.39a1.8 1.8 0 0 0-1.8 0L9.88 5.2a1.8 1.8 0 0 0-.9 1.56v5.63a1.8 1.8 0 0 0 .9 1.56l1.37.79c.67.38 1.5-.1 1.5-.9v-5.5a.9.9 0 0 1 .45-.78l3.6-2.08a.9.9 0 0 1 .9 0l3.6 2.08a.9.9 0 0 1 .45.78v4.16a.9.9 0 0 1-.45.78l-3.6 2.08a.9.9 0 0 1-.9 0l-.92-.53a1.8 1.8 0 0 0-2.43.68 1.8 1.8 0 0 0 .68 2.43l2.27 1.31a1.8 1.8 0 0 0 1.8 0l4.5-2.6a1.8 1.8 0 0 0 .9-1.56V6.76a1.8 1.8 0 0 0-.9-1.56l-4.5-2.6zM5.77 8.28a1.8 1.8 0 0 1 .9-1.56l4.5-2.6a1.8 1.8 0 0 1 1.8 0l.93.54a1.8 1.8 0 0 1 .68 2.43 1.8 1.8 0 0 1-2.43.68l-.92-.53a.9.9 0 0 0-.9 0L8.23 9.5a.9.9 0 0 0-.45.78v4.16a.9.9 0 0 0 .45.78l3.6 2.08a.9.9 0 0 0 .9 0l.92-.53a1.8 1.8 0 0 1 2.43.68 1.8 1.8 0 0 1-.68 2.43l-2.27 1.31a1.8 1.8 0 0 1-1.8 0l-4.5-2.6a1.8 1.8 0 0 1-.9-1.56V8.28z" />
    </svg>
  );
}

export function ArbitrumIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.5L5.5 8v8l6.5 3.5 6.5-3.5V8L12 4.5z" />
      <path d="M12 7l4 6H8l4-6z" />
    </svg>
  );
}

export function TronIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M3.45 4.06l8.55 18.2L21 4.06H3.45zm6.04 3.36h5.04l-4.1 8.66-5.1-8.66h4.16z" />
    </svg>
  );
}

export function CryptoIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0v.5a2.5 2.5 0 0 1-5 0V9z" />
      <path d="M12 12v4" />
      <path d="M7 12h10" />
    </svg>
  );
}
