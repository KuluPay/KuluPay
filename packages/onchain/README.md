# @kulupay/onchain

Onchain payment plugin for KuluPay — accept crypto payments on EVM chains (Ethereum, Base, Polygon, Arbitrum) and Tron with wallet-based checkout via AppKit.

## Features

- **Multi-chain** — Ethereum, Base, Polygon, Arbitrum (EVM) and Tron
- **Multi-token** — USDC, USDT, DAI, and native tokens (ETH, TRX, MATIC)
- **Wallet-based checkout** — Users sign transactions in their own wallet (MetaMask, TronLink, etc.)
- **On-chain verification** — Server verifies actual transaction recipient, amount, and confirmation status
- **Testnet support** — Built-in testnet configs for all chains with faucet links
- **Typed errors** — User-friendly error messages with hints for wallet/chain/transaction issues
- **AppKit integration** — Reown AppKit for wallet connection and chain switching
- **Price conversion** — Built-in stablecoin converter (1:1 USD) or custom converter

## Installation

```bash
pnpm add @kulupay/onchain viem tronweb
# or
npm install @kulupay/onchain viem tronweb
```

### Peer Dependencies

- `viem` — EVM chain interaction (transaction receipts, logs, block numbers)
- `tronweb` — Tron chain interaction (transaction building, broadcasting, querying)
- `@kulupay/core` — Core KuluPay types and plugin interface
- `@kulupay/kulupay` — KuluPay SDK (for client-side usage)

## Server-side Usage

Use the `onchain` plugin in your KuluPay server config:

```typescript
import { kuluPay } from "@kulupay/kulupay";
import { onchain } from "@kulupay/onchain";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    onchain({
      ethereum: {
        recipientAddress: "0xYourAddress",
        tokens: ["USDC", "USDT", "native"],
        testnet: false,
      },
      tron: {
        recipientAddress: "TYourAddress",
        tokens: ["USDT"],
        testnet: false,
        apiKey: "your-trongrid-api-key",
      },
    }),
  ],
  baseURL: "http://localhost:3000",
  checkoutUrl: "/checkout?intentId={intentId}&clientSecret={clientSecret}",
});
```

### Configuration Options

Each chain key maps to an `OnchainChainConfig`:

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `recipientAddress` | `string` | Yes | Wallet address to receive payments |
| `tokens` | `string \| string[]` | No | Token symbols to accept (defaults to `["native"]`) |
| `testnet` | `boolean \| string` | No | `false` (default) for mainnet, `true` for default testnet, or testnet name |
| `network` | `Partial<NetworkConfig>` | No | Custom network override (chainId, rpcUrl, explorerUrl, etc.) |
| `priceConverter` | `PriceConverter` | No | Custom fiat-to-crypto converter (defaults to stablecoin 1:1) |
| `confirmations` | `number` | No | Required block confirmations (default: 1, EVM only) |
| `apiKey` | `string` | No | TronGrid API key for higher rate limits (Tron only) |

### Supported Chains

| Chain | Family | Chain ID | Native Token |
| --- | --- | --- | --- |
| Ethereum | EVM | 1 | ETH |
| Base | EVM | 8453 | ETH |
| Polygon | EVM | 137 | MATIC |
| Arbitrum | EVM | 42161 | ETH |
| Tron | Tron | 728126428 | TRX |

### Testnet Support

| Chain | Default Testnet | Testnets Available |
| --- | --- | --- |
| Ethereum | sepolia | sepolia |
| Base | base-sepolia | base-sepolia |
| Polygon | amoy | amoy |
| Arbitrum | arbitrum-sepolia | arbitrum-sepolia |
| Tron | nile | nile, shasta |

```typescript
onchain({
  ethereum: {
    recipientAddress: "0xYourAddress",
    tokens: ["USDC"],
    testnet: "sepolia",
  },
  tron: {
    recipientAddress: "TYourAddress",
    tokens: ["USDT"],
    testnet: "nile",
  },
})
```

### Supported Tokens

