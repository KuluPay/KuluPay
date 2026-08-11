"use client";

import { useKuluPayCheckout } from "./useKuluPayCheckout";
import { KuluPayConnectButton } from "../../integrations/appkit-react";
import { shortenAddress, type PayClientLike } from "../types";

export interface KuluPayCheckoutProps {
    client: PayClientLike;
    intentId: string;
    clientSecret: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: Error) => void;
    className?: string;
}

export function KuluPayCheckout({
    client,
    intentId,
    clientSecret,
    onSuccess,
    onError,
    className,
}: KuluPayCheckoutProps) {
    const {
        intent,
        status,
        error,
        connected,
        address,
        connect,
        pay,
        appKitLoading,
    } = useKuluPayCheckout({
        client,
        intentId,
        clientSecret,
        onSuccess,
        onError,
    });

    if (status === "loading" || appKitLoading) {
        return (
            <div className={className} style={cardStyle}>
                <div style={centerStyle}>Loading payment…</div>
            </div>
        );
    }

    if (status === "error" || !intent) {
        return (
            <div className={className} style={cardStyle}>
                <div style={{ color: "#ef4444", textAlign: "center" }}>
                    {error || "Failed to load payment"}
                </div>
            </div>
        );
    }

    if (status === "expired") {
        return (
            <div className={className} style={cardStyle}>
                <div style={centerStyle}>This payment link has expired.</div>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className={className} style={cardStyle}>
                <div style={centerStyle}>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>Payment complete</div>
                    <div style={{ color: "#6b7280", marginTop: 8 }}>
                        {intent.amount && intent.currency
                            ? `${(intent.amount / 100).toFixed(2)} ${intent.currency}`
                            : "Payment"} sent
                    </div>
                </div>
            </div>
        );
    }

    const amountText =
        intent.amount && intent.currency
            ? `${(intent.amount / 100).toFixed(2)} ${intent.currency}`
            : "";

    return (
        <div className={className} style={cardStyle}>
            <div style={headerStyle}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {amountText ? `Pay ${amountText}` : "Pay"}
                </div>
                {intent.description && (
                    <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                        {intent.description}
                    </div>
                )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {connected && address ? (
                    <>
                        <div style={addressBoxStyle}>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                                Connected wallet
                            </div>
                            <div style={{ fontFamily: "monospace", fontSize: 14 }}>
                                {shortenAddress(address)}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={pay}
                            disabled={status === "sending"}
                            style={{
                                ...buttonStyle,
                                opacity: status === "sending" ? 0.7 : 1,
                                cursor: status === "sending" ? "not-allowed" : "pointer",
                            }}
                        >
                            {status === "sending" ? "Confirming…" : amountText ? `Pay ${amountText}` : "Pay"}
                        </button>
                    </>
                ) : (
                    <KuluPayConnectButton
                        chains={intent.chainConfig ? [intent.chainConfig] : []}
                        label="Connect wallet"
                        className={className}
                        style={{ width: "100%" }}
                    />
                )}

                {error && (
                    <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: "100%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const centerStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "32px 0",
    color: "#6b7280",
};

const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: 24,
};

const addressBoxStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
};

const buttonStyle: React.CSSProperties = {
    appearance: "none",
    border: "none",
    borderRadius: 999,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    background: "#111",
    color: "#fff",
    width: "100%",
};
