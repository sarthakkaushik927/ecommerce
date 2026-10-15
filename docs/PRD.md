# Product Requirements Document — Haat

## 1. Summary

**Haat** is an e-commerce platform for a local business. It is built as three parts:

| Part | Users | Tech |
|---|---|---|
| Mobile app | Shoppers (guests and signed-in customers) | Expo / React Native |
| Admin dashboard | Store owner and staff | Next.js 16 |
| Backend API | Both clients | Node.js, Express 5, TypeScript, PostgreSQL (Neon), Prisma |

The shopping experience follows Flipkart: browse, search, filter, wishlist, cart, coupons, coins, checkout and orders. Delivery uses the business's own riders. The admin assigns a registered rider to an order. The customer, the rider and the admin then get the rider's details by email and WhatsApp. **There is no live GPS tracking.**

## 2. Goals

1. Anyone can browse the full catalog without an account.
2. Customers can go from opening the app to placing an order in under 60 seconds.
3. Every price is fully transparent: MRP, discount, coupon, coins, delivery fee and final payable amount.
4. The admin manages the entire business from one dashboard: catalog, inventory, orders, riders, customers, coupons, banners and settings.
5. Delivery coordination is simple. Assigning a rider sends the order ID and the rider's name and phone to everyone involved.

## 3. Non-goals (v1)

- Live rider location or map tracking.
- A rider app. Riders are records managed by the admin and are contacted by email or WhatsApp.
- A multi-vendor marketplace.
- An admin area inside the mobile app.

## 4. Personas

- **Guest:** opens the app and browses products, categories and offers. Any action that changes state (add to cart, wishlist, buy, review) prompts them to log in or sign up.
- **Customer:** a signed-in shopper who buys, tracks order status, earns and redeems coins, and writes reviews.
- **Admin:** runs the store. Has full CRUD over everything and handles order fulfilment.
- **Rider:** never logs in. Receives order details by email and WhatsApp and delivers the order.

## 5. Functional requirements

### 5.1 Mobile app

| Area | Requirements |
|---|---|
| Launch | Splash screen, first-run onboarding (3 slides), skip option |
| Auth | Sign up (name, email, phone, password), login, forgot password (email OTP), logout. Guests are prompted with a bottom-sheet login wall on protected actions |
| Home | Search bar, banner carousel, category strip, "Deals of the day", "Top rated", "New arrivals", "Under ₹499", recently viewed |
| Navigation | Floating bottom pill tab bar: Home, Categories, Wishlist, Cart (badge), Account |
| Categories | Parent categories in a left rail, sub-categories in a grid |
| Listing | Infinite scroll grid. Filters: brand, price range, rating, discount, in stock. Sort: relevance, popularity, price ↑/↓, newest, discount |
| Search | Live suggestions, recent searches, trending searches, **voice search (on-device)**, results reuse the listing screen |
| Product | Image gallery, variant selector (size/colour), MRP struck through, price, % off, rating summary, offers and available coupons, coins you will earn, highlights/specs, delivery info, reviews, similar products, sticky Add to cart / Buy now |
| Wishlist | Grid, move to cart, remove |
| Cart | Line items with qty stepper, save for later (wishlist), coupon input and list, coins toggle, price details card (MRP, discount, coupon, coins, delivery, total, "You save ₹X") |
| Checkout | Address select/add/edit, order summary, payment method (Cash on Delivery / UPI on Delivery), place order, success screen with order ID and coins earned (pending) |
| Orders | List with status chips. Detail with item list, price breakup, status timeline, rider name and tap-to-call/WhatsApp once assigned, cancel (before dispatch), request return (within the return window after delivery), write review |
| Account | Profile edit, addresses, coins balance and history, my coupons, notifications, change password, help/FAQ, about, logout |
| Reviews | Rating 1–5, title, comment. Only customers with a delivered order for the product can review |

### 5.2 Admin dashboard

| Area | Requirements |
|---|---|
| Auth | Admin login, session refresh, logout |
| Overview | KPIs (revenue today/30d, orders, AOV, customers, low-stock count), revenue chart, orders by status, top products, recent orders |
| Products | Table with search, category/brand/status filter. Create/edit: name, slug, description, highlights, specs, category, brand, images (upload/URL), variants (label, SKU, MRP, price, stock, low-stock threshold), tags, featured flag, active flag. Archive/delete |
| Categories | Tree CRUD (parent/child), image, sort order, active flag |
| Brands | CRUD |
| Inventory | Variant stock table, low-stock filter, adjust stock (in / out / set) with reason, movement history per variant |
| Orders | Filter by status/date/search. Detail: customer, address, items, payment, price breakup, timeline. Actions: confirm, pack, assign rider, out for delivery, delivered, cancel, approve/reject return, add internal note, resend notifications |
| Riders | CRUD: name, phone, WhatsApp number, email, vehicle type/number, ID proof number, address, active flag. Shows the rider's assigned orders |
| Customers | List/search, detail with orders and coins, block/unblock, manual coin adjustment |
| Coupons | CRUD: code, description, type (percent/flat), value, max discount, min order value, start/end date, total usage limit, per-user limit, first-order-only, active |
| Banners | CRUD: title, image, link target (product/category/search/none), placement, sort order, active window |
| Reviews | List, filter by rating, hide/unhide, delete |
| Settings | Store name, support phone/email, admin notification email and WhatsApp number, delivery fee, free-delivery threshold, coin earn rate, coin redemption cap, return window days |
| Notification log | Every email/WhatsApp send with status and error |

