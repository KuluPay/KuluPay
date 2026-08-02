import type { WalletInfo } from "./types";

interface WalletDetectionResult {
    wallets: WalletInfo[];
    hasEVM: boolean;
    hasTron: boolean;
}

const EVM_WALLETS: Omit<WalletInfo, "installed">[] = [
    { id: "metamask", name: "MetaMask", type: "evm" },
    { id: "coinbase", name: "Coinbase Wallet", type: "evm" },
    { id: "rabby", name: "Rabby", type: "evm" },
    { id: "rainbow", name: "Rainbow", type: "evm" },
    { id: "okx", name: "OKX Wallet", type: "evm" },
    { id: "trust", name: "Trust Wallet", type: "evm" },
];

const TRON_WALLETS: Omit<WalletInfo, "installed">[] = [
    { id: "tronlink", name: "TronLink", type: "tron" },
];

function detectEVMWallets(): WalletInfo[] {
    if (typeof globalThis === "undefined") return [];
    const eth = (globalThis as any).ethereum;
    if (!eth) return [];

    const detected: WalletInfo[] = [];
    const providers = eth.providers || [eth];

    for (const w of EVM_WALLETS) {
        const isInstalled = providers.some((p: any) => {
            if (w.id === "metamask") return p.isMetaMask;
            if (w.id === "coinbase") return p.isCoinbaseWallet;
            if (w.id === "rabby") return p.isRabby;
            if (w.id === "rainbow") return p.isRainbow;
            if (w.id === "okx") return p.isOKExWallet || p.isOkxWallet;
            if (w.id === "trust") return p.isTrustWallet || p.isTrust;
            return false;
        });
        detected.push({ ...w, installed: isInstalled });
    }

    if (detected.length === 0 && eth) {
        detected.push({ id: "evm-generic", name: "Browser Wallet", type: "evm", installed: true });
    }

    return detected;
}

function detectTronWallets(): WalletInfo[] {
    if (typeof globalThis === "undefined") return [];
    const tw = (globalThis as any).tronWeb;
    const tl = (globalThis as any).tronLink;

    return TRON_WALLETS.map((w) => ({
        ...w,
        installed: !!(tw || tl),
    }));
}

export function detectWallets(providerType?: "evm" | "tron"): WalletDetectionResult {
    const evmWallets = providerType === "tron" ? [] : detectEVMWallets();
    const tronWallets = providerType === "evm" ? [] : detectTronWallets();

    return {
        wallets: [...evmWallets, ...tronWallets],
        hasEVM: evmWallets.some((w) => w.installed),
        hasTron: tronWallets.some((w) => w.installed),
    };
}

export function getProviderType(providerId: string): "evm" | "tron" {
    return providerId.startsWith("tron") ? "tron" : "evm";
}
