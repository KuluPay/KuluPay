"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAppKit, useAppKitAccount, useAppKitBalance, useAppKitNetwork } from "@reown/appkit/react";
import { useSendTransaction, useSwitchChain } from "wagmi";
import type { PaymentIntent } from "@kulupay/core";
import { useKuluPayAppKitStatus } from "../integrations/appkit-react";
import type { ProviderChainConfig } from "@kulupay/core";
import {
    type CheckoutIntentData,
    type PayClientLike,
    formatTokenAmount,
    shortenAddress,
    timeRemaining,
} from "./types";

export interface AppKitCheckoutProps {
    /** The payment intent from the server (createIntent response) */
    intent: CheckoutIntentData;
    /** The KuluPay client (from createPayClient) */
    client: PayClientLike & {
        confirmIntent: (opts: { body: { intentId: string; txHash: string; clientSecret: string } }) => Promise<{ data: any; error: any }>;
        verifyIntent: (opts: { intentId: string; clientSecret: string }) => Promise<{ data: any; error: any }>;
    };
    /** Called when payment status changes */
    onStatusChange?: (status: string, txHash?: string) => void;
    /** Called when transaction is confirmed on-chain */
    onConfirmed?: (txHash: string) => void;
    /** Called on error */
    onError?: (error: Error) => void;
    /** Custom button text */
    connectButtonText?: string;
    payButtonText?: string;
    /** Show countdown timer if intent has deadline */
    showTimer?: boolean;
}

type CheckoutState = "idle" | "connecting" | "sending" | "confirming" | "confirmed" | "error";

function getTokenRawAmount(intent: CheckoutIntentData): string {
    const converted = intent.metadata?.priceConversion?.cryptoAmount;
    if (converted) return converted.toString();
    if (intent.raw?.value && intent.raw.value !== "0") return intent.raw.value;
    if (
        intent.raw?.data &&
        typeof intent.raw.data === "string" &&
        intent.raw.data.startsWith("0xa9059cbb") &&
        intent.raw.data.length >= 138
    ) {
        // ERC-20 transfer(address,uint256): parse amount from last 32 bytes
        return BigInt(`0x${intent.raw.data.slice(-64)}`).toString();
    }
    return "";
}

function resolveTokenInfo(intent: CheckoutIntentData): { symbol: string; decimals: number } {
    // 1. Direct token field
    if (intent.token?.symbol && intent.token?.decimals) {
        return { symbol: intent.token.symbol, decimals: intent.token.decimals };
    }
    // 2. Metadata token
    if (intent.metadata?.token?.symbol && intent.metadata?.token?.decimals) {
        return { symbol: intent.metadata.token.symbol, decimals: intent.metadata.token.decimals };
    }
    // 3. Raw tokenSymbol (set by EVM provider)
    if (intent.raw?.tokenSymbol) {
        // Try to find matching token in chainConfig for decimals
        const chainTokens = intent.chainConfig?.tokens as any;
        if (chainTokens) {
            for (const key of Object.keys(chainTokens)) {
                const t = chainTokens[key];
                if (t?.symbol === intent.raw.tokenSymbol) {
                    return { symbol: t.symbol, decimals: t.decimals };
                }
            }
        }
        return { symbol: intent.raw.tokenSymbol, decimals: 18 };
    }
    // 4. ChainConfig tokens (first token)
    if (intent.chainConfig?.tokens) {
        const tokens = intent.chainConfig.tokens as any;
        for (const key of Object.keys(tokens)) {
            const t = tokens[key];
            if (t?.symbol && t?.decimals) {
                return { symbol: t.symbol, decimals: t.decimals };
            }
        }
    }
    return { symbol: "", decimals: 18 };
}