| Token | Chains | Decimals | Type |
| --- | --- | --- | --- |
| USDC | Ethereum, Base, Polygon, Arbitrum | 6 | ERC-20 / TRC-20 |
| USDT | Ethereum, Base, Polygon, Arbitrum, Tron | 6 | ERC-20 / TRC-20 |
| DAI | Ethereum, Base, Polygon, Arbitrum | 18 | ERC-20 |
| ETH | Ethereum, Base, Polygon, Arbitrum | 18 | Native |
| TRX | Tron | 6 | Native |
| MATIC | Polygon | 18 | Native |

Use `"native"` in the tokens array to accept the chain's native token.

## Client-side Usage

```typescript
import { createPayClient } from "@kulupay/kulupay/client";
import { onchainClient } from "@kulupay/onchain/client";

export const payClient = createPayClient({
  baseURL: "http://localhost:3000",
  plugins: [
    onchainClient({
      walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
      debug: true,
    }),
  ],
});
```

### Client Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `walletConnectProjectId` | `string` | Yes | Reown AppKit project ID (get one at https://dashboard.reown.com) |
| `debug` | `boolean` | No | Enable debug logging (default: `false`) |

## Checkout Flow

1. **Create intent** — Server creates a payment intent with the token, amount, and recipient address
2. **Connect wallet** — User connects their wallet via AppKit (MetaMask, TronLink, WalletConnect, etc.)
3. **Sign transaction** — Client builds the transaction from the intent's `raw` data and sends it to the wallet for signing
4. **Broadcast** — Signed transaction is broadcast to the network
5. **Confirm with server** — Client sends the txHash to `/confirm-intent`
6. **Poll for confirmation** — Client polls `/verify-intent` every 3 seconds (up to 5 minutes)
7. **On-chain verification** — Server fetches the on-chain transaction and verifies:
   - Transaction status (success/reverted)
   - Block confirmations (meets required threshold)
   - **Recipient address matches** the expected recipient
   - **Amount matches** the expected amount
8. **Success** — Server marks payment as `succeeded` only after all checks pass

### React Checkout Hook

```tsx
import { useKuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { KuluPayConnectButton } from "@kulupay/kulupay/appkit/react";

function Checkout({ intentId, clientSecret }: { intentId: string; clientSecret: string }) {
  const { intent, status, error, txHash, connected, address, connect, pay } = useKuluPayCheckout({
    client: payClient,
    intentId,
    clientSecret,
    onSuccess: (txHash) => console.log("Payment complete:", txHash),
    onError: (err) => console.error("Payment failed:", err),
  });

  // status: "loading" | "ready" | "connecting" | "sending" | "confirming" | "success" | "error" | "expired"
}
```

## Error Handling

The onchain plugin provides typed errors with user-friendly messages, developer messages, and hints:

```typescript
import { OnchainError, ONCHAIN_ERROR_CODES } from "@kulupay/onchain";

try {
  await payClient.onchain.sendPayment(intent);
} catch (err) {
  if (err instanceof OnchainError) {
    console.log(err.code);             // "WRONG_CHAIN"
    console.log(err.message);          // "Wrong network."
    console.log(err.hint);             // "Switch to the correct network in your wallet."
    console.log(err.developerMessage); // "Expected chain ethereum, got polygon. ..."
    console.log(err.context);          // { expectedChain, actualChain, network, ... }
  }
}
```

### Error Codes

| Code | User Message | Description |
| --- | --- | --- |
| `WALLET_NOT_FOUND` | No wallet found. | No wallet extension detected |
| `WALLET_NOT_CONNECTED` | Wallet not connected. | No accounts returned from wallet |
| `TRANSACTION_REJECTED` | Transaction rejected. | User rejected the signature request |
| `INSUFFICIENT_FUNDS` | Insufficient funds. | Balance too low for tx + gas |
| `WRONG_CHAIN` | Wrong network. | Wallet on incorrect chain |
| `CHAIN_NOT_ADDED` | Network not found in wallet. | Chain not added to wallet |
| `INVALID_RECIPIENT` | Invalid recipient address. | Zero address or malformed |
| `TRANSACTION_FAILED` | Transaction failed. | Transaction reverted on-chain |
| `RPC_ERROR` | Network error. | RPC communication failure |
| `MISSING_PAYMENT_DATA` | Missing payment data. | Intent raw data is null |
| `INVALID_CONTRACT` | Token contract not found. | Contract doesn't exist on current network |
| `CHAIN_MISMATCH` | Wallet is on the wrong chain. | Chain switch attempted but failed |
| `INSUFFICIENT_GAS` | Not enough gas. | Insufficient gas funds |
| `USER_REJECTED` | User rejected the request. | User cancelled connection/signing |

