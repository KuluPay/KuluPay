// Framework-agnostic checkout core.
// React binding: @kulupay/kulupay/checkout/react
// Vue binding:   @kulupay/kulupay/checkout/vue
export {
    createCheckout,
    mountCheckout,
    type CheckoutController,
    type CheckoutState,
    type CheckoutStep,
    type CreateCheckoutOptions,
    type MountCheckoutOptions,
    type CheckoutHandle,
} from "./core";
export type { CheckoutIntentData, PayClientLike } from "./types";
export type { CheckoutFlow } from "@kulupay/core";
export { formatAmount, formatTokenAmount, shortenAddress, timeRemaining } from "./types";
export { KuluPayCheckout, type AppKitCheckoutProps } from "./appkit-checkout";
