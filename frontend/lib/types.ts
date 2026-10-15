/** Shapes returned by the backend (see docs/API.md). Money fields are integer paise; dates are ISO strings. */

export type Role = "CUSTOMER" | "ADMIN";

export const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "RIDER_ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "RETURN_REJECTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { items: T[]; meta: PageMeta };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
};
export type Session = { user: SessionUser; accessToken: string; refreshToken: string };

// ───────── dashboard ─────────

export type Kpi = { value: number; change: number | null };
export type Dashboard = {
  rangeDays: number;
  kpis: {
    revenue: Kpi;
    orders: Kpi;
    averageOrderValue: Kpi;
    newCustomers: Kpi;
    revenueToday: number;
    ordersToday: number;
    pendingOrders: number;
    lowStock: number;
    outOfStock: number;
  };
  series: { date: string; revenue: number; orders: number }[];
  statusBreakdown: { status: OrderStatus; count: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  recentOrders: { id: string; orderNumber: string; status: OrderStatus; payable: number; createdAt: string; customer: string }[];
};

// ───────── catalog ─────────

export type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  _count: { products: number };
};

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
  minPrice: number;
  minMrp: number;
  discountPercent: number;
  soldCount: number;
  ratingAvg: number;
  updatedAt: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  variantCount: number;
  totalStock: number;
};

export type Variant = {
  id: string;
  sku: string;
  label: string;
  attributes: Record<string, string>;
  mrp: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  categoryId: string;
  brandId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  images: { id: string; url: string; alt: string | null }[];
  variants: Variant[];
};

export type VariantInput = Omit<Variant, "id"> & { id?: string };
export type ProductInput = Omit<ProductDetail, "id" | "images" | "variants" | "slug"> & {
  slug?: string;
  images: { url: string; alt?: string | null }[];
  variants: VariantInput[];
};

// ───────── inventory ─────────

export type StockStatus = "in" | "low" | "out";
export type InventoryRow = {
  id: string;
  sku: string;
  label: string;
  price: number;
  mrp: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  updatedAt: string;
  status: StockStatus;
  product: { id: string; name: string; isActive: boolean; category: string };
  imageUrl: string | null;
};
export type InventorySummary = { lowStock: number; outOfStock: number; totalUnits: number };
export type StockMovement = {
  id: string;
  type: "IN" | "OUT" | "SET" | "SALE" | "CANCEL" | "RETURN";
  quantity: number;
  stockAfter: number;
  reason: string | null;
  orderId: string | null;
  createdAt: string;
};

// ───────── orders ─────────

export type PaymentMethod = "COD" | "UPI_ON_DELIVERY";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";

export type OrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  payable: number;
  createdAt: string;
  user: { id: string; name: string; phone: string | null };
  rider: { id: string; name: string } | null;
  itemCount: number;
};

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type NotificationLog = {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  recipientType: "CUSTOMER" | "RIDER" | "ADMIN";
  recipient: string;
  template: string;
  subject: string | null;
  body: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  orderId: string | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: ShippingAddress;
  itemsMrp: number;
  itemsTotal: number;
  couponCode: string | null;
  couponDiscount: number;
  coinsUsed: number;
  deliveryFee: number;
  payable: number;
  coinsToEarn: number;
  coinsEarned: number;
  cancelReason: string | null;
  returnReason: string | null;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  deliveredAt: string | null;
  user: { id: string; name: string; email: string; phone: string | null };
  rider: Rider | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    variantLabel: string;
    sku: string;
    imageUrl: string | null;
    mrp: number;
    price: number;
    quantity: number;
    lineTotal: number;
  }[];
  history: { id: string; status: OrderStatus; note: string | null; actorRole: string | null; createdAt: string }[];
  notificationLogs: NotificationLog[];
  allowedTransitions: OrderStatus[];
  canAssignRider: boolean;
  whatsappLinks: { customer: string; rider: string; admin: string | null } | null;
};

// ───────── people ─────────

export const VEHICLE_TYPES = ["BIKE", "SCOOTER", "BICYCLE", "CAR", "VAN", "OTHER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type Rider = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  vehicleType: VehicleType;
  vehicleNumber: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};
export type RiderRow = Rider & { activeOrders: number };
export type RiderDetail = Rider & {
  orders: { id: string; orderNumber: string; status: OrderStatus; payable: number; riderAssignedAt: string | null; deliveredAt: string | null }[];
  stats: { delivered: number; active: number };
};
export type RiderInput = Omit<Rider, "id" | "createdAt">;

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isBlocked: boolean;
  coinBalance: number;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};
export type CustomerDetail = Omit<CustomerRow, "orderCount" | "totalSpent"> & {
  referralCode?: string | null;
  addresses: (ShippingAddress & { id: string; type: string; isDefault: boolean })[];
  orders: { id: string; orderNumber: string; status: OrderStatus; payable: number; createdAt: string }[];
  coinTransactions: { id: string; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }[];
  referralReceived?: { referrer: { id: string; name: string; email: string; phone: string | null } } | null;
  referralsGiven?: { id: string; status: string; referrerCoins: number; createdAt: string; referee: { id: string; name: string; email: string; phone: string | null } }[];
  stats: { deliveredOrders: number; totalSpent: number };
};

// ───────── marketing ─────────

export type Coupon = {
  id: string;
  code: string;
  description: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  firstOrderOnly: boolean;
  isActive: boolean;
  summary?: string;
};
export type CouponInput = Omit<Coupon, "id" | "usedCount" | "summary">;

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkType: "NONE" | "PRODUCT" | "CATEGORY" | "SEARCH" | "URL";
  linkValue: string | null;
  placement: "HOME_CAROUSEL" | "HOME_STRIP";
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};
export type BannerInput = Omit<Banner, "id">;

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string; slug: string };
};

export type Settings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  adminEmail: string;
  adminWhatsapp: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  coinEarnPer100: number;
  coinMaxRedeemPercent: number;
  returnWindowDays: number;
  codEnabled: boolean;
  upiOnDeliveryEnabled: boolean;
  referralEnabled: boolean;
  referralReferrerCoins: number;
  referralRefereeCoins: number;
};
