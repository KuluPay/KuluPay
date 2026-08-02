import type { CheckoutConfig, CheckoutState, WalletInfo } from "./types";
import { detectWallets, getProviderType } from "./wallet-picker";

type Listener = (state: CheckoutState) => void;

export class CheckoutController {
    private config: CheckoutConfig;
    private state: CheckoutState;
    private listeners: Set<Listener> = new Set();
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private apiBase: string;

    constructor(config: CheckoutConfig, apiBase?: string) {
        this.config = config;
        this.apiBase = apiBase || "/api/pay";

        const providerType = getProviderType(config.providerId);
        const { wallets } = detectWallets(providerType);

        this.state = {
            status: "idle",
            amount: config.amount,
            tokenSymbol: config.token.symbol,
            recipient: config.recipient,
            timeRemaining: Math.max(0, Math.floor((config.deadline - Date.now()) / 1000)),
            walletConnected: false,
            connectedWallet: null,
            availableWallets: wallets,
            txHash: null,
            confirmations: null,
            error: null,
        };
    }

    getState(): CheckoutState {
        return { ...this.state };
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private setState(updates: Partial<CheckoutState>) {
        this.state = { ...this.state, ...updates };
        for (const listener of this.listeners) {
            listener(this.getState());
        }
    }

    startCountdown() {
        if (this.countdownInterval) return;
        this.countdownInterval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((this.config.deadline - Date.now()) / 1000));
            this.setState({ timeRemaining: remaining });
            if (remaining === 0 && this.state.status !== "succeeded" && this.state.status !== "failed") {
                this.setState({ status: "expired" });
                this.config.onExpired?.();
                this.stopCountdown();
                this.stopPolling();
            }
        }, 1000);
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    async connectWallet(walletId: string): Promise<void> {
        const wallet = this.state.availableWallets.find((w) => w.id === walletId);
        if (!wallet) {
            this.setState({ error: `Wallet ${walletId} not found` });
            return;
        }

        this.setState({ status: "connecting", error: null });

        try {
            if (wallet.type === "evm") {
                const eth = (globalThis as any).ethereum;
                if (!eth) throw new Error("No EVM wallet found");
                await eth.request({ method: "eth_requestAccounts" });
            } else if (wallet.type === "tron") {
                const tl = (globalThis as any).tronLink;
                if (tl?.request) {
                    await tl.request({ method: "tron_requestAccounts" });
                }
            }

            this.setState({
                status: "idle",
                walletConnected: true,
                connectedWallet: wallet.name,
            });
        } catch (err: any) {
            this.setState({
                status: "idle",
                error: err?.message || "Failed to connect wallet",
            });
        }
    }

    async pay(): Promise<void> {
        if (!this.state.walletConnected) {
            this.setState({ error: "Connect a wallet first" });
            return;
        }

        this.setState({ status: "paying", error: null });

        try {
            const providerType = getProviderType(this.config.providerId);
            let txHash: string;

            if (providerType === "evm") {
                txHash = await this.sendEVMPayment();
            } else {
                txHash = await this.sendTronPayment();
            }

            this.setState({ txHash, status: "confirming" });

            await this.confirmWithServer(txHash);
            this.startPolling();
        } catch (err: any) {
            this.setState({
                status: "failed",
                error: err?.message || "Payment failed",
            });
            this.config.onFailed?.(err?.message || "Payment failed");
        }
    }

    private async sendEVMPayment(): Promise<string> {
        const eth = (globalThis as any).ethereum;
        if (!eth) throw new Error("No EVM wallet found");

        const accounts = await eth.request({ method: "eth_accounts" });
        const from = accounts[0];

        const { recipient, token, amount, contractAddress, signature } = this.config;

        if (contractAddress && signature) {
            throw new Error("Smart contract payments not yet supported in this version");
        }

        if (!token.contractAddress) {
            const hexValue = "0x" + BigInt(amount).toString(16);
            return await eth.request({
                method: "eth_sendTransaction",
                params: [{ from, to: recipient, value: hexValue }],
            });
        }

        const decimals = token.decimals || 18;
        const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
        const transferData = "0xa9059cbb"
            + recipient.slice(2).padStart(64, "0")
            + rawAmount.toString(16).padStart(64, "0");

        return await eth.request({
            method: "eth_sendTransaction",
            params: [{ from, to: token.contractAddress, value: "0x0", data: transferData }],
        });
    }

    private async sendTronPayment(): Promise<string> {
        const tw = (globalThis as any).tronWeb;
        if (!tw) throw new Error("No Tron wallet found");

        const from = tw.defaultAddress.base58;
        const { recipient, token, amount } = this.config;

        if (!token.contractAddress) {
            const result = await tw.trx.sendTransaction(recipient, parseInt(amount));
            return typeof result === "string" ? result : result?.txid || result?.txID || "";
        }

        const decimals = token.decimals || 6;
        const rawAmount = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

        const { transaction } = await tw.transactionBuilder.triggerSmartContract(
            token.contractAddress,
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

    private async confirmWithServer(txHash: string): Promise<void> {
        try {
            const res = await fetch(`${this.apiBase}/confirm-intent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    intentId: this.config.intentId,
                    txHash,
                    clientSecret: this.config.clientSecret,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error?.message || "Failed to confirm with server");
            }
        } catch (err) {
            throw err;
        }
    }

    private startPolling() {
        if (this.pollInterval) return;
        this.pollInterval = setInterval(async () => {
            await this.verifyWithServer();
        }, 5000);
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private async verifyWithServer(): Promise<void> {
        try {
            const params = new URLSearchParams({
                intentId: this.config.intentId,
                clientSecret: this.config.clientSecret,
            });
            const res = await fetch(`${this.apiBase}/verify-intent?${params}`, {
                credentials: "include",
            });

            if (!res.ok) return;

            const data = await res.json();

            if (data.confirmations) {
                this.setState({ confirmations: data.confirmations });
            }

            if (data.status === "succeeded") {
                this.setState({ status: "succeeded", txHash: data.txHash || this.state.txHash });
                this.stopPolling();
                this.stopCountdown();
                this.config.onSuccess?.(data.txHash || this.state.txHash || "");
            } else if (data.status === "failed") {
                this.setState({ status: "failed", error: "Payment failed on-chain" });
                this.stopPolling();
                this.config.onFailed?.("Payment failed on-chain");
            } else if (data.status === "expired") {
                this.setState({ status: "expired" });
                this.stopPolling();
                this.stopCountdown();
                this.config.onExpired?.();
            }
        } catch {
            // Silently retry on next poll
        }
    }

    destroy() {
        this.stopPolling();
        this.stopCountdown();
        this.listeners.clear();
    }
}
