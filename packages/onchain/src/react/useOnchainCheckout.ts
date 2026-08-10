"use client";

import { useState, useEffect, useCallback } from "react";

export interface OnchainAppKitLike {
    isConnected: () => boolean;
    open: () => void;
    close: () => void;
    subscribeProvider: (handler: (state: any) => void) => (() => void) | void;
    getAddress: () => string | null;
    getChainId: () => number | string | undefined;
    getBalance: (address?: string) => Promise<{ formatted: string; symbol: string; value: bigint } | null>;
    sendEVMTx: (tx: { to: string; value: bigint; data?: string }) => Promise<string>;
    switchChain: (chainId: number) => Promise<void>;
    disconnect: () => void;
    modal: { getWalletProvider: () => any };
}

export interface UseOnchainCheckoutOptions {
    client: {
        onchain: {
            connectWallet: () => Promise<void>;
            sendPayment: (intent: any) => Promise<{ txHash: string; status: "confirmed" | "pending" }>;
            disconnect: () => void;
            isConnected: () => boolean;
        };
    };
    appKit: OnchainAppKitLike | null;
}

export interface UseOnchainCheckoutResult {
    connected: boolean;
    connecting: boolean;
    sending: boolean;
    error: string | null;
    connect: () => Promise<void>;
    pay: (intent: any) => Promise<{ txHash: string; status: "confirmed" | "pending" }>;
    disconnect: () => void;
}

export function useOnchainCheckout({ client, appKit }: UseOnchainCheckoutOptions): UseOnchainCheckoutResult {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!appKit) return;
        const update = () => setConnected(appKit.isConnected());
        update();
        const unsub = appKit.subscribeProvider(update);
        const interval = setInterval(update, 1000);
        return () => {
            unsub?.();
            clearInterval(interval);
        };
    }, [appKit]);

    const connect = useCallback(async () => {
        setConnecting(true);
        setError(null);
        try {
            await client.onchain.connectWallet();
        } catch (err: any) {
            setError(err?.message ?? "Failed to connect wallet");
        } finally {
            setConnecting(false);
        }
    }, [client]);

    const pay = useCallback(async (intent: any) => {
        setSending(true);
        setError(null);
        try {
            return await client.onchain.sendPayment(intent);
        } catch (err: any) {
            const details = err?.context?.details ?? err?.developerMessage ?? err?.message ?? "Transaction failed";
            const msg = details.toLowerCase();
            if (msg.includes("not unlocked") || msg.includes("not authorized") || msg.includes("unauthorized")) {
                setError("Wallet is locked. Please unlock your wallet and try again.");
                setConnected(false);
                try { await client.onchain.connectWallet(); } catch {}
            } else {
                setError(details);
            }
            throw err;
        } finally {
            setSending(false);
        }
    }, [client]);

    const disconnect = useCallback(() => {
        try {
            client.onchain.disconnect();
            setConnected(false);
        } catch (err: any) {
            setError(err?.message ?? "Failed to disconnect");
        }
    }, [client]);

    return {
        connected,
        connecting,
        sending,
        error,
        connect,
        pay,
        disconnect,
    };
}
