import { HeroTitle } from '@/components/landing/hero-title';
import { InstallBlock } from '@/components/landing/install-block';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { Footer } from '@/components/landing/footer';
import { appName } from '@/lib/shared';

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#F5F5F5] text-[#171717]">
      <div className="flex flex-col lg:flex-row">
        {/* Left side — Hero title */}
        <div className="relative w-full lg:w-[40%] lg:h-dvh border-b lg:border-b-0 lg:border-r border-[#E1E1E1] px-5 sm:px-6 lg:px-7 lg:sticky lg:top-0 z-10 bg-[#F5F5F5] lg:overflow-clip">
          <HeroTitle />
        </div>

        {/* Right side — Content */}
        <div className="relative z-0 w-full lg:w-[60%] overflow-x-hidden">
          <div className="px-5 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-3xl">
            {/* Install section */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-[#171717] tracking-tight mb-1">
                Quick Start
              </h2>
              <p className="text-[13px] text-[#171717]/50 mb-4">
                Install {appName} and start accepting payments in minutes.
              </p>
              <InstallBlock />

              {/* Code preview */}
              <div className="rounded-md border border-[#E1E1E1] bg-white overflow-hidden">
                <div className="border-b border-[#E1E1E1] px-4 py-2 text-[11px] font-mono text-[#171717]/40">
                  lib/pay.ts
                </div>
                <pre className="px-4 py-3 text-[12px] font-mono leading-relaxed overflow-x-auto text-[#171717]">
                  <code>{`import { kuluPay } from '@kulupay/kulupay';
import { pg } from '@kulupay/adapter-sql';
import { stripe, chapa } from '@kulupay/kulupay/providers';
import { Pool } from 'pg';

export const pay = kuluPay({
  providers: [
    stripe({ apiKey: process.env.STRIPE_API_KEY! }),
    chapa({ apiKey: process.env.CHAPA_API_KEY! }),
  ],
  database: pg(new Pool({ connectionString: process.env.DATABASE_URL! })),
});`}</code>
                </pre>
              </div>
            </div>

            {/* Features */}
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-lg font-semibold text-[#171717] tracking-tight shrink-0">
                  Features
                </h2>
                <div className="flex-1 border-t border-[#E1E1E1]" />
              </div>
              <FeatureGrid />
            </div>

            {/* CTA */}
            <div className="relative py-10 text-center">
              <p className="relative text-lg text-balance text-[#171717]/60 tracking-tight">
                Start accepting payments with confidence in minutes.
              </p>
              <a
                href="/docs/introduction"
                className="relative inline-flex items-center gap-1.5 px-6 py-2.5 mt-4 bg-[#DD7627] text-white text-sm font-semibold rounded-full hover:bg-[#c56820] transition-colors"
              >
                Read the Docs →
              </a>
            </div>
          </div>

          <Footer />
        </div>
      </div>
    </div>
  );
}
