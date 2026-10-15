# Testing Strategy

## 1. Pyramid

| Level | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Pure logic: pricing engine, coupon rules, coin math, order status machine, search-term normalisation, slug/money helpers | `backend/tests/unit` |
| Unit (mobile) | Jest (`jest-expo`) | Voice-search permission/recognition state machine and transcript cleanup, with the native speech module mocked | `mobile/tests` |
| Integration | Vitest + Supertest | HTTP → service → real Postgres: auth, catalog, cart → order, cancel, rider assignment | `backend/tests/integration` |
| Static | `tsc --noEmit`, ESLint | All three apps | each app |
| Smoke / E2E | Node script against a running API | Guest browse → register → cart/coupon → order → admin confirm/pack/assign rider/deliver → coins, review, return → buy-now cancel; checks the response fields both clients read | `tests/smoke/run.mjs` |
| Manual | Checklist below | Mobile UX on Android/iOS, admin flows | — |

## 2. Running

```bash
# backend
cd backend
pnpm test            # all tests
pnpm test:unit       # unit only, no DB needed
pnpm test:int        # integration, needs TEST_DATABASE_URL
pnpm typecheck && pnpm lint

# admin
cd frontend && pnpm typecheck && pnpm lint && pnpm build

# mobile
cd mobile && yarn typecheck && yarn lint
yarn test                              # jest-expo unit tests
yarn test tests/voice-query.test.ts    # one file
yarn test -t "never re-prompts"        # one case by name

# smoke, from the repo root (API must be running and seeded)
node --env-file=backend/.env tests/smoke/run.mjs
```

## 3. Test database

Integration tests use `TEST_DATABASE_URL`. **Never point it at production.** Two options:

- A **Neon branch** created from the main branch, e.g. `test`. It is cheap and isolated.
- Local Postgres from `docker compose up -d postgres`: `postgresql://haat:haat@localhost:5432/haat_test`.

`TEST_DATABASE_URL` must carry `?schema=<name>`. Before the run the suite applies migrations to that schema (`prisma migrate deploy`) and truncates every table (see `tests/setup/global-setup.ts`). Each test file creates its own users and products with unique suffixes, so files can run in sequence without cross-talk.

## 3a. Smoke test (`tests/smoke/run.mjs`)

Plain Node (no dependencies). It plays guest, customer and admin against a running, seeded API:

1. **Guest:** home feed, category tree, listing filters, facets, suggestions, trending, product detail, settings, offers. `/cart` must return 401.
2. **Customer:** register, login by phone, refresh-token rotation, address, wishlist heart, add to cart, cart count, server price summary (payable must add up), coupon apply and invalid coupon, checkout quote, place a COD order (payable must equal the quote), cart cleared, stock reserved.
3. **Admin:** customer token gets 403, dashboard, find order by number, PLACED → CONFIRMED → PACKED, an illegal jump is rejected with 409, assign rider, notification log rows written, OUT_FOR_DELIVERY → DELIVERED.
4. **Customer again:** full timeline, rider details, coins credited, in-app notifications, review, return approved by admin.
5. **Cancel flow:** buy-now order, then cancel. Stock must be restored. Logout must revoke the refresh token.

Every request has a 30 s deadline, so a hung endpoint fails with its path instead of stalling. Admin steps read `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` (hence `--env-file=backend/.env`). Each run creates a throwaway `smoke+<timestamp>@haat.test` customer and two orders, so **run it against a dev database only**. Override the target with `API_URL`.

**Flaky network to Neon.** On some networks, opening Postgres connections to Neon occasionally stalls (reproduced with bursts of 10 parallel connects). The API guards against it: `lib/db-pool.ts` retries stalled connects, and `lib/prisma.ts` keeps connections warm and sets connect/query deadlines. If a run still fails with 500s or a `prisma migrate deploy` error in global setup, rerun before debugging.

## 4. What must always be covered

- The pricing engine handles every combination: no coupon, percent with cap, flat, below the min order, coins cap, the free-delivery threshold, and a coupon combined with coins.
- Order placement is atomic. When stock is insufficient for one line, nothing is written.
- Stock is restored on cancel and on return.
- Coupon per-user and total limits are enforced.
- Coins are credited only on DELIVERED and reversed on RETURNED.
- Illegal status transitions are rejected.
- Assigning an inactive or unknown rider is rejected. A valid assignment writes NotificationLog rows.
- Guest calls to protected endpoints return 401. A customer calling admin endpoints gets 403.
- Voice search asks the OS for microphone access only when the dialog will actually appear, and
  never re-prompts once the permission is blocked.
- A refused microphone permission ends in a cancelled sheet with a Settings action, never a crash.
- Spoken filler and punctuation are stripped from a transcript, and the query is capped at 100
  characters; prose is never recorded as a trending search term.

## 5. Manual QA checklist (release)

- [ ] Fresh install: splash → onboarding → home as guest
- [ ] Guest taps Add to cart → login sheet → after login the item is in the cart
- [ ] Search suggestions, filters and sort combinations
- [ ] Voice search: allow the mic prompt → partial text appears → transcript fills the box and suggestions render, with no automatic navigation
- [ ] Voice search: deny the prompt → sheet cancels, inline alert appears; deny permanently then reopen → no second OS prompt, **Open Settings** reaches the Haat app settings page
- [ ] Voice search: switch to हिन्दी and dictate Hindi; and dictate in aeroplane mode to prove recognition is on-device
- [ ] Product with variants: switching variant updates the price, MRP and stock
- [ ] Coupon apply and remove, invalid coupon message
- [ ] Coins toggle shows the correct deduction and cap
- [ ] Place a COD order and see the success screen and order in the list
- [ ] Admin: confirm → pack → assign rider → the customer gets email/WhatsApp, the rider's name and phone show in the app
- [ ] Mark delivered → coins credited in the app
- [ ] Cancel flow restores stock (check the admin inventory)
- [ ] Return flow
- [ ] Admin CRUD for every entity; image upload
- [ ] Android back button behaviour, keyboard avoiding on forms, small screens (360 dp)