### 5.3 Pricing and promotions

- **MRP vs price:** each variant has `mrp` and `price`. Discount % = `round((mrp - price) / mrp * 100)`.
- **Coupons:** a percent coupon gives `min(subtotal * value%, maxDiscount)`. A flat coupon gives `value`. A coupon requires `subtotal >= minOrderValue` and must be inside its validity window. Total and per-user limits are enforced. First-order-only coupons need zero prior non-cancelled orders.
- **Coins:**
  - Earned on delivery: `floor(payable / 100) * earnRate`. The default is 2 coins per ₹100.
  - Redeemed at checkout: 1 coin = ₹1, capped at `maxRedeemPercent` of the post-coupon amount. The default cap is 20%.
  - Every coin change is a ledger entry.
- **Referral system:**
  - Unique uppercase alphanumeric code (e.g. `HAAT4X8K`) assigned to each customer upon account creation or migration.
  - Attribution during registration or before first order. Self-referrals (same user ID, email, or phone) and cyclic referrals (A refers B and B refers A) rejected with `400 BAD_REQUEST`. Max 1 referrer per referee, immutable once applied.
  - Trigger: Strictly on referee's first `DELIVERED` order. Referrer receives ₹50 worth of coins (`BONUS`), referee receives ₹25 worth of coins (`BONUS`).
  - Reversal: If the triggering order is marked `CANCELLED` or `RETURNED`, compensating ledger entries (`REVERSE`) reverse pending/awarded coins without driving balances negative.
  - Admin settings: Toggle active/inactive, editable referrer bonus, referee bonus, and total referral coins.
- **Delivery fee:** a flat fee, free when the post-discount amount is at or above the threshold. Defaults are ₹40, free from ₹499.
- **Order of operations:** subtotal(price) → coupon → coins → delivery fee → payable.
- All money is stored as **integer paise**.

### 5.4 Order lifecycle

```
PLACED → CONFIRMED → PACKED → RIDER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED
   └──────────┴─────────┴──────────┴→ CANCELLED (stock restored, coins refunded)
DELIVERED → RETURN_REQUESTED → RETURNED (stock restored) | RETURN_REJECTED
```

- The customer can cancel while the order is `PLACED`, `CONFIRMED` or `PACKED`.
- Assigning a rider sends notifications. Reassigning a rider sends them again.
- Coins are credited at `DELIVERED` and reversed on `RETURNED`.

### 5.5 Rider assignment notifications

When the admin assigns a rider:

| Recipient | Channel | Content |
|---|---|---|
| Customer | Email + WhatsApp + in-app | Order ID, rider name, rider phone, amount to pay (COD) |
| Rider | Email + WhatsApp | Order ID, customer name, phone, full address, items, amount to collect |
| Admin | Email + WhatsApp | Copy of the assignment summary |

If WhatsApp is not configured, the dashboard shows one-tap `wa.me` links with the message pre-filled.

### 5.6 Voice search

The customer taps a microphone inside the product search bar (on the home search bar and on the
search screen). Speech is transcribed **on the device** by the OS-native engine — Android
`SpeechRecognizer` via Google's recognizer, iOS `SFSpeechRecognizer`. No audio is recorded,
uploaded or stored, and recognition works without a connection once the language model is present.

| Step | Behaviour |
|---|---|
| Permission check | The app reads the current OS permission state before doing anything else (`RECORD_AUDIO` on Android; microphone + speech recognition on iOS) |
| OS prompt | If permission has never been refused, the native system dialog asks for microphone and speech-recognition access |
| Granted | A sheet shows a pulsing mic and the live partial transcript as the customer speaks |
| Denied | The sheet cancels gracefully and shows an inline alert with an **Open Settings** action plus **Type instead**. Once the OS has blocked the permission the app never prompts again, because the dialog would not appear |
| No on-device model | The sheet explains the one-time download and, on Android, offers to start it |
| Result | The cleaned transcript fills the search box and the normal live suggestions appear. Nothing is submitted automatically, so a mis-heard word can be corrected before searching |

- **Languages:** English (`en-IN`) and Hindi (`hi-IN`), switchable in the sheet and remembered per device.
- **Transcript cleanup:** spoken filler ("show me", "search for", "dikhao", trailing "please") and
  sentence punctuation are stripped, and the query is capped at the API's 100-character limit, so
  what is searched matches product, brand and category names.
- **Trending stays clean:** spoken sentences are served as searches but are not recorded as
  trending terms.

## 6. Non-functional requirements

- **Security:**
  - bcrypt password hashes.
  - Short-lived JWT access token (15 min) and a rotating refresh token (30 days), stored hashed.
  - Rate-limited auth endpoints.
  - Helmet, CORS allow-list.
  - Zod validation on every input.
- **Performance:** paginated lists, indexed search columns, product lists under 300 ms p95 on Neon.
- **Reliability:** order placement is atomic (single DB transaction). A failed notification never fails an order operation; failures are logged and can be retried.
- **Accessibility:** touch targets of at least 44 px, sufficient contrast (dark ink on yellow, never white on yellow for body text).
- **Localisation:** INR currency formatting (`en-IN`), Indian phone numbers, voice search in `en-IN` and `hi-IN`.
- **Privacy:** speech recognition is on-device; audio never leaves the handset and is never persisted.

## 7. Success metrics

- Checkout conversion (cart → order) ≥ 30%.
- Rider assigned within 30 minutes of an order being placed during business hours.
- Notification delivery success ≥ 98%.
