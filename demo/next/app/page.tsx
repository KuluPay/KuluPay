"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Wallet } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("USD");
  const [providerId, setProviderId] = useState("ethereum-usdc");
  const [description, setDescription] = useState("Test payment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      if (!cents || cents <= 0) {
        setError("Enter a valid amount");
        setLoading(false);
        return;
      }

      const [chain, token] = providerId.split("-");
      const result = await payClient.createIntent({
        body: {
          amount: cents,
          currency: currency.toLowerCase(),
          providerId: chain,
          token: token?.toUpperCase(),
          description,
          type: "one_time",
        },
      });

      if (result?.data?.id && result?.data?.clientSecret) {
        const url = result.data.checkoutUrl
          ?? `/checkout?intentId=${result.data.id}&clientSecret=${result.data.clientSecret}`;
        router.push(url);
      } else {
        const detail = result?.error?.message || `Missing id or clientSecret in response`;
        setError(`Failed: ${detail}`);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">KuluPay Demo</CardTitle>
              <CardDescription>Create a payment intent and test the checkout flow.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
              />
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ETB">ETB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={providerId} onValueChange={(v) => v && setProviderId(v)}>
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Ethereum</SelectLabel>
                  <SelectItem value="ethereum-usdc">Ethereum (USDC)</SelectItem>
                  <SelectItem value="ethereum-usdt">Ethereum (USDT)</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Base</SelectLabel>
                  <SelectItem value="base-usdc">Base (USDC)</SelectItem>
                  <SelectItem value="base-usdt">Base (USDT)</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Polygon</SelectLabel>
                  <SelectItem value="polygon-usdc">Polygon (USDC)</SelectItem>
                  <SelectItem value="polygon-usdt">Polygon (USDT)</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Arbitrum</SelectLabel>
                  <SelectItem value="arbitrum-usdc">Arbitrum (USDC)</SelectItem>
                  <SelectItem value="arbitrum-usdt">Arbitrum (USDT)</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Tron</SelectLabel>
                  <SelectItem value="tron-usdt">Tron (USDT)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Test payment"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            onClick={handlePay}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Creating..." : `Pay ${amount} ${currency}`}
          </Button>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">POST /api/pay/create-intent</Badge>
            <Badge variant="secondary">/checkout?intentId=...</Badge>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
