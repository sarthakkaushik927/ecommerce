# Haat — Local E-commerce Platform

A Flipkart-style shopping platform built for a local business. It has three parts:

- a **React Native mobile app** for customers,
- a **Next.js admin dashboard** for the store (inventory, orders, riders, promotions),
- a **Node.js + TypeScript API** that both clients share.

Delivery uses the store's own registered riders. When the admin assigns one, the customer, the rider and the admin receive the order ID and the rider's name and phone by **email and WhatsApp**. There is no live tracking.

```
mobile (Expo) ─┐
               ├─► backend (Express + Prisma) ─► PostgreSQL (Neon)
admin (Next) ──┘                              ├─► SMTP email
                                              └─► WhatsApp API
```

## Features at a glance

| Customer app | Admin dashboard |
|---|---|
| Splash, onboarding, guest browsing | KPI overview, revenue chart |
| Login / signup / OTP password reset | Products + variants + images CRUD |
| Home: banners, categories, deals | Categories & brands CRUD |
| Search: suggestions, filters, sort, voice (on-device, EN + HI) | Inventory: stock levels, adjustments, movement log |
| Product: gallery, variants, offers, reviews | Orders: status flow, assign rider, notifications |
| Wishlist, cart, coupons, Haat Coins | Riders registry |
| Checkout: addresses, COD / UPI on delivery | Customers, coins adjustment, block |
| Orders: timeline, rider contact, cancel, return | Coupons, banners, reviews moderation |
| Profile, addresses, coins history, notifications | Store settings, notification log |

## Quick start

Prerequisites: Node 22+, pnpm 10+ (backend, admin), Yarn 1.22 (mobile), Docker (optional, for Mailpit and the test DB), and an Android emulator or the Expo Go app.

```bash
# 1. services (email catcher + local test db)
docker compose up -d

# 2. backend
cd backend
cp .env.example .env        # put your Neon URLs in DATABASE_URL / DIRECT_URL
pnpm install
pnpm db:migrate             # create tables
pnpm db:seed                # admin user, settings, demo catalog
pnpm dev                    # http://localhost:4000/api/v1/health

# 3. admin dashboard
cd ../frontend
cp .env.example .env.local
pnpm install
pnpm dev                    # http://localhost:3000  (login with ADMIN_SEED_EMAIL / PASSWORD)

# 4. mobile app
cd ../mobile
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000/api/v1
yarn install
# Voice search uses a native on-device speech module, so Expo Go will not run this app.
# Build once, then `yarn start` reuses the dev build.
npx expo run:android        # or: eas build --profile development
yarn test                   # jest-expo unit tests
# or 

#if using scrcpy
adb reverse tcp:8081 tcp:8081  
adb reverse tcp:4000 tcp:4000

npx expo start --localhost -c   #then press a
```

Emails sent in development appear in Mailpit at http://localhost:8025.

## Documentation

| Doc | What's inside |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Living build plan and task checklist |
| [docs/PRD.md](docs/PRD.md) | Product requirements, pricing rules, order lifecycle |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System, backend, admin and mobile architecture |
| [docs/DATABASE.md](docs/DATABASE.md) | Data model and indexes |
| [docs/API.md](docs/API.md) | REST endpoint reference |
| [docs/FLOWS.md](docs/FLOWS.md) | User and system flows |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system: yellow and white theme, components |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and QA checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosting, env vars, release, security |
| [AGENTS.md](AGENTS.md) | Conventions for contributors and AI agents |

## Tech stack

- **Backend:** Express 5, TypeScript, Prisma 7 (`@prisma/adapter-pg`), Zod, JWT, bcrypt, Nodemailer, Pino, Vitest and Supertest.
- **Admin:** Next.js 16 (App Router, Cache Components, Server Actions), Tailwind CSS 4, Recharts, Lucide.
- **Mobile:** Expo SDK 57, Expo Router, TanStack Query, Zustand, Expo SecureStore, Expo Image, `expo-speech-recognition` (on-device voice search), Jest (`jest-expo`).
