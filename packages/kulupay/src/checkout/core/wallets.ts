import type { CheckoutIntentData } from "../types";

export interface WalletInfo {
    id: string;
    name: string;
    installed: boolean;
    family: "evm" | "tron";
}

/** Detect available EVM + Tron wallets in the browser. */
export function detectWallets(family: "evm" | "tron"): WalletInfo[] {
    if (typeof window === "undefined") return [];

    if (family === "tron") {
        const tw = (window as any).tronWeb;
        const tl = (window as any).tronLink;
        return [
            { id: "tronlink", name: "TronLink", installed: Boolean(tw || tl), family: "tron" },
        ];
    }

    const eth = (window as any).ethereum;
    const providers: any[] = eth?.providers || (eth ? [eth] : []);
    const has = (check: (p: any) => boolean) => providers.some(check);

    return [
        { id: "metamask", name: "MetaMask", installed: has((p) => p.isMetaMask), family: "evm" },
        { id: "coinbase", name: "Coinbase Wallet", installed: has((p) => p.isCoinbaseWallet), family: "evm" },
        { id: "phantom", name: "Phantom", installed: has((p) => p.isPhantom), family: "evm" },
        { id: "trust", name: "Trust Wallet", installed: has((p) => p.isTrust || p.isTrustWallet), family: "evm" },
        { id: "rabby", name: "Rabby", installed: has((p) => p.isRabby), family: "evm" },
        { id: "rainbow", name: "Rainbow", installed: has((p) => p.isRainbow), family: "evm" },
        { id: "okx", name: "OKX Wallet", installed: has((p) => p.isOKExWallet || p.isOkxWallet), family: "evm" },
    ];
}

function getEvmProvider(walletId: string): any {
    const eth = (window as any).ethereum;
    if (!eth) return null;
    const providers: any[] = eth.providers || [eth];
    const match = providers.find((p: any) => {
        if (walletId === "metamask") return p.isMetaMask;
        if (walletId === "coinbase") return p.isCoinbaseWallet;
        if (walletId === "phantom") return p.isPhantom;
        if (walletId === "trust") return p.isTrust || p.isTrustWallet;
        if (walletId === "rabby") return p.isRabby;
        if (walletId === "rainbow") return p.isRainbow;
        if (walletId === "okx") return p.isOKExWallet || p.isOkxWallet;
        return false;
    });
    return match || eth;
}

/** Connect to a wallet, returns the connected address. */
export async function connectWallet(wallet: WalletInfo): Promise<string> {
    if (wallet.family === "tron") {
        const tl = (window as any).tronLink;
        const tw = (window as any).tronWeb;

        if (tl?.request) {
            const res = await tl.request({ method: "tron_requestAccounts" });
            if (res?.code === 4001) throw new Error("Connection rejected");
            await new Promise((r) => setTimeout(r, 500));
        }
        const address = (window as any).tronWeb?.defaultAddress?.base58;
        if (!address) throw new Error("TronLink not found. Please install the TronLink extension.");
        return address;
    }

    const provider = getEvmProvider(wallet.id);
    if (!provider) throw new Error(`${wallet.name} not found. Please install it first.`);
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No account returned by wallet");
    return accounts[0];
}

/** Send the payment transaction. Returns the tx hash. */
export async function sendPayment(
    wallet: WalletInfo,
    address: string,
    intent: CheckoutIntentData,
): Promise<string> {
    const recipient = intent.recipient || intent.raw?.to;
    if (!recipient) throw new Error("Missing recipient address");
    const token = intent.token;

    if (wallet.family === "tron") {
        const tw = (window as any).tronWeb;
        if (!tw) throw new Error("TronWeb not available");
        const from = tw.defaultAddress.base58;

        if (token?.address) {
            const decimals = token.decimals || 6;
            const rawAmount = Math.floor((intent.amount / 100) * Math.pow(10, decimals));
            const { transaction } = await tw.transactionBuilder.triggerSmartContract(
                token.address,
                "transfer(address,uint256)",
                { feeLimit: 100_000_000 },
                [
                    { type: "address", value: recipient },
                    { type: "uint256", value: rawAmount },
                ],
                from,
            );
            const signedTx = await tw.trx.sign(transaction);
            await tw.trx.sendRawTransaction(signedTx);
            return transaction.txID;
        }
        const result = await tw.trx.sendTransaction(recipient, Math.floor(intent.amount / 100));
        return typeof result === "string" ? result : result?.txid || result?.txID || "";
    }

    const provider = getEvmProvider(wallet.id);
    if (!provider) throw new Error("Wallet provider not available");

    if (intent.raw?.data && intent.raw.data !== "0x") {
        return provider.request({
            method: "eth_sendTransaction",
            params: [{
                from: address,
                to: intent.raw.to,
                value: "0x" + BigInt(intent.raw.value || 0).toString(16),
                data: intent.raw.data,
            }],
        });
    }

    if (token?.address) {
        const decimals = token.decimals || 6;
        const rawAmount = BigInt(intent.amount) * BigInt(10 ** (decimals - 2));
        const transferData =
            "0xa9059cbb" +
            recipient.slice(2).padStart(64, "0") +
            rawAmount.toString(16).padStart(64, "0");
        return provider.request({
            method: "eth_sendTransaction",
            params: [{ from: address, to: token.address, value: "0x0", data: transferData }],
        });
    }

    throw new Error("Native token payments require raw transaction data");
}
