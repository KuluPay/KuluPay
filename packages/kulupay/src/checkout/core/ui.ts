import type { CheckoutController, CheckoutState } from "./controller";
import { createCheckout, type CreateCheckoutOptions } from "./controller";
import { formatAmount, shortenAddress } from "../types";

export interface MountCheckoutOptions extends CreateCheckoutOptions {
    merchantName?: string;
    theme?: "light" | "dark";
}

export interface CheckoutHandle {
    controller: CheckoutController;
    unmount(): void;
}

/**
 * Mounts the KuluPay checkout UI into a container element.
 * Framework-agnostic: works in React, Vue, Svelte, or plain HTML.
 *
 * For onchain payments, this renders a loading state and redirects to
 * the AppKit-based checkout. For redirect providers (Stripe, Chapa),
 * it renders the redirect button.
 */
export function mountCheckout(container: HTMLElement, options: MountCheckoutOptions): CheckoutHandle {
    const controller = createCheckout(options);
    const theme = options.theme || "light";
    const c = theme === "light" ? LIGHT : DARK;

    const render = (state: CheckoutState) => {
        container.innerHTML = template(state, options, c);
        bindEvents(container, controller);
    };

    const unsubscribe = controller.state.subscribe(render);
    controller.init();

    return {
        controller,
        unmount() {
            unsubscribe();
            controller.destroy();
            container.innerHTML = "";
        },
    };
}

interface Colors {
    bg: string; card: string; border: string; text: string; textMuted: string; textFaint: string;
    hover: string; selected: string; accent: string; accentText: string; danger: string; dangerBg: string;
    success: string; successBg: string; warn: string; warnBg: string; warnBorder: string;
}

const LIGHT: Colors = {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", text: "#111827", textMuted: "#6b7280", textFaint: "#9ca3af",
    hover: "#f9fafb", selected: "#f3f4f6", accent: "#2563eb", accentText: "#ffffff", danger: "#dc2626", dangerBg: "#fef2f2",
    success: "#16a34a", successBg: "#f0fdf4", warn: "#a16207", warnBg: "#fefce8", warnBorder: "#fde68a",
};

const DARK: Colors = {
    bg: "#09090b", card: "#18181b", border: "#27272a", text: "#fafafa", textMuted: "#a1a1aa", textFaint: "#71717a",
    hover: "#1f1f23", selected: "#27272a", accent: "#3b82f6", accentText: "#ffffff", danger: "#ff6b6b", dangerBg: "#2a0d0d",
    success: "#22c55e", successBg: "#0a1f0a", warn: "#a8a060", warnBg: "#1a1505", warnBorder: "#3a3010",
};

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function headerAmount(state: CheckoutState, options: MountCheckoutOptions): string {
    const intent = state.intent;
    if (!intent) return "";
    const symbol = intent.token?.symbol;
    const amountText = symbol
        ? `${(intent.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${symbol}`
        : formatAmount(intent.amount, intent.currency);
    const to = options.merchantName ? ` to ${esc(options.merchantName)}` : "";
    return `Pay ${amountText}${to}`;
}

function centered(c: Colors, inner: string): string {
    return `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:${c.bg};padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <div style="width:100%;max-width:440px;background:${c.card};border-radius:16px;border:1px solid ${c.border};padding:32px;text-align:center">
        ${inner}
      </div>
    </div>`;
}

