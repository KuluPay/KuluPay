"use client";

import { useEffect, useState } from "react";
import { payClient } from "@/lib/pay-client";

type ProviderKey = "eth-usdc" | "base-usdc" | "tron-usdt";
type WalletType = "evm" | "tron" | null;

const PROVIDERS: { key: ProviderKey; label: string; description: string; wallet: WalletType }[] = [
  { key: "eth-usdc", label: "Ethereum USDC (Sepolia)", description: "MetaMask / EIP-1193", wallet: "evm" },
  { key: "base-usdc", label: "Base USDC (Sepolia)", description: "MetaMask / Coinbase", wallet: "evm" },
  { key: "tron-usdt", label: "Tron USDT (Nile)", description: "TronLink wallet", wallet: "tron" },
];

export default function Home() {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("eth-usdc");
  const [verifying, setVerifying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking for wallet...");
  const [blockchainError, setBlockchainError] = useState<{
    code: string;
    message: string;
    developerMessage: string;
    hint?: string;
  } | null>(null);

  const activeWallet = PROVIDERS.find((p) => p.key === selectedProvider)?.wallet ?? null;

  // Auto-detect & connect EVM wallet (MetaMask)
  useEffect(() => {
    if (activeWallet !== "evm") return;
    setWalletConnected(false);
    setWalletAddress(null);
    setStatus("Checking for MetaMask...");

    const eth = (window as any).ethereum;
    if (!eth) {
      setStatus("MetaMask not found. Install MetaMask extension and refresh.");
      return;
    }

    // Check if already connected
    eth.request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
          setStatus("Wallet connected");
        } else {
          setStatus("MetaMask found — click Connect to link your wallet.");
        }
      })
      .catch(() => setStatus("MetaMask found — click Connect to link your wallet."));
  }, [activeWallet]);

  // Auto-detect & connect Tron wallet (TronLink)
  useEffect(() => {
    if (activeWallet !== "tron") return;
    setWalletConnected(false);
    setWalletAddress(null);

    const tl = (window as any).tronLink;
    const tw = (window as any).tronWeb;

    console.log("[KuluPay:Tron] Diagnostics:", {
      hasTronLink: !!tl,
      hasTronLinkRequest: !!tl?.request,
      hasTronWeb: !!tw,
      tronWebDefaultAddress: tw?.defaultAddress,
      tronWebReady: tw?.ready,
      tronWebFullNode: tw?.fullNode,
    });

    if (tl?.request) {
      tl.request({ method: "tron_requestAccounts" }).catch(() => {});
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const twNow = (window as any).tronWeb;

      if (twNow?.defaultAddress?.base58) {
        setWalletAddress(twNow.defaultAddress.base58);
        setWalletConnected(true);
        setStatus("Wallet connected");
        clearInterval(interval);
        return;
      }

      if (attempts % 5 === 0 && tl?.request) {
        tl.request({ method: "tron_requestAccounts" }).catch(() => {});
      }

      if (twNow) {
        setStatus(`TronLink found — waiting for approval... (tronWeb.ready: ${twNow.ready})`);
      } else if (tl) {
        setStatus("TronLink found but tronWeb not injected yet...");
      } else {
        setStatus(`TronLink not detected${attempts > 10 ? " — install TronLink extension" : "..."}`);
      }

      if (attempts > 20) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, [activeWallet]);

  const handleConnectWallet = async () => {
    if (activeWallet === "evm") {
      const eth = (window as any).ethereum;
      if (!eth) {
        setStatus("MetaMask not found. Install MetaMask extension and refresh.");
        return;
      }
      try {
        setStatus("Requesting MetaMask connection...");
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
          setStatus("Wallet connected");
        }
      } catch (err: any) {
        setStatus(`MetaMask connection failed: ${err.message || "rejected"}`);
      }
    } else if (activeWallet === "tron") {
      const tw = (window as any).tronWeb;
      const tl = (window as any).tronLink;
      if (!tw && !tl) {
        setStatus("TronLink not found. Install TronLink extension and refresh.");
        return;
      }
      if (tw?.defaultAddress?.base58) {
        setWalletAddress(tw.defaultAddress.base58);
        setWalletConnected(true);
        setStatus("Wallet connected");
        return;
      }
      // Try tronLink.request first (newer TronLink versions)
      if (tl?.request) {
        try {
          setStatus("Requesting TronLink connection...");
          const res = await tl.request({ method: "tron_requestAccounts" });
          await new Promise((r) => setTimeout(r, 2000));
          if (tw?.defaultAddress?.base58) {
            setWalletAddress(tw.defaultAddress.base58);
            setWalletConnected(true);
            setStatus("Wallet connected");
            return;
          }
        } catch {}
      }
      // Fallback: try tronWeb directly (older TronLink or already approved)
      if (tw) {
        try {
          const addr = tw.defaultAddress?.base58;
          if (addr) {
            setWalletAddress(addr);
            setWalletConnected(true);
            setStatus("Wallet connected");
            return;
          }
        } catch {}
      }
      setStatus("Please open TronLink extension and connect to this site manually.");
    }
  };

  const pay = payClient.usePay(selectedProvider);

  const handleCreateIntent = async () => {
    setTxHash(null);
    setBlockchainError(null);
    payClient.$intent.set({ data: null, error: null, isPending: true });
    const { data, error } = await payClient.createIntent({
      amount: 2500,
      currency: "usd",
      userId: "user_demo",
      providerId: selectedProvider,
      productId: "prod_premium",
    });
    if (error) {
      console.error("createIntent error:", error);
      payClient.$intent.set({ data: null, error, isPending: false });
      setBlockchainError({
        code: error.code || "UNKNOWN",
        message: error.message || "Failed to create payment intent.",
        developerMessage: error.developerMessage || error.message || String(error),
        hint: error.hint,
      });
    } else {
      payClient.$intent.set({ data, error: null, isPending: false });
    }
  };

  const handleConfirm = async () => {
    if (!pay.data) {
      alert("Create a payment intent first");
      return;
    }

    console.log("intent.raw:", pay.data.raw);
    console.log("intent.id:", pay.data.id);

    setBlockchainError(null);

    const { data: result, error: confirmError } = await payClient.confirmPayment({
      providerId: selectedProvider,
      intentId: pay.data.id,
      options: { paymentMethodData: pay.data.raw },
    });

    if (confirmError) {
      setVerifying(false);
      console.error("confirm error:", confirmError);
      setBlockchainError({
        code: confirmError.code || "UNKNOWN",
        message: confirmError.message || "Payment failed.",
        developerMessage: confirmError.developerMessage || confirmError.message || String(confirmError),
        hint: confirmError.hint,
      });
      return;
    }

    setVerifying(true);
    const { data: verified, error: verifyError } = await payClient.verifyPayment({
      providerId: selectedProvider,
      intentId: result.id,
    });
    setVerifying(false);

    if (verifyError) {
      setBlockchainError({
        code: verifyError.code || "UNKNOWN",
        message: verifyError.message || "Verification failed.",
        developerMessage: verifyError.developerMessage || verifyError.message || String(verifyError),
        hint: verifyError.hint,
      });
      return;
    }

    if (verified.status === "succeeded") {
      setTxHash(result.id);
    }
    alert(`Payment ${verified.status}: ${result.id}`);
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1>KuluPay Blockchain Demo</h1>
      <p style={{ color: "#666" }}>
        Pay with crypto via MetaMask (Ethereum, Base) or TronLink (Tron).
      </p>

      {/* Recipient addresses */}
      <div style={{ margin: "16px 0", padding: 12, borderRadius: 8, background: "#f0f4ff", border: "1px solid #c7d2fe", fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Recipient Wallet Addresses</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>EVM:</strong>{" "}
            <code style={{ fontSize: 12 }}>
              {process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS || "0xBBEa52F605E678c38888679986c8D1ec1710dD9F"}
            </code>
          </div>
          <div>
            <strong>Tron:</strong>{" "}
            <code style={{ fontSize: 12 }}>
              {process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS || "TTEc9GuWrwRNks28jLBg6fUWCLBx6uFjZK"}
            </code>
          </div>
        </div>
      </div>

      {/* Wallet status box */}
      <div
        style={{
          margin: "16px 0",
          padding: 12,
          borderRadius: 8,
          background: walletConnected ? "#e6ffe6" : "#fff3cd",
          border: `1px solid ${walletConnected ? "#c3e6cb" : "#ffc107"}`,
          fontSize: 14,
        }}
      >
        {walletConnected ? (
          <span style={{ color: "green", fontWeight: 600 }}>
            {activeWallet === "evm" ? "MetaMask" : "TronLink"} connected: {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
          </span>
        ) : (
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{status}</p>
            <button
              onClick={handleConnectWallet}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                cursor: "pointer",
                background: activeWallet === "evm" ? "#f6851b" : "#eb2f2f",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              Connect {activeWallet === "evm" ? "MetaMask" : "TronLink"}
            </button>
          </div>
        )}
      </div>

      <div style={{ margin: "24px 0" }}>
        <label style={{ fontWeight: 600 }}>Payment method</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedProvider(p.key)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: selectedProvider === p.key ? "#111" : "#fff",
                color: selectedProvider === p.key ? "#fff" : "#111",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {!pay.data && (
        <button
          onClick={handleCreateIntent}
          disabled={pay.isPending}
          style={{
            padding: "12px 24px",
            cursor: pay.isPending ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {pay.isPending ? "Creating..." : `Pay $25.00 with ${PROVIDERS.find((p) => p.key === selectedProvider)?.label}`}
        </button>
      )}

      {pay.data && pay.data.status !== "succeeded" && (
        <>
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#f7f7f7",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <strong>Payment data ready</strong>
            <p style={{ margin: "8px 0" }}>Your wallet will open when you confirm.</p>
            <details>
              <summary>Intent details</summary>
              <pre style={{ overflow: "auto", fontSize: 11 }}>
                {JSON.stringify(pay.data.raw, null, 2)}
              </pre>
            </details>
          </div>
          <button
            onClick={handleConfirm}
            disabled={pay.isPending || verifying}
            style={{ padding: "12px 24px", cursor: pay.isPending || verifying ? "not-allowed" : "pointer" }}
          >
            {pay.isPending || verifying ? "Processing..." : "Confirm with Wallet"}
          </button>
        </>
      )}

      {pay.data?.status === "succeeded" && (
        <div style={{ padding: 16, background: "#e6ffe6", borderRadius: 8 }}>
          <p style={{ color: "green", fontWeight: 600 }}>Payment succeeded!</p>
          <p>Intent ID: {pay.data.id}</p>
          {txHash && <p>TX: {txHash}</p>}
        </div>
      )}

      {blockchainError && (
        <div
          style={{
            margin: "16px 0",
            padding: 16,
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>
              {blockchainError.code === "TRANSACTION_REJECTED" ? "\u26a0\ufe0f" : "\u274c"}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#991b1b" }}>
                {blockchainError.message}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "#fee2e2",
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                }}
              >
                {blockchainError.code}
              </div>
              {blockchainError.hint && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#7f1d1d" }}>
                  <strong>\u2139\ufe0f Hint:</strong> {blockchainError.hint}
                </div>
              )}
              <details style={{ marginTop: 8 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#991b1b",
                    userSelect: "none",
                  }}
                >
                  Developer details
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: "#1e1e1e",
                    color: "#d4d4d4",
                    borderRadius: 6,
                    fontSize: 11,
                    overflow: "auto",
                    fontFamily: "monospace",
                  }}
                >
                  {blockchainError.developerMessage}
                </pre>
              </details>
              <button
                onClick={() => setBlockchainError(null)}
                style={{
                  marginTop: 8,
                  padding: "4px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  background: "transparent",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: 4,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {pay.error && !blockchainError && (
        <p style={{ color: "red" }}>Error: {pay.error.message}</p>
      )}

      {pay.intent && (
        <details style={{ marginTop: 24 }}>
          <summary>Full Payment Intent</summary>
          <pre style={{ fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(pay.intent, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
