export type CheckoutStatus =
    | "idle"
    | "connecting"
    | "paying"
    | "confirming"
    | "succeeded"
    | "failed"
    | "expired";

export interface CheckoutTokenConfig {
    symbol: string;
    decimals: number;
    contractAddress?: string;
}

export interface CheckoutConfig {
    intentId: string;
    clientSecret: string;
    providerId: string;
    amount: string;
    recipient: string;
    token: CheckoutTokenConfig;
    deadline: number;
    signature?: string;
    contractAddress?: string;
    chainId?: number;
    network?: {
        name: string;
        chainId: number;
        rpcUrl: string;
        explorerUrl: string;
        isTestnet: boolean;
    };
    onSuccess?: (txHash: string) => void;
    onFailed?: (error: string) => void;
    onExpired?: () => void;
}

export interface WalletInfo {
    id: string;
    name: string;
    icon?: string;
    installed: boolean;
    type: "evm" | "tron";
}

export interface CheckoutState {
    status: CheckoutStatus;
    amount: string;
    tokenSymbol: string;
    recipient: string;
    timeRemaining: number;
    walletConnected: boolean;
    connectedWallet: string | null;
    availableWallets: WalletInfo[];
    txHash: string | null;
    confirmations: { current: number; required: number } | null;
    error: string | null;
}
