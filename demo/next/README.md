# KuluPay Next.js Demo

A minimal Next.js application that demonstrates the `kulupay` integration.

## Run locally

```bash
pnpm install
pnpm --filter kulupay-next-demo dev
```

Open [http://localhost:3000](http://localhost:3000).

The API route is at `/api/pay` and is wired through `toNextJsHandler`.

## Deploy to Vercel

The project is configured as part of the `kulupay` pnpm workspace.

- Use the `kulupay` folder as the Vercel root directory.
- Vercel will run `pnpm install` for the workspace and then `pnpm --filter kulupay-next-demo build`.
- Output directory: `demo/next/.next`.

See `vercel.json` in the monorepo root for the build command.
