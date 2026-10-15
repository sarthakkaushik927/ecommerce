# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The include above carries the project rules (money as paise, backend layering, pricing, order
status, design). They are binding — this file adds the mechanics and the cross-file wiring that
are not obvious from any single file.

## Orientation

Three apps, one backend, one Postgres:

```
mobile/ (Expo, Yarn) ──┐
                       ├─► backend/ (Express 5 + Prisma, pnpm) ─► Postgres (Neon)
frontend/ (Next 16, pnpm, admin BFF) ──┘                       ├─► SMTP (Mailpit in dev)
                                                               └─► WhatsApp (meta | twilio | log)
```

`docs/` is authoritative and kept in sync with the code. Read [docs/PLAN.md](docs/PLAN.md) first
(living task list, tick as you go), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3–5 for
layers, modules and both client architectures. `docs/API.md` and `docs/DATABASE.md` must be
updated alongside endpoint and schema changes.

## Commands

`backend/` and `frontend/` use **pnpm**; `mobile/` uses **Yarn**. Each has its own lockfile — never
cross them. Add native mobile deps with `npx expo install`, not `yarn add`.

```bash
# backend (cd backend)
pnpm db:generate                       # REQUIRED after clone or schema change (see gotchas)
pnpm dev                               # :4000, tsx watch, loads .env
pnpm db:migrate / db:seed / db:studio
pnpm test                              # all vitest
pnpm test:unit                         # unit only — no database needed
pnpm test:int                          # integration — needs TEST_DATABASE_URL
pnpm test tests/unit/pricing.test.ts   # one file
pnpm test -t "caps percentage coupons" # one case by name (substring match)
pnpm typecheck && pnpm lint

# frontend (cd frontend)
pnpm dev                               # :3000
pnpm typecheck                         # runs `next typegen` first — do not use bare tsc
pnpm build && pnpm lint

# mobile (cd mobile) — needs a dev build, not Expo Go (native speech module)
npx expo run:android                   # first run / after native dep changes
yarn start                             # press a for Android
yarn test                              # jest-expo; tests live in mobile/tests/, never src/app/
yarn test tests/voice-query.test.ts    # one file
yarn typecheck && yarn lint

# repo root — end-to-end smoke against a running, seeded API (dev DB only, creates real rows)
node --env-file=backend/.env tests/smoke/run.mjs
```

