import { GridBackground } from '@/components/landing/grid-background';
import { HeroTitle } from '@/components/landing/hero-title';
import { InstallBlock } from '@/components/landing/install-block';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { Footer } from '@/components/landing/footer';
import { appName } from '@/lib/shared';

export default function HomePage() {
  return (
    <div id="hero" className="relative pt-[45px] lg:pt-0">
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
              {/* Install section */}
              <div className="mb-10">
                <h2 className="text-lg font-medium text-foreground/90 tracking-tight mb-1">
                  Quick Start
                </h2>
                <p className="text-[13px] text-foreground/50 mb-4">
                  Install {appName} and start accepting payments in minutes.
                </p>
                <InstallBlock />

                {/* Code preview */}
                <div className="rounded-md border border-foreground/[0.1] bg-neutral-50 dark:bg-[#050505] overflow-hidden">
                  <div className="border-b border-foreground/[0.06] px-4 py-2 text-[11px] font-mono text-foreground/40">
                    lib/pay.ts
                  </div>
                  <pre className="px-4 py-3 text-[12px] font-mono leading-relaxed overflow-x-auto">
                    <code>
                      <span className="text-purple-600 dark:text-purple-400">import</span>{' '}
                      <span className="text-neutral-700 dark:text-neutral-300">{'{ kuluPay, createPgPoolDriver }'}</span>{' '}
                      <span className="text-purple-600 dark:text-purple-400">from</span>{' '}
                      <span className="text-emerald-600 dark:text-emerald-400">'@kulupay/kulupay'</span>;{'\n\n'}
                      <span className="text-purple-600 dark:text-purple-400">export const</span>{' '}
                      <span className="text-neutral-700 dark:text-neutral-300">pay</span> ={' '}
                      <span className="text-blue-600 dark:text-blue-400">kuluPay</span>({'{'}
                      {'\n  '}
                      providers: {'{'} stripe, paypal, chapa {'}'},{'\n  '}
                      database: <span className="text-blue-600 dark:text-blue-400">createPgPoolDriver</span>(process.env.DATABASE_URL!),{'\n  '}
                      {'\}'});
                    </code>
                  </pre>
                </div>
              </div>

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
                  Start accepting payments with confidence in minutes.
                </p>
                <a
                  href="/docs/introduction"
                  className="relative inline-flex items-center gap-1.5 px-5 py-2 mt-4 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Read the Docs →
                </a>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
