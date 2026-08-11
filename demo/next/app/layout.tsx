import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "KuluPay Demo",
  description: "Test the KuluPay onchain checkout flow — Ethereum, Base, Polygon, Arbitrum, and Tron.",
  metadataBase: process.env.NEXT_PUBLIC_KULUPAY_URL
    ? new URL(process.env.NEXT_PUBLIC_KULUPAY_URL)
    : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