Integration tests: `TEST_DATABASE_URL` **must** include `?schema=<name>`; `tests/setup/global-setup.ts`
refuses to run without it, then applies migrations and truncates that schema. `docker compose up -d`
gives you Postgres on :5432 plus Mailpit (SMTP :1025, inbox http://localhost:8025). Integration
files share one database, so `fileParallelism` is off — they run sequentially.

## How a request flows

```
route (auth middleware) → handler: schema.parse() → service → prisma
                                                       └─► inBackground(notify…) after commit
```

- **Envelope, everywhere.** Success is `{ data, meta? }` via `ok(data, meta)` from `lib/http.ts`;
  failure is `{ error: { code, message, details? } }`. Both clients decode exactly this shape
  (`Envelope<T>` in `frontend/lib/server/api.ts` and `mobile/src/lib/api.ts`). Changing it breaks
  three codebases at once.
- **Never map errors in a handler.** Services throw `AppError` (`lib/errors.ts`, code → HTTP status
  table). `middleware/error-handler.ts` additionally normalizes `ZodError` → 422 with per-path
  details, Prisma P2002/P2025/P2003 → 409/404/409, Multer and malformed JSON → 400. So letting
  `schema.parse()` throw straight out of a handler is the intended style.
- **Auth guards** come from `middleware/auth.ts`: `authenticate` (401 without a token),
  `optionalAuth` (guests pass through — used by guest-browsable catalog routes), and the
  `adminOnly` array. Handlers get the principal via `requireUser(req)`, never `req.auth` directly.
- **Adding a module:** create `*.routes.ts` / `*.schema.ts` / `*.service.ts` under
  `src/modules/<name>/`, export `xRouter` and, if it has admin endpoints, a separate `adminXRouter`
  from the same routes file, then register both in `src/routes.ts`. Everything mounted on the
  `admin` router there inherits `/api/v1/admin` and must apply `adminOnly`. A route not registered
  in `routes.ts` is invisible — there is no file-based routing.
- **Background work:** `inBackground()` in `services/notify/index.ts` runs side effects off the
  response path and swallows (logs) errors. Tests must `await flushNotifications()` before
  asserting on `NotificationLog`; `server.ts` awaits it on shutdown.
- **Pricing order of operations** is fixed: items → coupon → coins → delivery fee → payable, with
  coins capped by `coinMaxRedeemPercent` and 1 coin = 100 paise (`PAISE_PER_COIN`). Clients render
  the server's `PriceSummary`; the smoke test asserts quote-equals-order-payable.

## Admin (frontend/) specifics

- **`proxy.ts` at the app root, not `middleware.ts`** — Next 16 renamed it. It guards every page and
  rotates the access token *before* rendering, forwarding new cookies to both the browser and the
  current render.
- Tokens live only in httpOnly cookies (`haat_at` / `haat_rt` / `haat_admin`, contract in
  `lib/auth/session-cookies.ts`) and never reach client JS. Concurrent prefetches share one
  rotation per refresh token via a 15 s dedupe map.
- `lib/server/api.ts` is the only module that talks to the backend (`server-only`); a 401 or a
  missing token `redirect("/session-expired")`. Server Actions re-authorize themselves with
  `requireAdmin()` from `lib/server/session.ts` — they do not trust the page that rendered them —
  and wrap work in `runAction()`, which converts `ApiError` into `{ ok: false, message, fieldErrors }`
  for forms while letting `redirect()`/`notFound()` propagate.
- Path alias is `@/*` → project root. `cacheComponents: true`, so request-time data must sit behind
  `<Suspense>`. Server Action bodies are capped at 6 MB for image uploads.

## Mobile specifics

- Tokens live in the Zustand store (`src/lib/auth-store.ts`, backed by SecureStore).
  `src/lib/api.ts` refreshes on 401 and retries once, with single-flight `refreshOnce()` so parallel
  React Query calls don't race the same refresh token.
- Routes in `src/app/` (Expo Router); hooks, components and lib stay outside it under `src/`.
  Server state goes through the React Query hooks in `src/hooks/`; guest-protected actions through
  `useRequireAuth().guard(...)`.
- `EXPO_PUBLIC_API_URL` must be your machine's LAN IP for a physical device. With scrcpy, use
  `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4000 tcp:4000` then
  `npx expo start --localhost -c`.
- **Voice search needs a native build.** `expo-speech-recognition` is not in Expo Go. Permission
  flow, on-device model checks and transcript cleanup live in `src/hooks/use-voice-search.ts` and
  the pure `src/lib/voice-query.ts`; `src/components/search/voice-search-modal.tsx` renders it.
  Jest tests put the native module behind `tests/mocks/speech.ts` — note RNTL v14's `renderHook`
  and `act` are both **async**, so every call must be awaited or renders interleave across tests.

## Gotchas

- **`backend/src/generated/` is gitignored.** Prisma 7 emits the client there
  (`provider = "prisma-client"`, ESM), so a fresh clone has no client until `pnpm db:generate`.
  Import models from `src/generated/prisma/client.js` and enums from
  `src/generated/prisma/enums.js` — **not** `@prisma/client`.
- **Backend is ESM with `moduleResolution: NodeNext`: every relative import needs a `.js`
  extension**, even from `.ts` files (`./cart.service.js`). Omitting it fails at runtime.
  `verbatimModuleSyntax` is on, so type-only imports need `import type`.
- **`no-console` is an ESLint error in backend src** (allowed in `prisma/seed.ts` and `tests/`).
  Use the pino `logger` from `lib/logger.ts`.
- `no-explicit-any` is an error in backend; the repo-wide rule is no `any` anywhere.
- Neon connections occasionally stall on some networks; `lib/db-pool.ts` and `lib/prisma.ts` retry
  and set deadlines. Rerun a failed suite once before debugging it (see docs/TESTING.md §3a).
- Next 16 APIs may postdate your training data — read `frontend/node_modules/next/dist/docs/`
  before using an unfamiliar one.
