# API Reference

- **Base URL:** `/api/v1`
- **Body format:** JSON. **Money is integer paise.**
- **Auth:** `Authorization: Bearer <accessToken>`. Access tokens live 15 min. Refresh with `POST /auth/refresh`.

**Success:**

```json
{ "data": ..., "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```

**Error:**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Enter a valid email", "details": [{ "path": "email", "message": "..." }] } }
```

| Code | HTTP |
|---|---|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT`, `OUT_OF_STOCK`, `INVALID_TRANSITION` | 409 |
| `VALIDATION_ERROR`, `COUPON_INVALID` | 422 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |

When the access token has expired, the `UNAUTHORIZED` response carries `details.reason = "TOKEN_EXPIRED"`.

**Access legend:** 🌐 public (guest OK; personalised when a token is sent) · 👤 customer token · 🛡 admin token

**List queries** accept `page` (default 1) and `limit` (default 20, max 100).

---

## Auth: `/auth`

| Method | Path | Access | Body / Notes |
|---|---|---|---|
| POST | `/register` | 🌐 | `{ name, email, phone, password, referralCode? }` → `{ user, accessToken, refreshToken }` |
| POST | `/login` | 🌐 | `{ identifier (email or phone), password }` → session |
| POST | `/refresh` | 🌐 | `{ refreshToken }` → new session. Tokens rotate on every refresh. Reusing an old token revokes all sessions, except within 10 s of its rotation: parallel requests racing to refresh then each get a fresh session. Logged-out tokens get no grace |
| POST | `/logout` | 🌐 | `{ refreshToken }` → 204 |
| GET | `/me` | 👤 | current user (includes `referralCode`) |
| POST | `/password/forgot` | 🌐 | `{ email }`: emails a 6-digit OTP (10 min) |
| POST | `/password/reset` | 🌐 | `{ email, otp, password }` |
| POST | `/password/change` | 👤 | `{ currentPassword, newPassword }` |

Passwords must be at least 8 characters and contain at least one letter and one number. Auth endpoints are rate-limited to 30 per 15 min per IP.

## Storefront (guest-browsable)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/home` | 🌐 | `{ banners: { carousel, strip }, categories, rails: [{ key, title, items, query }] }` |
| GET | `/settings` | 🌐 | public store settings (fees, thresholds, coin rules, referral bonuses, payment toggles) |
| GET | `/categories` | 🌐 | tree: top-level categories with `children` |
| GET | `/categories/:slug` | 🌐 | category with parent and children |
| GET | `/brands` | 🌐 | active brands |
| GET | `/products` | 🌐 | see listing query below |
| GET | `/products/facets` | 🌐 | `{ brands: [{ slug, name, count }], price: { min, max } }` for the same query |
| GET | `/products/suggestions?q=` | 🌐 | `{ products, categories, brands }` (typeahead) |
| GET | `/products/trending-searches` | 🌐 | `string[]` |
| GET | `/products/:slug` | 🌐 | detail: images, variants, rating breakdown, top reviews, offers, `isWishlisted` |
| GET | `/products/:slug/similar` | 🌐 | product cards |
| GET | `/banners?placement=` | 🌐 | live banners |
| GET | `/coupons` | 🌐 | public offers |
| GET | `/reviews?productId=&rating=&sort=` | 🌐 | `sort`: `recent` \| `rating_high` \| `rating_low` |

### Listing query (`GET /products`)

| Param | Example | Meaning |
|---|---|---|
| `q` | `shoes` | name / tag / brand / category search |
| `category` | `smartphones` | category slug (includes sub-categories) |
| `brand` | `apple,samsung` | comma-separated brand slugs |
| `minPrice`, `maxPrice` | `0`, `49900` | paise |
| `rating` | `4` | minimum average |
| `discount` | `30` | minimum % off |
| `inStock` | `true` | — |
| `featured` | `true` | — |
| `ids` | `id1,id2` | used for "recently viewed" |
| `sort` | `relevance` \| `popular` \| `price_asc` \| `price_desc` \| `newest` \| `discount` \| `rating` | — |

### Product card shape

```json
{ "id": "…", "slug": "…", "name": "…", "brand": "Apple", "imageUrl": "…",
  "price": 7999900, "mrp": 8999900, "discountPercent": 11,
  "ratingAvg": 4.3, "ratingCount": 128, "inStock": true,
  "defaultVariantId": "… (null when several variants)", "variantCount": 1, "isWishlisted": false }
```

## Customer