export function KuluPayCheckout(props: AppKitCheckoutProps) {
    const { appKit, isLoading: appKitLoading, error: appKitError, initFromChains } = useKuluPayAppKitStatus();

    // Initialize AppKit lazily from the intent's chainConfig
    useEffect(() => {
        if (!appKit && !appKitLoading && !appKitError && props.intent.chainConfig) {
            initFromChains([props.intent.chainConfig as ProviderChainConfig]);
        }
    }, [appKit, appKitLoading, appKitError, initFromChains, props.intent]);

    const tokenAmount = getTokenRawAmount(props.intent);
    const { symbol: tokenSymbol, decimals: tokenDecimals } = resolveTokenInfo(props.intent);
    const displayAmount = tokenAmount ? formatTokenAmount(tokenAmount, tokenDecimals) : "";

    if (appKitError) {
        return (
            <div style={sectionStyle}>
                <div style={errorBoxStyle}>
                    {warningIconSvg}
                    <span>Failed to initialize wallet: {appKitError.message}</span>
                </div>
            </div>
        );
    }

    if (!props.intent.chainConfig) {
        return (
            <div style={sectionStyle}>
                <div style={errorBoxStyle}>
                    {warningIconSvg}
                    <span>No chain configuration available for this payment.</span>
                </div>
            </div>
        );
    }

    if (!appKit || appKitLoading) {
        return (
            <div style={sectionStyle}>
                <div style={loadingRowStyle}>
                    <div style={miniSpinnerStyle} />
                    <span style={{ color: "#a1a1aa", fontSize: 14 }}>Initializing wallet...</span>
                </div>
            </div>
        );
    }

    return <KuluPayCheckoutInner {...props} />;
}

