import { ImageResponse } from 'next/og';
import * as z from 'zod';

const ogSchema = z.object({
  heading: z.string().default('KuluPay Documentation'),
  mode: z.string().default('dark'),
  type: z.string().default('documentation'),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const urlParamsValues = Object.fromEntries(url.searchParams);
    const validParams = ogSchema.parse(urlParamsValues);
    const { heading, type } = validParams;
    const trueHeading =
      heading.length > 140 ? `${heading.substring(0, 140)}...` : heading;

    const fontSize = trueHeading.length > 100 ? '30px' : '60px';

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px',
            backgroundColor: '#0a0a0a',
            color: '#fff',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '40px',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                fontWeight: 700,
                textTransform: 'uppercase',
                gap: '8px',
                alignItems: 'center',
                marginTop: '40px',
                color: '#a1a1aa',
              }}
            >
              {type}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize,
                fontWeight: 700,
                marginTop: '20px',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                maxWidth: '70%',
              }}
            >
              {trueHeading}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '0 40px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '24px', fontWeight: 600 }}>
              KuluPay
            </div>
            <div style={{ display: 'flex', fontSize: '20px', color: '#a1a1aa' }}>
              github.com/kulupay/kulupay
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response('Failed to generate the OG image', { status: 500 });
  }
}
