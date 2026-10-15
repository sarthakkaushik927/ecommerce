/** Shapes returned by the backend (see docs/API.md). Money fields are integer paise; dates are ISO strings. */

export type Role = "CUSTOMER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  coinBalance: number;
  referralCode?: string | null;
  createdAt: string;
};

export type Session = { user: User; accessToken: string; refreshToken: string };

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };
export type Page<T> = { data: T[]; meta?: PageMeta };

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  price: number;
  mrp: number;
  discountPercent: number;
  ratingAvg: number;
  ratingCount: number;
  inStock: boolean;
  defaultVariantId: string | null;
  variantCount: number;
  isWishlisted: boolean;
};

export type CategoryNode = { id: string; name: string; slug: string; imageUrl: string | null; parentId: string | null; children?: CategoryNode[] };

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkType: "NONE" | "PRODUCT" | "CATEGORY" | "SEARCH" | "URL";
  linkValue: string | null;
};

export type HomeFeed = {
  banners: { carousel: Banner[]; strip: Banner[] };
  categories: CategoryNode[];
  rails: { key: string; title: string; items: ProductCard[]; query: Record<string, string | number> }[];
};

export type Offer = { code: string; title: string; description: string; firstOrderOnly?: boolean; endsAt: string | null };

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string; parent: { id: string; name: string; slug: string } | null };
  images: { id: string; url: string; alt: string | null }[];
  variants: {
    id: string;
    sku: string;
    label: string;
    attributes: Record<string, string>;
    mrp: number;
    price: number;
    inStock: boolean;
    stock: number | null;
  }[];
  price: number;
  mrp: number;
  discountPercent: number;
  rating: { average: number; count: number; breakdown: Record<string, number> };
  topReviews: ReviewItem[];
  offers: Offer[];
  isWishlisted: boolean;
};

export type ReviewItem = { id: string; rating: number; title: string | null; comment: string | null; createdAt: string; userName: string };

export type Suggestions = {
  products: { id: string; slug: string; name: string; imageUrl: string | null }[];
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
};

export type Facets = { brands: { slug: string; name: string; count: number }[]; price: { min: number; max: number } };

export type CartLine = {
  id: string;
  quantity: number;
  maxQuantity: number;
  available: boolean;
  unavailableReason: string | null;
  lineMrp: number;
  lineTotal: number;
  variant: { id: string; sku: string; label: string; mrp: number; price: number };
  product: { id: string; slug: string; name: string; brand: string | null; imageUrl: string | null };
};

export type PriceSummary = {
  itemCount: number;
  itemsMrp: number;
  itemsTotal: number;
  mrpDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  coinsAvailable: number;
  coinsRedeemable: number;
  coinsUsed: number;
  coinsDiscount: number;
  deliveryFee: number;
  amountForFreeDelivery: number;
  payable: number;
  totalSavings: number;
  coinsToEarn: number;
};

export type Cart = { items: CartLine[]; summary: PriceSummary };

export type CartCoupon = Offer & { minOrderValue: number; applicable: boolean; reason: string | null };

export type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
};
export type AddressInput = Omit<Address, "id">;

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PACKED"
  | "RIDER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "RETURN_REJECTED";

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  payable: number;
  createdAt: string;
  deliveredAt: string | null;
  items: { productName: string; imageUrl: string | null; quantity: number }[];
  itemCount: number;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "COD" | "UPI_ON_DELIVERY";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  shippingAddress: Omit<Address, "id" | "type" | "isDefault">;
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
  createdAt: string;
  items: {
    id: string;
    productId: string;
    productSlug: string;
    productName: string;
    variantLabel: string;
    imageUrl: string | null;
    mrp: number;
    price: number;
    quantity: number;
    lineTotal: number;
    canReview: boolean;
  }[];
  timeline: { status: OrderStatus; at: string | null }[];
  history: { status: OrderStatus; note: string | null; createdAt: string }[];
  rider: { name: string; phone: string; whatsapp: string | null; vehicleType: string; vehicleNumber: string | null } | null;
  actions: { canCancel: boolean; canReturn: boolean };
};

export type PlacedOrder = { id: string; orderNumber: string; payable: number; coinsToEarn: number };

export type Coins = {
  balance: number;
  lifetimeEarned: number;
  pending: number;
  history: { id: string; type: string; amount: number; balanceAfter: number; note: string | null; orderNumber: string | null; createdAt: string }[];
};

export type AppNotification = { id: string; type: "ORDER" | "PROMO" | "SYSTEM"; title: string; body: string; data: { orderId?: string } | null; readAt: string | null; createdAt: string };

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  coinEarnPer100: number;
  coinMaxRedeemPercent: number;
  returnWindowDays: number;
  codEnabled: boolean;
  upiOnDeliveryEnabled: boolean;
  referralEnabled?: boolean;
  referralReferrerCoins?: number;
  referralRefereeCoins?: number;
};

export type ReferralSummary = {
  referralCode: string;
  completedCount: number;
  pendingCount: number;
  totalCoinsEarned: number;
  referrerBonus: number;
  refereeBonus: number;
  enabled: boolean;
};