function KuluPayCheckoutInner({
    intent,
    client,
    onStatusChange,
    onConfirmed,
    onError,
    connectButtonText = "Connect Wallet",
    payButtonText = "Pay",
    showTimer = true,
}: AppKitCheckoutProps) {
    const { open } = useAppKit();
    const { isConnected, address } = useAppKitAccount();
    const { fetchBalance } = useAppKitBalance();
    const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();
    const { switchChainAsync } = useSwitchChain();
    const { appKit } = useKuluPayAppKitStatus();
    const network = useAppKitNetwork();

    const [state, setState] = useState<CheckoutState>("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<{ formatted: string; symbol: string } | null>(null);
    const [polling, setPolling] = useState(false);

    const isTron = intent.metadata?.family === "tron";
    const { symbol: tokenSymbol, decimals: tokenDecimals } = resolveTokenInfo(intent);
    const token = intent.token ?? intent.metadata?.token ?? null;
    const raw = intent.raw;
    const tokenAmount = getTokenRawAmount(intent);
    const displayAmount = tokenAmount ? formatTokenAmount(tokenAmount, tokenDecimals) : "";

    // Reset "connecting" state once wallet actually connects
    useEffect(() => {
        if (isConnected && state === "connecting") {
            setState("idle");
        }
    }, [isConnected, state]);

    // Fetch balance when connected
    useEffect(() => {
        if (isConnected && address) {
            fetchBalance().then((res: any) => {
                if (res?.data) {
                    setBalance({ formatted: res.data.formatted, symbol: res.data.symbol });
                }
            }).catch(() => {});
        } else {
            setBalance(null);
        }
    }, [isConnected, address, fetchBalance]);

    // Poll for confirmation after txHash is submitted
    const pollForConfirmation = useCallback(async () => {
        if (polling || !txHash || !intent.clientSecret) return;
        setPolling(true);

        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const result = await client.verifyIntent({
                    intentId: intent.id,
                    clientSecret: intent.clientSecret,
                });
                if (result?.data?.status === "succeeded") {
                    setState("confirmed");
                    onStatusChange?.("succeeded", txHash);
                    onConfirmed?.(txHash);
                    setPolling(false);
                    return;
                }
                if (result?.data?.status === "failed") {
                    setState("error");
                    setError("Payment failed on-chain verification");
                    onStatusChange?.("failed", txHash);
                    onError?.(new Error("Payment failed"));
                    setPolling(false);
                    return;
                }
            } catch {
                // Continue polling
            }
            await new Promise((r) => setTimeout(r, 3000));
        }
        setPolling(false);
    }, [polling, txHash, intent.id, intent.clientSecret, client, onStatusChange, onConfirmed, onError]);

    useEffect(() => {
        if (txHash && state === "confirming") {
            pollForConfirmation();
        }
    }, [txHash, state, pollForConfirmation]);

    const handlePay = async () => {
        if (!appKit) {
            setError("AppKit is not initialized yet");
            setState("error");
            return;
        }

        if (!isConnected) {
            setState("connecting");
            open();
            return;
        }

        if (!raw) {
            setError("No transaction data in intent");
            setState("error");
            onError?.(new Error("No transaction data in intent"));
            return;
        }

        setState("sending");
        setError(null);

        try {
            let hash: string = "";

            if (!isTron && intent.chainConfig) {
                const targetChainId = intent.chainConfig.chainId;
                const currentChainId = network?.chainId;
                if (currentChainId !== targetChainId) {
                    await switchChainAsync({ chainId: targetChainId });
                }
            }

            if (isTron) {
                // Tron: use TronWeb injected by TronLink to build, sign, and broadcast
                const tronWeb = (window as any).tron?.tronWeb;
                if (!tronWeb) throw new Error("TronLink not found — please install TronLink extension");
                if (!tronWeb.ready) throw new Error("TronLink not connected — please unlock and authorize");

                const fromAddress = tronWeb.defaultAddress.base58;
                const toAddress = raw.to;
                const amount = BigInt(raw.amount);

                let unsignedTx: any;
                if (raw.isNative) {
                    // Native TRX transfer
                    unsignedTx = await tronWeb.transactionBuilder.sendTrx(toAddress, amount.toString(), fromAddress);
                } else {
                    // TRC-20 transfer: trigger smart contract
                    const contractAddress = raw.contractAddress;
                    const contract = await tronWeb.contract().at(contractAddress);
                    // Use the contract's transfer method — TronLink will prompt to sign
                    const result = await contract.transfer(toAddress, amount.toString()).send();
                    hash = typeof result === "string" ? result : result?.txid ?? result?.hash ?? "";
                    // Already broadcast by .send(), skip sign/broadcast below
                    unsignedTx = null;
                }

                if (unsignedTx) {
                    const signedTx = await tronWeb.trx.sign(unsignedTx);
                    const broadcastResult = await tronWeb.trx.sendRawTransaction(signedTx);
                    if (!broadcastResult?.result) {
                        throw new Error(broadcastResult?.message || "Broadcast failed");
                    }
                    hash = broadcastResult.txid ?? broadcastResult.transaction?.txID ?? signedTx.txID;
                }
            } else {
                // EVM: use wagmi sendTransaction
                hash = await sendTransactionAsync({
                    to: raw.to as `0x${string}`,
                    value: raw.value ? BigInt(raw.value) : BigInt(0),
                    data: raw.data as `0x${string}` | undefined,
                });
            }

            setTxHash(hash);
            setState("confirming");
            onStatusChange?.("pending_confirmation", hash);

            // Submit txHash to server for verification
            try {
                await client.confirmIntent({
                    body: {
                        intentId: intent.id,
                        txHash: hash,
                        clientSecret: intent.clientSecret,
                    },
                });
            } catch {
                // Server confirmation will be picked up by polling
            }
        } catch (err: any) {
            setState("error");
            setError(err?.message ?? "Transaction failed");
            onError?.(err instanceof Error ? err : new Error(err?.message ?? "Transaction failed"));
        }
    };

    const timer = intent.deadline ? timeRemaining(intent.deadline) : null;
    const isExpired = timer?.total === 0;

    const getButtonText = () => {
        if (isExpired) return "Expired";
        if (state === "connecting") return "Connecting...";
        if (state === "sending") return "Sending...";
        if (state === "confirming") return "Confirming...";
        if (state === "confirmed") return "Confirmed!";
        if (state === "error") return "Retry";
        if (!isConnected) return connectButtonText;
        return payButtonText;
    };

    const isDisabled = isExpired || state === "connecting" || state === "sending" || state === "confirming" || state === "confirmed";

    const isBusy = state === "connecting" || state === "sending" || state === "confirming";

    return (
        <div style={sectionStyle}>
            {/* Token amount display */}
            <div style={tokenDisplayStyle}>
                <div style={tokenIconStyle}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#a5b4fc" }}>
                        {tokenSymbol.slice(0, 3)}
                    </span>
                </div>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fafafa", letterSpacing: "-0.02em" }}>
                        {displayAmount} {tokenSymbol}
                    </div>
                    <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>
                        {isTron ? "Tron network" : intent.chainConfig?.name ?? "EVM"}
                    </div>
                </div>
            </div>

            {/* Timer */}
            {showTimer && timer && !isExpired && (
                <div style={timerStyle}>
                    {clockSmallSvg}
                    <span>Expires in {timer.mins}:{timer.secs.toString().padStart(2, "0")}</span>
                </div>
            )}

            {/* Expired notice */}
            {isExpired && (
                <div style={{ ...statusBadgeStyle, background: "rgba(245,158,11,0.08)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.15)" }}>
                    Payment expired
                </div>
            )}

            {/* Connected account info */}
            {isConnected && address && (
                <div style={accountCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={avatarStyle}>
                            {shortenAddress(address, 4).slice(0, 4)}
                        </div>
                        <span style={{ fontSize: 13, color: "#d4d4d8", fontFamily: "monospace" }}>
                            {shortenAddress(address)}
                        </span>
                    </div>
                    {balance && (
                        <span style={{ fontSize: 12, color: "#71717a" }}>
                            {balance.formatted} {balance.symbol}
                        </span>
                    )}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div style={errorBoxStyle}>
                    {warningIconSvg}
                    <span>{error}</span>
                </div>
            )}

            {/* TX hash */}
            {txHash && (
                <div style={txHashRowStyle}>
                    <span style={{ fontSize: 12, color: "#71717a" }}>Transaction</span>
                    <a
                        href={`${intent.chainConfig?.explorerUrl ?? ""}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={txHashLinkStyle}
                    >
                        {shortenAddress(txHash, 10)}
                        <span style={{ marginLeft: 4, opacity: 0.5 }}>{externalLinkSmallSvg}</span>
                    </a>
                </div>
            )}

            {/* Pay / Connect button */}
            <button
                onClick={handlePay}
                disabled={isDisabled}
                style={isDisabled ? buttonDisabledStyle : buttonStyle}
            >
                {isBusy && <span style={miniSpinnerWhiteStyle} />}
                {getButtonText()}
            </button>

            {/* Success state */}
            {state === "confirmed" && (
                <div style={{ ...statusBadgeStyle, background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>
                    {checkCircleSvg}
                    <span>Payment confirmed! Thank you.</span>
                </div>
            )}

            {/* Network mismatch hint */}
            {isConnected && !isTron && intent.chainConfig && network?.chainId !== intent.chainConfig.chainId && !isBusy && (
                <div style={hintStyle}>
                    {networkIconSvg}
                    <span>Click Pay to switch to {intent.chainConfig.name}</span>
                </div>
            )}
        </div>
    );
}

const sectionStyle: React.CSSProperties = {
    padding: 28,
};

const tokenDisplayStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
};

const tokenIconStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)",
    border: "1px solid rgba(99,102,241,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
};

const timerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#71717a",
    marginBottom: 16,
    padding: "4px 10px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
};

const accountCardStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    marginBottom: 16,
};

const avatarStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "linear-gradient(135deg, #6366f1, #818cf8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "transform 0.1s, box-shadow 0.2s",
    boxShadow: "0 4px 20px rgba(99,102,241,0.25)",
};

const buttonDisabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
};

const errorBoxStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.12)",
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 13,
    color: "#fca5a5",
    lineHeight: 1.5,
};

const txHashRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    marginBottom: 16,
};

const txHashLinkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
    fontFamily: "monospace",
    color: "#a5b4fc",
    textDecoration: "none",
};

const statusBadgeStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    marginTop: 12,
};

const hintStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    fontSize: 12,
    color: "#71717a",
};

const loadingRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    padding: "20px 0",
};

const miniSpinnerStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.08)",
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
};

const miniSpinnerWhiteStyle: React.CSSProperties = {
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
};

const warningIconSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const checkCircleSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const clockSmallSvg = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const networkIconSvg = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const externalLinkSmallSvg = (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);
