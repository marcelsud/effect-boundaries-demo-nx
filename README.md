# Effect boundaries demo — Nx

Three teams own Catalog, Logistics, and Pricing in one monorepo. Catalog calls
Logistics and Pricing directly through Effect services in the same process.
Each team has one package, one public entry point, and private repositories.

This variant uses Nx's native tasks and boundary features. There is no
custom import scanner, metadata validator, lint adapter, or test runner.
The original implementation is at
[effect-boundaries-demo](https://github.com/marcelsud/effect-boundaries-demo).

## Run the example

Requires Node.js 24+, Bun 1.4.4, and Git for the commit demonstration.

```sh
git clone https://github.com/marcelsud/effect-boundaries-demo-nx.git
cd effect-boundaries-demo-nx
bun install --frozen-lockfile
bun run check
bun run setup:hooks
```

`check` runs native boundary enforcement, builds all five projects, and runs
the application assertions. `build` checks boundaries before compiling, and
`demo` builds its dependencies before running the application.

```text
packages/catalog       @shop/catalog       Catalog, CatalogLive
packages/logistics     @shop/logistics     Logistics, LogisticsLive
packages/pricing       @shop/pricing       Pricing, PricingLive
architecture           @shop/architecture  Central Layer contracts
apps/demo              @shop/demo          Application and runtime assertions
```

Catalog may import Logistics and Pricing. Logistics and Pricing may not
import another team's package. The architecture check and application may
import all three public services.

The application prints:

```json
{
  "id": "p-1",
  "name": "Keyboard",
  "availableQuantity": 12,
  "price": { "amountCents": 19900, "currency": "BRL" }
}
```

It also checks missing product/price failures and zero inventory for an unknown
product. These assertions live in the application, not a custom test runner.

## Public interfaces and Effect Layers

Each service package exports only `.` in `package.json`. Its `src/index.ts`
exports the service, public DTO/error types, and its implementation Layer.
TypeScript resolves the public source barrel; Node resolves `dist/index.js`.
There are no separate API packages or RPC definitions.

```ts
import { Effect, Layer } from "effect"
import { Catalog, CatalogLive } from "@shop/catalog"
import { LogisticsLive } from "@shop/logistics"
import { PricingLive } from "@shop/pricing"

const CommerceLive = CatalogLive.pipe(
  Layer.provide(Layer.mergeAll(LogisticsLive, PricingLive))
)

const product = await Effect.runPromise(
  Effect.gen(function* () {
    const catalog = yield* Catalog
    return yield* catalog.getProduct("p-1")
  }).pipe(Effect.provide(CommerceLive))
)
```

`architecture/src/check.ts` checks exported Layers against the allowed provider
requirements: Catalog requires `Logistics | Pricing`; Logistics and Pricing
require no external providers. Each package satisfies its own repository
internally. This is ordinary TypeScript checking of Effect types, not a custom
architecture script.

## Native Nx configuration

- `nx.json` defines cached builds, dependency ordering with `^build`, and the
  native `@nx/eslint/plugin` that infers lint targets.
- Each package declares a `scope:*` tag in its `package.json` `nx` field.
- `eslint.config.mjs` uses Nx's `@nx/enforce-module-boundaries` rule. Its
  `depConstraints` centrally specify which tags each scope may depend on.
- Every build depends on its lint target and its dependencies' builds. Linting
  is uncached, so cached build outputs do not skip the boundary rule.
- `dist` and TypeScript incremental metadata are cached together. Shared
  compiler/lint configuration and dependency inputs participate in build hashes.

Useful native commands:

```sh
bunx nx graph
bunx nx build @shop/catalog
bunx nx affected -t build --base=origin/main
bunx nx show project @shop/catalog
```

Nx's boundary rule rejects relative imports into other projects and forbidden
scope imports. Package exports and TypeScript enforce the declared public API.
The rule uses Nx's project graph; no separate import-policy file is maintained.

This example pins Nx 24.0.4 and TypeScript 6.0.3. Nx's current TypeScript/ESLint
integration uses the TypeScript 6 compiler API.

## Simulate a rejected commit using Git

Start with a clean working tree, run `bun run check`, then install the hook
with `bun run setup:hooks`. Apply the included patch:

```sh
git apply examples/private-import.patch
bunx tsc -p packages/catalog --noEmit --tsBuildInfoFile packages/catalog/type-probe.tsbuildinfo
git add packages/catalog/src/internal/Module.ts
git commit -m "Read Pricing internals from Catalog"
```

The patch changes Catalog to import and internally provide
`../../../pricing/dist/internal/PriceRepository.js`. TypeScript alone accepts
the Layer because its private provider is already satisfied. The native boundary
check rejects the import, so the hook rejects the commit. HEAD stays unchanged.
See [the captured commit output](examples/rejected-commit.txt).

Restore only the demonstration change:

```sh
git restore --staged --worktree -- packages/catalog/src/internal/Module.ts
```

A second patch, `examples/forbidden-dependency.patch`, makes Logistics import
Pricing's public interface and adds both the package dependency and TypeScript
project reference. Native scope rules reject that dependency too:

```sh
git apply examples/forbidden-dependency.patch
bun run check
git restore --worktree -- packages/logistics/package.json packages/logistics/tsconfig.json packages/logistics/src/internal/Module.ts
```

Apply the patches separately. The restore commands discard the listed files'
demonstration changes, so use them only after starting from a clean checkout.

## Enforcement limits

These are native static architecture checks, not a sandbox against arbitrary
JavaScript. This variant does not retain the original custom regression runner
or claim identical coverage for computed module loaders, arbitrary tsconfig
alias remapping, or source excluded from native discovery. Changing public
exports changes the package's public interface.

The pre-commit hook runs `bun run check`; Git hooks can be skipped. Require the
same command in CI. Copy `.github/CODEOWNERS.example` to `.github/CODEOWNERS`,
replace the illustrative team handles, and require owner review for boundary
rules, tags, exports, TypeScript configuration, and hooks.
