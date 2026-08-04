"use client";

import { useState, useEffect } from "react";
import type { CheckoutProps } from "./types";
import { formatAmount, shortenAddress } from "./types";

export function EVMCheckout({ intent, client, onStartPolling, onUpdateStatus }: CheckoutProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(intent.txHash);
  const [wallets, setWallets] = useState<{ id: string; name: string; installed: boolean }[]>([
    { id: "metamask", name: "MetaMask", installed: false },
    { id: "coinbase", name: "Coinbase Wallet", installed: false },
    { id: "rabby", name: "Rabby", installed: false },
    { id: "okx", name: "OKX Wallet", installed: false },
  ]);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const providers = eth.providers || [eth];
    setWallets((prev) =>
      prev.map((w) => ({
        ...w,
        installed: providers.some((p: any) => {
          if (w.id === "metamask") return p.isMetaMask;
          if (w.id === "coinbase") return p.isCoinbaseWallet;
          if (w.id === "rabby") return p.isRabby;
          if (w.id === "okx") return p.isOKExWallet || p.isOkxWallet;
          return false;
        }),
      })),
    );

    eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setConnected(true);
      }
    }).catch(() => {});
  }, []);

  const connect = async () => {
    setError(null);
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No EVM wallet found. Please install MetaMask or another wallet.");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setConnected(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
  };

  const pay = async () => {
    if (!connected) return;
    setError(null);
    setPaying(true);

    try {
      const eth = (window as any).ethereum;
      const from = address;
      const token = intent.token;
      const recipient = intent.recipient || intent.raw?.to;

      if (!recipient) throw new Error("Missing recipient address");

      let hash: string;

      if (intent.raw?.data && intent.raw.data !== "0x") {
        // Use the exact transaction data computed by the provider
        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from,
            to: intent.raw.to,
            value: "0x" + BigInt(intent.raw.value || 0).toString(16),
            data: intent.raw.data,
          }],
        });
      } else if (token?.address) {
        const decimals = token.decimals || 6;
        const rawAmount = BigInt(intent.amount) * BigInt(10 ** (decimals - 2));
        const transferData =
          "0xa9059cbb" +
          recipient.slice(2).padStart(64, "0") +
          rawAmount.toString(16).padStart(64, "0");

        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [{ from, to: token.address, value: "0x0", data: transferData }],
        });
      } else {
        throw new Error("Native token payments require raw transaction data");
      }

      setTxHash(hash);
      onUpdateStatus("pending_confirmation", hash);

      const { error: confirmError } = await client.confirmIntent({
        body: {
          intentId: intent.id,
          txHash: hash,
          clientSecret: intent.clientSecret,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Failed to confirm with server");
      }

      onStartPolling();
    } catch (err: any) {
      setError(err.message || "Payment failed");
      onUpdateStatus("failed");
    } finally {
      setPaying(false);
    }
  };

  if (intent.status === "pending_confirmation") {
    return (
      <div style={pendingStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, border: "2px solid #a0a0ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 15, color: "#a0a0ff", fontWeight: 600 }}>Waiting for confirmations</span>
        </div>
        {txHash && (
          <div style={{ fontSize: 12, color: "#71717a", wordBreak: "break-all", fontFamily: "monospace" }}>
            TX: {shortenAddress(txHash, 10)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {intent.network && (
        <div style={infoCardStyle}>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Network</span>
            <span style={infoValueStyle}>{intent.network.name || intent.providerId}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Recipient</span>
            <span style={{ ...infoValueStyle, fontFamily: "monospace", fontSize: 12 }}>{shortenAddress(intent.recipient || intent.raw?.to || "")}</span>
          </div>
          {intent.token?.symbol && (
            <div style={infoRowStyle}>
              <span style={infoLabelStyle}>Token</span>
              <span style={infoValueStyle}>{intent.token.symbol}</span>
            </div>
          )}
        </div>
      )}

      {!connected ? (
        <div>
          <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 14, fontWeight: 500 }}>Connect your wallet to pay</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {wallets.filter((w) => w.installed).map((w) => (
              <button key={w.id} onClick={connect} style={walletBtnStyle(true)}>
                <span>{w.name}</span>
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Installed</span>
              </button>
            ))}
            {wallets.filter((w) => !w.installed).map((w) => (
              <button key={w.id} onClick={connect} style={walletBtnStyle(false)}>
                <span>{w.name}</span>
                <span style={{ fontSize: 12, color: "#71717a" }}>Not installed</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={connectedBoxStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>Wallet connected</span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a1a1aa" }}>{shortenAddress(address || "")}</span>
          </div>
          <button onClick={pay} disabled={paying} style={payBtnStyle(paying)}>
            {paying ? "Confirm in wallet..." : `Pay ${formatAmount(intent.amount, intent.currency)}`}
          </button>
        </div>
      )}

      {error && <div style={errorBoxStyle}>{error}</div>}
      <div style={warningStyle}>
        <span style={{ marginRight: 6 }}>⚠</span>
        Send the exact amount. No refunds for wrong amounts or wrong chains.
      </div>
    </div>
  );
}

const infoCardStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: 16,
  background: "#09090b",
  borderRadius: 12,
  border: "1px solid #27272a",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#71717a",
  fontSize: 13,
  fontWeight: 500,
};

const infoValueStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: "#fafafa",
};

const pendingStyle: React.CSSProperties = {
  padding: 20,
  background: "#0a0a1a",
  borderRadius: 12,
  border: "1px solid #27273a",
  textAlign: "center",
  marginBottom: 16,
};

const walletBtnStyle = (installed: boolean): React.CSSProperties => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  borderRadius: 12,
  border: `1px solid ${installed ? "#3f3f46" : "#27272a"}`,
  background: installed ? "#18181b" : "#09090b",
  color: installed ? "#fafafa" : "#71717a",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
  transition: "border-color 0.15s",
});

const connectedBoxStyle: React.CSSProperties = {
  padding: 14,
  background: "#0a1f0a",
  borderRadius: 12,
  border: "1px solid #1a3a1a",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const payBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "16px 24px",
  borderRadius: 12,
  border: "none",
  background: disabled ? "#3f3f46" : "#fafafa",
  color: disabled ? "#71717a" : "#09090b",
  fontSize: 16,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
});

const errorBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  background: "#2a0d0d",
  borderRadius: 12,
  border: "1px solid #5a1a1a",
  fontSize: 13,
  color: "#ff6b6b",
  lineHeight: 1.5,
};

const warningStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 14px",
  background: "#1a1505",
  borderRadius: 10,
  border: "1px solid #3a3010",
  fontSize: 12,
  color: "#a8a060",
  lineHeight: 1.5,
  display: "flex",
  alignItems: "flex-start",
};
