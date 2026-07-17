# Contributing to KuluPay

Thank you for your interest in contributing to KuluPay! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) v10 or higher

## Getting Started

1. **Clone the repository:**

```bash
git clone https://github.com/YonaniCodes/kulupay.git
cd kulupay
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Build all packages:**

```bash
pnpm build
```

4. **Run tests:**

```bash
pnpm test
```

5. **Run tests in watch mode (during development):**

```bash
pnpm --filter @kulupay/core test:watch
```

## Project Structure

```
KuluPay/
├── packages/
│   ├── core/           ← @kulupay/core — core logic, types, schema, providers
│   ├── kulupay/        ← @kulupay/kulupay — full SDK (server handler, client, integrations)
│   └── cli/            ← @kulupay/cli — CLI tool for schema generation and migration
├── demo/
│   └── next/           ← Next.js demo app
├── vitest.config.ts    ← Root test config (dev-source resolution)
├── turbo.json          ← Turborepo pipeline config
└── pnpm-workspace.yaml ← Workspace definition
```

## Development Workflow

### Writing Code

- Source code lives in `src/` directories within each package
- Tests live next to the code they test (e.g., `src/db/test/get-tables.test.ts`)
- CLI tests live in `test/` directory within the CLI package

### Testing

Tests use [Vitest](https://vitest.dev/) and run against source files directly (no build needed) via the `dev-source` export condition.

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @kulupay/core test

# Watch mode
pnpm --filter @kulupay/core test:watch

# Update snapshots
pnpm test -- -u
```

### Building

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @kulupay/core build
```

### Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by Biome)
- Add JSDoc comments to all public API exports
- Run `pnpm format` before committing

## Adding a New Payment Provider

1. Create a new file in `packages/core/src/payment-providers/`
2. Implement the `PaymentProvider` interface
3. Use dynamic `import()` for any SDK dependencies (e.g., `@stripe/stripe-js`)
4. Export the provider from `packages/core/src/payment-providers/index.ts`
5. Add tests in `packages/core/src/payment-providers/test/`

## Adding a New CLI Command

1. Create a new file in `packages/cli/src/commands/`
2. Use `commander` to define the command and options
3. Export the action function for testing
4. Register the command in `packages/cli/src/index.ts`
5. Add tests in `packages/cli/test/`

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes and add tests
3. Ensure all tests pass: `pnpm test`
4. Ensure the build passes: `pnpm build`
5. Format your code: `pnpm format`
6. Commit with a clear message (conventional commits preferred)
7. Open a pull request with a description of your changes

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation only changes
- `refactor:` — Code changes that neither fix a bug nor add a feature
- `test:` — Adding or correcting tests
- `chore:` — Changes to the build process or auxiliary tools

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
