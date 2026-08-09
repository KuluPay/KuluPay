import { useQuery, useMutation } from "@tanstack/react-query";
import { payClient } from "@/lib/pay-client";
import type { CheckoutIntentData } from "@kulupay/kulupay/checkout/react";
import type { PaymentIntent } from "@kulupay/core";

export function useCheckoutIntent(intentId?: string, clientSecret?: string) {
  const { data: intent, isLoading, error } = useQuery({
    queryKey: ["checkout", intentId, clientSecret],
    queryFn: async () => {
      const { data, error } = await payClient.checkoutIntent({ intentId: intentId!, clientSecret: clientSecret! });
      if (error) throw new Error(error.message || "Failed to load payment");
      return data as CheckoutIntentData;
    },
    enabled: !!intentId && !!clientSecret,
  });

  return { intent, isLoading, error };
}

export function useVerifyIntent(intentId?: string, clientSecret?: string, intent?: CheckoutIntentData | null) {
  const polling = intent?.status === "pending" || intent?.status === "pending_confirmation";

  const { data: verifyData } = useQuery({
    queryKey: ["verify", intentId, clientSecret],
    queryFn: async () => {
      const { data } = await payClient.verifyIntent({ intentId: intentId!, clientSecret: clientSecret! });
      return data;
    },
    enabled: polling,
    refetchInterval: polling ? 5000 : false,
  });

  return { verifyData, polling };
}

export function useConfirmPayment() {
  const { mutate, isPending, error: confirmError } = useMutation({
    mutationFn: async (intent: CheckoutIntentData) => {
      return payClient.onchain.sendPayment(intent as unknown as PaymentIntent);
    },
  });

  return { confirm: mutate, confirming: isPending, error: confirmError };
}