| Method | Path | Notes |
|---|---|---|
| PATCH | `/profile` | `{ name?, phone?, avatarUrl? }` |
| GET | `/profile/referrals` | `{ referralCode, completedCount, pendingCount, totalCoinsEarned, referrerBonus, refereeBonus, enabled }` |
| POST | `/profile/referrals` | `{ referralCode }`: applies referral code before first order |
| POST | `/uploads/avatar` | multipart `file` (JPEG/PNG/WebP, max 5 MB) → `{ url }` |
| GET/POST | `/addresses` | list / create `{ name, phone, line1, line2?, landmark?, city, state, pincode, type, isDefault }` |
| PATCH/DELETE | `/addresses/:id` | update / delete (the default moves to the next address) |
| POST | `/addresses/:id/default` | make default |
| GET | `/wishlist` | product cards |
| GET | `/wishlist/ids` | `string[]` of product IDs |
| PUT/DELETE | `/wishlist/:productId` | add / remove (204) |
| GET | `/cart?coupon=CODE&useCoins=true` | `{ items: CartLine[], summary: PriceSummary }` |
| GET | `/cart/count` | `{ count }` (badge) |
| GET | `/cart/coupons` | coupons with `applicable` / `reason` for the current cart |
| POST | `/cart/items` | `{ variantId, quantity }` (max 10 per line, stock-checked) |
| PATCH | `/cart/items/:id` | `{ quantity }` |
| DELETE | `/cart/items/:id` | remove line |
| POST | `/cart/items/:id/save-for-later` | moves to wishlist |
| DELETE | `/cart` | clear |
| POST | `/orders/quote` | `{ couponCode?, useCoins?, items? }`: checkout preview (cart or buy-now items) |
| POST | `/orders` | `{ addressId, paymentMethod: COD \| UPI_ON_DELIVERY, couponCode?, useCoins?, items?, note? }` → `{ id, orderNumber, payable, coinsToEarn }` |
| GET | `/orders?status=active\|delivered\|cancelled\|returns` | order summaries |
| GET | `/orders/:id` | detail: items (`canReview`), `timeline`, `history`, `rider { name, phone, whatsapp }`, `actions { canCancel, canReturn }` |
| POST | `/orders/:id/cancel` | `{ reason }`. Allowed in PLACED / CONFIRMED / PACKED |
| POST | `/orders/:id/return` | `{ reason }`. Only for DELIVERED orders within the return window |
| GET | `/coins` | `{ balance, lifetimeEarned, pending, history }` |
| GET | `/reviews/mine` | — |
| POST | `/reviews` | `{ productId, rating 1-5, title?, comment? }`. Requires a delivered purchase. Upserts |
| DELETE | `/reviews/:id` | own review |
| GET | `/notifications` | in-app notifications |
| GET | `/notifications/unread-count` | `{ count }` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | — |

### PriceSummary

```json
{ "itemCount": 2, "itemsMrp": 80000, "itemsTotal": 60000, "mrpDiscount": 20000,
  "couponCode": "SAVE10", "couponDiscount": 5000, "couponError": null,
  "coinsAvailable": 120, "coinsRedeemable": 110, "coinsUsed": 110, "coinsDiscount": 11000,
  "deliveryFee": 0, "amountForFreeDelivery": 0, "payable": 44000,
  "totalSavings": 36000, "coinsToEarn": 8 }
```

## Admin: `/admin` 🛡

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard?days=30` | KPIs with % change, daily series, status breakdown, top products, recent orders |
| GET/POST | `/products` | list (`q`, `categoryId`, `brandId`, `status=active\|inactive\|low_stock\|out_of_stock`) / create |
| GET/PATCH/DELETE | `/products/:id` | detail / update (variants upserted; stock **not** editable here) / delete (archives if ordered) |
| GET/POST | `/categories` | flat list with counts / create `{ name, parentId?, imageUrl?, sortOrder, isActive }` |
| PATCH/DELETE | `/categories/:id` | delete blocked while it has products or children |
| GET/POST, PATCH/DELETE | `/brands`, `/brands/:id` | — |
| GET | `/inventory?status=all\|in\|low\|out&q=&categoryId=` | variant stock table |
| GET | `/inventory/summary` | `{ lowStock, outOfStock, totalUnits }` |
| POST | `/inventory/variants/:id/adjust` | `{ mode: IN \| OUT \| SET, quantity, reason }` |
| PATCH | `/inventory/variants/:id/threshold` | `{ lowStockThreshold }` |
| GET | `/inventory/variants/:id/movements` | audit log |
| GET | `/orders?q=&status=&riderId=&from=&to=` | — |
| GET | `/orders/status-counts` | `{ PLACED: 3, … }` |
| GET | `/orders/:id` | detail plus `allowedTransitions`, `canAssignRider`, `whatsappLinks`, `notificationLogs` |
| PATCH | `/orders/:id/status` | `{ status, note? }`. Validated by the state machine |
| PATCH | `/orders/:id/assign-rider` | `{ riderId, note? }`. Emails and WhatsApps the customer, rider and admin |
| POST | `/orders/:id/resend-notifications` | resends the rider-assignment messages (awaited) |
| PATCH | `/orders/:id/note` | `{ adminNote }` |
| GET/POST | `/riders` | list (`q`, `active`) with `activeOrders` / create |
| GET/PATCH/DELETE | `/riders/:id` | detail with recent orders and stats / update / delete (deactivates if they have history) |
| GET | `/customers?q=&blocked=` | with `orderCount` and `totalSpent` |
| GET | `/customers/:id` | addresses, orders, coin history, stats |
| PATCH | `/customers/:id/block` | `{ isBlocked }`. Blocking revokes sessions |
| POST | `/customers/:id/coins` | `{ amount (±), note }` |
| GET/POST | `/coupons` | list (`q`, `status=active\|inactive\|expired`) / create |
| GET/PATCH/DELETE | `/coupons/:id` | detail with redemptions / update / delete (archives if used) |
| GET/POST, PATCH/DELETE | `/banners`, `/banners/:id` | — |
| GET | `/reviews?q=&rating=&hidden=` | — |
| PATCH/DELETE | `/reviews/:id` | `{ isHidden }` / delete. Ratings are recomputed |
| GET/PATCH | `/settings` | store settings (fees, delivery threshold, coin earning/redeeming, referral program rules, payment methods) |
| GET | `/notification-logs?status=&channel=&orderId=` | email/WhatsApp delivery log |
| POST | `/uploads` | multipart `file` → `{ url, key }` |
