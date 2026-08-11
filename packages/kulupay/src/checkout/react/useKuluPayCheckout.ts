"use client";

import { useEffect, useState, useCallback } from "react";
import { useKuluPayAppKitStatus } from "../../integrations/appkit-react";
import type { CheckoutIntentData } from "../types";

export interface KuluPayCheckoutProps {
    client: any;
    intentId: string;
    clientSecret: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: Error) => void;
}

type Status = "loading" | "ready" | "connecting" | "sending" | "confirming" | "success" | "error" | "expired";

export function useKuluPayCheckout(props: {
    client: any;
    intentId: string;
    clientSecret: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: Error) => void;
}) {
    const { initFromChains, appKit, isLoading: appKitLoading } = useKuluPayAppKitStatus();

    const [intent, setIntent] = useState<CheckoutIntentData | null>(null);
    const [status, setStatus] = useState<Status>("loading");
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data, error: err } = await props.client.checkoutIntent({
                    intentId: props.intentId,
                    clientSecret: props.clientSecret,
                });
                if (cancelled) return;
                if (err) throw new Error(err.message || "Failed to load payment");
                setIntent(data);
                if (data.status === "succeeded") {
                    setTxHash(data.txHash ?? null);
                    setStatus("success");
                } else if (data.status === "expired") {
                    setStatus("expired");
                } else {
                    setStatus("ready");
                }
            } catch (e: any) {
                if (cancelled) return;
                const serverMsg = e?.context?.message ?? e?.message;
                setError(serverMsg || "Failed to load payment");
                setStatus("error");
            }
        })();
        return () => { cancelled = true; };
    }, [props.client, props.intentId, props.clientSecret]);

    useEffect(() => {
        if (intent?.chainConfig) initFromChains([intent.chainConfig]);
    }, [intent?.chainConfig, initFromChains]);

    useEffect(() => {
        if (!appKit) return;
        const update = () => {
            const now = appKit.isConnected();
            if (now && !connected) {
                try { appKit.close(); } catch {}
            }
            setConnected(now);
            setAddress(appKit.getAddress());
        };
        update();
        const unsub = appKit.subscribeProvider(update);
        const interval = setInterval(update, 1000);
        return () => {
            if (typeof unsub === "function") (unsub as any)();
            clearInterval(interval);
        };
    }, [appKit, connected]);

    const connect = useCallback(async () => {
        setStatus("connecting");
        setError(null);
        try {
            await props.client.onchain.connectWallet();
        } catch (e: any) {
            setError(e?.message ?? "Failed to connect wallet");
        } finally {
            setStatus("ready");
        }
    }, [props.client]);

    const pay = useCallback(async () => {
        if (!intent) return;
        setStatus("sending");
        setError(null);
        try {
            const result = await props.client.onchain.sendPayment(intent);
            setTxHash(result.txHash);
            setStatus("confirming");

            // Broadcast succeeded — poll the server until the tx is actually
            // confirmed on-chain before reporting success.
            const deadline = Date.now() + 5 * 60 * 1000;
            let confirmedStatus: string | null = null;
            while (Date.now() < deadline) {
                const { data } = await props.client.verifyIntent({
                    intentId: props.intentId,
                    clientSecret: props.clientSecret,
                });
                if (data?.status === "succeeded" || data?.status === "failed") {
                    confirmedStatus = data.status;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }

            if (confirmedStatus === "failed") {
                setError("Transaction failed to confirm on-chain.");
                setStatus("ready");
                props.onError?.(new Error("Transaction failed to confirm on-chain"));
                return;
            }

            if (confirmedStatus !== "succeeded") {
                setError("Transaction confirmation timed out. The payment may still be processing — check your wallet or block explorer.");
                setStatus("ready");
                props.onError?.(new Error("Transaction confirmation timed out"));
                return;
            }

            setStatus("success");
            props.onSuccess?.(result.txHash);
        } catch (e: any) {
            const details = e?.context?.details ?? e?.message ?? "Transaction failed";
            const lower = String(details).toLowerCase();
            if (lower.includes("not unlocked") || lower.includes("not authorized")) {
                setError("Your wallet is locked. Unlock it and try again.");
                setConnected(false);
            } else if (lower.includes("rejected") || lower.includes("denied")) {
                setError("Transaction rejected.");
            } else {
                setError(details);
            }
            setStatus("ready");
            props.onError?.(e instanceof Error ? e : new Error(String(details)));
        }
    }, [props.client, intent, props.onSuccess, props.onError]);

    const disconnect = useCallback(() => {
        try { props.client.onchain.disconnect(); } catch {}
    }, [props.client]);

    return {
        intent,
        status,
        error,
        txHash,
        connected,
        address,
        connect,
        pay,
        disconnect,
        appKitLoading,
    };
}
