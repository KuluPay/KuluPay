import type { CheckoutController, CheckoutState } from "./controller";
import { createCheckout, type CreateCheckoutOptions } from "./controller";
import { formatAmount, shortenAddress } from "../types";

export interface MountCheckoutOptions extends CreateCheckoutOptions {
    /** Merchant / app name shown in the header, e.g. "Pay 10.00 USDC to Acme Inc". */
    merchantName?: string;
    /** Light or dark theme. Default "light". */
    theme?: "light" | "dark";
}

export interface CheckoutHandle {
    controller: CheckoutController;
    unmount(): void;
}

const WALLET_COLORS: Record<string, string> = {
    metamask: "#f6851b",
    coinbase: "#0052ff",
    phantom: "#ab9ff2",
    trust: "#3375bb",
    rabby: "#7084ff",
    rainbow: "#001e59",
    okx: "#000000",
    tronlink: "#eb2f2f",
};

/**
 * Mounts the KuluPay checkout UI into a container element.
 * Framework-agnostic: works in React, Vue, Svelte, or plain HTML.
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

function walletIcon(id: string, name: string): string {
    const color = WALLET_COLORS[id] || "#6b7280";
    const initial = name.charAt(0).toUpperCase();
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${color};color:#fff;font-size:13px;font-weight:700;flex-shrink:0">${initial}</span>`;
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

    // select-wallet / connected / paying: two-pane layout
    return twoPane(state, options, c);
}

function twoPane(state: CheckoutState, options: MountCheckoutOptions, c: Colors): string {
    const intent = state.intent!;
    const selected = state.selectedWallet;
    const recipient = intent.recipient || intent.raw?.to || "";
    const networkName = intent.network?.name || intent.providerId;

    const walletRows = state.wallets.map((w) => {
        const isSelected = selected?.id === w.id;
        return `
        <button data-kp-wallet="${esc(w.id)}" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border:none;border-left:3px solid ${isSelected ? c.accent : "transparent"};background:${isSelected ? c.selected : "transparent"};cursor:pointer;text-align:left">
          ${walletIcon(w.id, w.name)}
          <span style="display:flex;flex-direction:column">
            <span style="font-size:14px;font-weight:600;color:${c.text}">${esc(w.name)}</span>
            ${w.installed ? `<span style="font-size:11px;color:${c.success};font-weight:600">Installed</span>` : `<span style="font-size:11px;color:${c.textFaint}">Not installed</span>`}
          </span>
        </button>`;
    }).join("");

    let rightPane: string;

    if (state.step === "paying") {
        rightPane = `
        <div style="text-align:center;padding:24px 0">
          <div style="width:32px;height:32px;border:3px solid ${c.border};border-top-color:${c.accent};border-radius:50%;margin:0 auto 16px;animation:kp-spin 1s linear infinite"></div>
          <p style="color:${c.textMuted};font-size:14px;margin:0">Confirm the transaction in ${esc(selected?.name || "your wallet")}...</p>
        </div>`;
    } else if (state.step === "connected") {
        rightPane = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:${c.successBg};border:1px solid ${c.border};border-radius:12px;margin-bottom:16px">
            <span style="display:flex;align-items:center;gap:8px">
              <span style="width:8px;height:8px;border-radius:50%;background:${c.success};display:inline-block"></span>
              <span style="color:${c.success};font-size:13px;font-weight:600">Connected</span>
            </span>
            <span style="font-family:monospace;font-size:12px;color:${c.textMuted}">${esc(shortenAddress(state.address || ""))}</span>
          </div>
          ${detailsCard(intent, networkName, recipient, c)}
          <button data-kp-action="pay" style="width:100%;padding:16px 24px;border-radius:12px;border:none;background:${c.accent};color:${c.accentText};font-size:16px;font-weight:700;cursor:pointer">
            Pay ${headerAmountShort(intent)}
          </button>
        </div>`;
    } else {
        // select-wallet
        const installed = selected?.installed;
        rightPane = `
        <div style="text-align:center">
          <p style="color:${c.text};font-size:14px;font-weight:500;margin:0 0 20px;line-height:1.5">
            ${installed
                ? `Connect with ${esc(selected!.name)} to confirm payment`
                : selected
                    ? `${esc(selected.name)} is not installed in this browser`
                    : "Select a wallet to continue"}
          </p>
          ${detailsCard(intent, networkName, recipient, c)}
          <button data-kp-action="connect" ${!selected ? "disabled" : ""} style="width:100%;padding:14px 24px;border-radius:12px;border:1px solid ${c.accent};background:${installed ? c.accent : "transparent"};color:${installed ? c.accentText : c.accent};font-size:15px;font-weight:600;cursor:pointer">
            ${installed ? "Launch extension ↗" : "Try to connect anyway"}
          </button>
        </div>`;
    }

    return `
    <div style="min-height:100vh;background:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <div style="border-bottom:1px solid ${c.border};padding:20px;text-align:center">
        <h1 style="font-size:16px;font-weight:700;margin:0;color:${c.text}">${headerAmount(state, options)}</h1>
        ${intent.description ? `<p style="font-size:13px;color:${c.textMuted};margin:4px 0 0">${esc(intent.description)}</p>` : ""}
      </div>
      <div style="display:flex;align-items:flex-start;justify-content:center;padding:48px 16px">
        <div style="display:flex;width:100%;max-width:720px;background:${c.card};border:1px solid ${c.border};border-radius:12px;overflow:hidden;min-height:360px;flex-wrap:wrap">
          <div style="flex:1 1 220px;border-right:1px solid ${c.border}">
            <div style="padding:16px;border-bottom:1px solid ${c.border}">
              <span style="font-size:14px;font-weight:700;color:${c.text}">Select a wallet</span>
            </div>
            ${walletRows}
          </div>
          <div style="flex:1.4 1 300px;padding:32px 28px;display:flex;flex-direction:column;justify-content:center">
            ${rightPane}
            ${state.error ? `<div style="margin-top:16px;padding:14px;background:${c.dangerBg};border-radius:12px;font-size:13px;color:${c.danger};line-height:1.5">${esc(state.error)}</div>` : ""}
          </div>
        </div>
      </div>
      <div style="max-width:720px;margin:0 auto;padding:0 16px 32px">
        <div style="padding:12px 14px;background:${c.warnBg};border:1px solid ${c.warnBorder};border-radius:10px;font-size:12px;color:${c.warn};line-height:1.5">
          ⚠ Send the exact amount. No refunds for wrong amounts or wrong chains.
        </div>
      </div>
      <style>@keyframes kp-spin{to{transform:rotate(360deg)}}</style>
    </div>`;
}

function headerAmountShort(intent: { amount: number; currency: string; token?: any }): string {
    const symbol = intent.token?.symbol;
    return symbol
        ? `${(intent.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${symbol}`
        : formatAmount(intent.amount, intent.currency);
}

function detailsCard(intent: any, networkName: string, recipient: string, c: Colors): string {
    return `
    <div style="text-align:left;padding:14px 16px;background:${c.hover};border:1px solid ${c.border};border-radius:12px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;padding:5px 0">
        <span style="color:${c.textFaint};font-size:13px">Network</span>
        <span style="color:${c.text};font-size:13px;font-weight:600;text-transform:capitalize">${esc(networkName)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0">
        <span style="color:${c.textFaint};font-size:13px">Recipient</span>
        <span style="color:${c.text};font-size:12px;font-family:monospace">${esc(shortenAddress(recipient))}</span>
      </div>
      ${intent.token?.symbol ? `
      <div style="display:flex;justify-content:space-between;padding:5px 0">
        <span style="color:${c.textFaint};font-size:13px">Token</span>
        <span style="color:${c.text};font-size:13px;font-weight:600">${esc(intent.token.symbol)}</span>
      </div>` : ""}
    </div>`;
}

function bindEvents(container: HTMLElement, controller: CheckoutController) {
    container.querySelectorAll<HTMLElement>("[data-kp-wallet]").forEach((el) => {
        el.addEventListener("click", () => controller.selectWallet(el.dataset.kpWallet!));
    });
    container.querySelector<HTMLElement>('[data-kp-action="connect"]')?.addEventListener("click", () => controller.connect());
    container.querySelector<HTMLElement>('[data-kp-action="pay"]')?.addEventListener("click", () => controller.pay());
    container.querySelector<HTMLElement>('[data-kp-action="redirect"]')?.addEventListener("click", () => controller.redirect());
}
