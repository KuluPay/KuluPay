import { defineComponent, h, onMounted, onBeforeUnmount, ref, type PropType } from "vue";
import type { PayClientLike } from "../types";
import { mountCheckout, type CheckoutHandle } from "../core/ui";

/**
 * Vue binding for the KuluPay checkout (Nuxt compatible).
 * Thin wrapper around the framework-agnostic checkout core.
 */
export const CheckoutPage = defineComponent({
    name: "KuluPayCheckoutPage",
    props: {
        intentId: { type: String, required: true },
        clientSecret: { type: String, required: true },
        client: { type: Object as PropType<PayClientLike>, required: true },
        merchantName: { type: String, required: false },
        theme: { type: String as PropType<"light" | "dark">, required: false },
    },
    setup(props) {
        const containerRef = ref<HTMLElement | null>(null);
        let handle: CheckoutHandle | null = null;

        onMounted(() => {
            if (!containerRef.value) return;
            handle = mountCheckout(containerRef.value, {
                intentId: props.intentId,
                clientSecret: props.clientSecret,
                client: props.client,
                merchantName: props.merchantName,
                theme: props.theme,
            });
        });

        onBeforeUnmount(() => {
            handle?.unmount();
            handle = null;
        });

        return () => h("div", { ref: containerRef });
    },
});
