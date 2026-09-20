# pergolando-frontend

App Venditore's frontend — Next.js (App Router). Part of [Pergolando](https://github.com/daviderdsign),
a white-label configurator for pergola/awning manufacturers.

One deployment per tenant, same as [pergolando-backend](https://github.com/daviderdsign/pergolando-backend)
— see that repo's README for why there's no client-side "switch tenant" logic here: each container talks to
exactly one backend, which already carries that tenant's branding and catalog.

## Scope of this slice

Login/register and the first wizard step (end-client details + product/sotto-modello/variante selection,
loaded from the backend's `GET /api/v1/catalog`). **Not yet built**: dimensions (VEN-4), price calculation
(VEN-6), PDF output (VEN-7), the photo-based measurement flow (VEN-10/11/12). "Avanti" on the wizard is
disabled — there's nowhere for it to go yet.

## Stack

- Next.js App Router, TypeScript strict, no CSS framework (plain CSS, same approach as Studio).
- `@pergolando/shared/schema` (git dependency) for the `CatalogDatabase` type, so the catalog rendering
  can't silently drift from what the backend actually returns.
- Minimal in-house i18n (IT/EN dictionary + a language switcher, not a full library yet) — `<html lang>` is
  kept in sync with the selected language for screen readers.
- Playwright + `@axe-core/playwright` wired into CI from the start, even with only two pages to check.

## Development

Requires Node 24 (`.nvmrc`) and pnpm. Needs [pergolando-backend](https://github.com/daviderdsign/pergolando-backend)
running (see that repo's README) — this app has no backend logic of its own.

```bash
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at the tenant's backend
pnpm install
pnpm dev
```

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e       # starts its own dev server; backend not required for these checks yet
```

## Docker

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://tenant-api.example.com -t pergolando-frontend .
docker run -p 3000:3000 pergolando-frontend
```

`NEXT_PUBLIC_API_URL` is baked in at build time (it's a browser-visible env var), so each tenant needs its
own image build, not just a different container env var.

## Git Flow

`main` (releases) + `develop` (integration) + `feature/*`. PRs required into both.
