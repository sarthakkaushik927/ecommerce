# Database

The database is PostgreSQL on Neon, accessed through Prisma 7 with `@prisma/adapter-pg`. The source of truth is [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

- Every money column is an **integer number of paise**.
- Coins are integers, where 1 coin = ₹1.
- IDs are `cuid()` strings.

## Entity map

```
User ─┬─< RefreshToken            Category ─< Category (2-level tree)
      ├─< PasswordReset           Category ─< Product >─ Brand
      ├─< Address                 Product ─┬─< ProductImage
      ├─< CartItem >── ProductVariant      ├─< ProductVariant ─< StockMovement
      ├─< WishlistItem >── Product         └─< Review >── User
      ├─< CoinTransaction >── Order?
      ├─< CouponRedemption >── Coupon, Order (1:1)
      ├─< Notification
      ├─< Referral (as referrer / referee) >── Order?
      └─< Order ─┬─< OrderItem (price snapshot) >── ProductVariant, Product
                 ├─< OrderStatusHistory
                 ├─< NotificationLog
                 ├─< Referral?
                 └── Rider?
Settings (single row, id = 1)    Banner    SearchTerm
```

## Tables

| Model | Purpose | Notable columns |
|---|---|---|
| `User` | customers and admins | `role` CUSTOMER\|ADMIN, `isBlocked`, `coinBalance` (denormalised, changed only via `changeCoins`), `referralCode` (unique uppercase, e.g. `HAAT4X8K`) |
| `RefreshToken` | sessions | `tokenHash` (SHA-256), `revokedAt`, `rotatedAt` (set only by rotation, so a racing refresh can be told apart from logout or theft), `expiresAt` |
| `PasswordReset` | OTP reset | `otpHash`, `attempts` (max 5), `expiresAt` (10 min) |
| `Address` | address book | `isDefault` (one per user, enforced in the service) |
| `Category` | 2-level tree | `parentId`, `sortOrder`, `isActive` |
| `Brand` | — | `slug` unique |
| `Product` | catalog item | `specs` JSON `[{label,value}]`, `highlights[]`, `tags[]`. Denormalised: `minPrice`, `minMrp`, `discountPercent` (cheapest active variant), `ratingAvg`, `ratingCount`, `soldCount` |
| `ProductVariant` | sellable unit (SKU) | `mrp`, `price`, `stock`, `lowStockThreshold`, `attributes` JSON |
| `StockMovement` | inventory audit | `type` IN\|OUT\|SET\|SALE\|CANCEL\|RETURN, signed `quantity`, `stockAfter`, `orderId?` |
| `CartItem` | cart line | unique (`userId`, `variantId`) |
| `WishlistItem` | — | PK (`userId`, `productId`) |
| `Coupon` | promotions | `type` PERCENT\|FLAT, `value`, `maxDiscount`, `minOrderValue`, window, `usageLimit`, `perUserLimit`, `usedCount`, `firstOrderOnly` |
| `CouponRedemption` | usage per order | unique `orderId`. Deleted when the order is cancelled |
| `CoinTransaction` | coin ledger | `type` EARN\|REDEEM\|REFUND\|REVERSE\|ADJUST\|BONUS, signed `amount`, `balanceAfter` |
| `Referral` | customer referral program | `referrerId`, `refereeId` (unique), `status` PENDING\|COMPLETED\|REVERSED, `orderId` (unique, first delivered order), `referrerCoins`, `refereeCoins`, timestamps |
| `Order` | — | `orderNumber` (`HTyymmddNNNNN`), `status`, `paymentMethod`, `paymentStatus`, `shippingAddress` JSON snapshot. Price breakup: `itemsMrp`, `itemsTotal`, `couponDiscount`, `coinsUsed`, `deliveryFee`, `payable`. Also `coinsToEarn`, `coinsEarned`, `riderId`, timestamps |
| `OrderItem` | immutable snapshot | `productName`, `variantLabel`, `sku`, `imageUrl`, `mrp`, `price`, `quantity`, `lineTotal` |
| `OrderStatusHistory` | timeline | `status`, `note`, `actorId`, `actorRole` |
| `Rider` | registered delivery partners | `phone` unique (E.164), `whatsapp`, `email`, `vehicleType`, `vehicleNumber`, `idProof*`, `isActive` |
| `Review` | — | unique (`userId`, `productId`), `isHidden` |
| `Banner` | merchandising | `placement` HOME_CAROUSEL\|HOME_STRIP, `linkType` NONE\|PRODUCT\|CATEGORY\|SEARCH\|URL, window |
| `Notification` | in-app inbox | `type` ORDER\|PROMO\|SYSTEM, `data` JSON (e.g. `orderId`), `readAt` |
| `NotificationLog` | email/WhatsApp delivery log | `channel`, `recipientType`, `status` SENT\|FAILED\|SKIPPED, `error`. OTP bodies are redacted |
| `Settings` | store config | fees, thresholds, coin rules, referral rules (`referralEnabled`, `referralReferrerCoins`, `referralRefereeCoins`), return window, payment toggles, admin contacts |
| `SearchTerm` | trending searches | `count` |

## Integrity rules (enforced in services)

- **Stock never goes negative.** It is changed with a conditional `UPDATE … WHERE stock >= n`, which is safe under concurrent checkouts.
- **The coin balance never goes negative.** It uses the same conditional update and writes a ledger row in the same transaction.
- **Coupon global limits** use a conditional `usedCount < usageLimit` increment at order time.
- **Order status updates** are conditional on the previous status (optimistic concurrency).
- **Records referenced by orders are archived instead of deleted:** products, variants, riders and coupons.

## Indexes

Listing and sorting are covered by `Product(isActive, minPrice | soldCount | createdAt | isFeatured)` and `Product(categoryId, isActive)`. Orders are indexed by `(userId, createdAt)`, `(status, createdAt)` and `riderId`.

**Scaling search:** add a `pg_trgm` GIN index on `Product.name` and switch `q` to trigram similarity once the catalog grows past a few thousand items.

## Migrations

```bash
pnpm db:migrate --name <change>   # dev: creates and applies a migration (uses DIRECT_URL)
pnpm db:deploy                    # prod/CI: applies pending migrations
pnpm db:seed                      # idempotent demo data + admin
```