function template(state: CheckoutState, options: MountCheckoutOptions, c: Colors): string {
    if (state.step === "loading") {
        return centered(c, `
          <div style="width:32px;height:32px;border:3px solid ${c.border};border-top-color:${c.accent};border-radius:50%;margin:0 auto 16px;animation:kp-spin 1s linear infinite"></div>
          <p style="color:${c.textMuted};font-size:15px;margin:0">Loading checkout...</p>
          <style>@keyframes kp-spin{to{transform:rotate(360deg)}}</style>`);
    }

    if (state.step === "error") {
        return centered(c, `
          <div style="font-size:40px;margin-bottom:12px">⚠</div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:${c.text}">Checkout Error</h1>
          <p style="color:${c.textMuted};font-size:14px;line-height:1.5;margin:0">${esc(state.error || "Something went wrong")}</p>`);
    }

    if (state.step === "succeeded") {
        return centered(c, `
          <div style="font-size:48px;margin-bottom:16px;color:${c.success}">✓</div>
          <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;color:${c.text}">Payment Succeeded</h1>
          <p style="color:${c.textMuted};font-size:15px;margin:0">${headerAmount(state, options)}</p>
          ${state.txHash ? `<p style="color:${c.textFaint};font-size:12px;margin:12px 0 0;word-break:break-all;font-family:monospace">TX: ${esc(state.txHash)}</p>` : ""}`);
    }

    if (state.step === "expired") {
        return centered(c, `
          <div style="font-size:48px;margin-bottom:16px">⏰</div>
          <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;color:${c.text}">Payment Expired</h1>
          <p style="color:${c.textMuted};font-size:14px;line-height:1.5;margin:0">This payment link has expired. Please create a new one.</p>`);
    }

    if (state.step === "failed") {
        return centered(c, `
          <div style="font-size:48px;margin-bottom:16px;color:${c.danger}">✕</div>
          <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;color:${c.text}">Payment Failed</h1>
          <p style="color:${c.textMuted};font-size:14px;line-height:1.5;margin:0">${esc(state.error || "The payment could not be completed.")}</p>`);
    }

    if (state.step === "pending-confirmation") {
        return centered(c, `
          <div style="width:32px;height:32px;border:3px solid ${c.border};border-top-color:${c.accent};border-radius:50%;margin:0 auto 16px;animation:kp-spin 1s linear infinite"></div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:${c.text}">Waiting for confirmations</h1>
          <p style="color:${c.textMuted};font-size:14px;margin:0">Your transaction has been submitted and is being confirmed on-chain.</p>
          ${state.txHash ? `<p style="color:${c.textFaint};font-size:12px;margin:12px 0 0;word-break:break-all;font-family:monospace">TX: ${esc(shortenAddress(state.txHash, 12))}</p>` : ""}
          <style>@keyframes kp-spin{to{transform:rotate(360deg)}}</style>`);
    }

    if (state.step === "redirect") {
        const providerId = state.intent?.providerId || "";
        const providerName = providerId.includes("stripe") ? "Stripe" : providerId.includes("chapa") ? "Chapa" : providerId.includes("paypal") ? "PayPal" : providerId;
        return centered(c, `
          <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:${c.text}">${headerAmount(state, options)}</h1>
          <button data-kp-action="redirect" style="width:100%;padding:16px 24px;border-radius:12px;border:none;background:${c.accent};color:${c.accentText};font-size:16px;font-weight:700;cursor:pointer">
            Continue with ${esc(providerName)}
          </button>
          ${state.error ? `<div style="margin-top:16px;padding:14px;background:${c.dangerBg};border-radius:12px;font-size:13px;color:${c.danger}">${esc(state.error)}</div>` : ""}
          <p style="margin:16px 0 0;font-size:12px;color:${c.textFaint}">You will be redirected to ${esc(providerName)} to complete your payment.</p>`);
    }

    // onchain: AppKit handles wallet connection — show info message
    if (state.step === "onchain") {
        return centered(c, `
          <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:${c.text}">${headerAmount(state, options)}</h1>
          <p style="color:${c.textMuted};font-size:14px;line-height:1.5;margin:0 0 20px">This is an onchain payment. Use the KuluPayAppKitProvider React component or the AppKit checkout to connect your wallet and pay.</p>
          <div style="padding:14px;background:${c.warnBg};border:1px solid ${c.warnBorder};border-radius:10px;font-size:12px;color:${c.warn};line-height:1.5;text-align:left">
            The vanilla JS checkout UI does not support onchain payments directly. Use the React integration with KuluPayAppKitProvider for wallet connection.
          </div>`);
    }

    return centered(c, `<p style="color:${c.textMuted};font-size:14px">Unknown checkout state</p>`);
}

function bindEvents(container: HTMLElement, controller: CheckoutController) {
    container.querySelector<HTMLElement>('[data-kp-action="redirect"]')?.addEventListener("click", () => controller.redirect());
}
