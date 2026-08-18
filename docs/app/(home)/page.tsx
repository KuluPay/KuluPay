import { GridBackground } from '@/components/landing/grid-background';
import { HeroTitle } from '@/components/landing/hero-title';
import { QuickStart } from '@/components/landing/quick-start';
import { CryptoStrip } from '@/components/landing/crypto-strip';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { Footer } from '@/components/landing/footer';
import { Header } from '@/components/landing/header';
import { StarsBackground } from '@/components/landing/stars-background';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <StarsBackground />
      <Header />
      <div id="hero" className="relative pt-14">
      <div className="relative text-foreground">
        <div className="flex flex-col lg:flex-row">
          {/* Left side — Hero title */}
          <div className="relative w-full lg:w-[40%] lg:h-dvh border-b lg:border-b-0 lg:border-r border-foreground/[0.06] px-5 sm:px-6 lg:px-7 lg:sticky lg:top-0 z-10 bg-background lg:overflow-clip">
            <GridBackground />
            <HeroTitle />
          </div>

          {/* Right side — Content */}
          <div className="relative z-0 w-full lg:w-[60%] overflow-x-hidden">
            <div className="px-5 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-3xl">
              <QuickStart />

              <CryptoStrip />

              {/* Features */}
              <div className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="text-lg font-medium text-foreground/90 tracking-tight shrink-0">
                    Features
                  </h2>
                  <div className="flex-1 border-t border-foreground/10" />
                </div>
                <FeatureGrid />
              </div>

              {/* CTA */}
              <div className="relative py-10 text-center">
                <div
                  className="absolute inset-0 pointer-events-none select-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
                    backgroundSize: '24px 24px',
                    opacity: 0.03,
                  }}
                />
                <p className="relative text-lg text-balance text-foreground/60 dark:text-foreground/50 tracking-tight">
                  Start accepting crypto — and cards — with confidence in minutes.
                </p>
                <Link
                  href="/docs/plugins/onchain"
                  className="relative inline-flex items-center gap-1.5 px-5 py-2 mt-4 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Accept Crypto
                </Link>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </div>
    </div>
  </>
);
}