## Pre-configured Presets

### Chain Presets

```typescript
import { CHAINS } from "@kulupay/onchain";

CHAINS.ethereum;  // { family: "evm", chainId: 1, name: "ethereum", rpcUrl: "...", explorerUrl: "..." }
CHAINS.base;      // { family: "evm", chainId: 8453, name: "base", ... }
CHAINS.polygon;   // { family: "evm", chainId: 137, name: "polygon", ... }
CHAINS.arbitrum;  // { family: "evm", chainId: 42161, name: "arbitrum", ... }
CHAINS.tron;      // { family: "tron", chainId: 728126428, name: "tron", ... }
```

### Token Presets

```typescript
import { TOKENS } from "@kulupay/onchain";

TOKENS.ETH;                    // { symbol: "ETH", decimals: 18 }
TOKENS.TRX;                    // { symbol: "TRX", decimals: 6 }
TOKENS.MATIC;                  // { symbol: "MATIC", decimals: 18 }
TOKENS.USDC("0x...");          // { symbol: "USDC", decimals: 6, contractAddress: "0x..." }
TOKENS.USDT("0x...");          // { symbol: "USDT", decimals: 6, contractAddress: "0x..." }
TOKENS.DAI("0x...");           // { symbol: "DAI", decimals: 18, contractAddress: "0x..." }
```

### Network Registry

```typescript
import { NETWORKS, resolveNetwork, getDefaultTestnet } from "@kulupay/onchain";

// Full network registry with mainnet + testnets + token addresses
NETWORKS.ethereum;
// {
//   family: "evm",
//   displayName: "Ethereum",
//   mainnet: { chainId: 1, name: "ethereum", rpcUrl: "...", explorerUrl: "...", isTestnet: false },
//   testnets: { sepolia: { chainId: 11155111, ... } },
//   nativeToken: { symbol: "ETH", decimals: 18 },
//   wellKnownTokens: { USDC: {...}, USDT: {...} },
//   testnetTokens: { sepolia: { USDC: {...} } }
// }

// Resolve a specific testnet
resolveNetwork("ethereum", "sepolia");

// Get the default testnet for a chain
getDefaultTestnet("tron"); // "nile"
```

## Low-level Provider Usage

You can use the EVM and Tron providers directly without the plugin:

```typescript
import { evm, tron } from "@kulupay/onchain";

const ethereumProvider = evm({
  chain: {
    family: "evm",
    chainId: 1,
    name: "ethereum",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
  },
  recipientAddress: "0xYourAddress",
  tokens: {
    native: { symbol: "ETH", decimals: 18 },
    USDC: { symbol: "USDC", decimals: 6, contractAddress: "0xA0b8..." },
  },
  confirmations: 2,
});

const tronProvider = tron({
  chain: {
    family: "tron",
    chainId: 728126428,
    name: "tron",
    rpcUrl: "https://api.trongrid.io",
    explorerUrl: "https://tronscan.org",
  },
  recipientAddress: "TYourAddress",
  tokens: {
    USDT: { symbol: "USDT", decimals: 6, contractAddress: "TR7NH..." },
  },
  apiKey: "your-trongrid-api-key",
});
```

## Security

- **Recipient address stays server-side** — The server builds raw transaction data; the client only signs what the server provides
- **On-chain amount verification** — Server verifies the actual on-chain amount matches the expected amount
- **On-chain recipient verification** — Server verifies the actual recipient matches the expected address
- **Cryptographically secure secrets** — Client secrets generated with `crypto.randomUUID()`
- **No secret leakage** — `chainConfig` in intent responses contains only public info (chainId, rpcUrl, tokens)

## Package Exports

| Export Path | Description |
| --- | --- |
| `@kulupay/onchain` | Server-side plugin, providers, presets, types |
| `@kulupay/onchain/client` | Client-side wallet integration (AppKit, sendPayment) |
| `@kulupay/onchain/appkit` | AppKit-specific utilities |
| `@kulupay/onchain/react` | React components (connect button) |

## License

MIT
