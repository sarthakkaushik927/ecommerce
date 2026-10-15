/**
 * Seeds the admin account, store settings and a demo catalog.
 * Idempotent: existing records (matched by email / slug / code) are left untouched.
 *
 * Run: pnpm db:seed
 */
import dns from "node:dns";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

dns.setDefaultResultOrder("ipv4first");

type SeedVariant = { sku: string; label: string; attributes: Record<string, string>; mrp: number; price: number; stock: number };
type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  category: string;
  brand: string | null;
  images: string[];
  isFeatured: boolean;
  variants: SeedVariant[];
  reviews: { rating: number; comment: string; name: string; email: string; date: string }[];
};
type SeedCategory = { name: string; slug: string; imageUrl: string | null; children: Omit<SeedCategory, "children">[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function seedAdmin() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local").toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) throw new Error("ADMIN_SEED_PASSWORD is not set");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return console.log(`• admin exists: ${email}`);
  await prisma.user.create({
    data: { name: "Store Admin", email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✓ admin created: ${email}`);
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: "Haat",
      supportEmail: "support@haat.local",
      supportPhone: "+919800000000",
      adminEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local",
      adminWhatsapp: "+919800000000",
    },
  });
  console.log("✓ settings");
}

async function seedCategories(categories: SeedCategory[]) {
  const ids = new Map<string, string>();
  for (const [index, parent] of categories.entries()) {
    const created = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { sortOrder: index },
      create: { name: parent.name, slug: parent.slug, imageUrl: parent.imageUrl, sortOrder: index },
    });
    for (const [childIndex, child] of parent.children.entries()) {
      const sub = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { sortOrder: childIndex },
        create: { name: child.name, slug: child.slug, imageUrl: child.imageUrl, sortOrder: childIndex, parentId: created.id },
      });
      ids.set(child.slug, sub.id);
    }
  }
  console.log(`✓ categories (${ids.size} sub-categories)`);
  return ids;
}

async function seedBrands(products: SeedProduct[]) {
  const names = [...new Set(products.map((product) => product.brand).filter((brand): brand is string => !!brand))];
  await prisma.brand.createMany({ data: names.map((name) => ({ name, slug: slugify(name) })), skipDuplicates: true });
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  console.log(`✓ brands (${brands.length})`);
  return new Map(brands.map((brand) => [brand.name, brand.id]));
}

const GROCERY_CATEGORIES = new Set([
  "vegetables", "fruits", "dairy-bakery", "atta-rice-dal", "oil-masala", "snacks-beverages", "daily-essentials", "grocery"
]);
const MEDICINE_CATEGORIES = new Set([
  "pain-relief", "cold-cough-fever", "digestive-care", "vitamins-supplements", "first-aid", "diabetes-care", "medicines"
]);

async function seedProducts(products: SeedProduct[], categoryIds: Map<string, string>, brandIds: Map<string, string>) {
  const existing = new Set((await prisma.product.findMany({ select: { slug: true } })).map((product) => product.slug));
  let created = 0;
  let updated = 0;

  for (const [index, product] of products.entries()) {
    const isGrocery = GROCERY_CATEGORIES.has(product.category);
    const isMedicine = MEDICINE_CATEGORIES.has(product.category);
    const isPreferred = isGrocery || isMedicine;

    const soldCount = isGrocery
      ? 800 + ((index * 23) % 450)
      : isMedicine
        ? 650 + ((index * 19) % 350)
        : (index * 13) % 250;

    const createdAt = isPreferred
      ? new Date(Date.now() - ((index * 2) % 15) * DAY_MS)
      : new Date(Date.now() - (45 + ((index * 7) % 45)) * DAY_MS);

    if (existing.has(product.slug)) {
      if (isPreferred) {
        await prisma.product.update({
          where: { slug: product.slug },
          data: {
            isFeatured: true,
            soldCount,
            createdAt,
          },
        });
        updated += 1;
      }
      continue;
    }

    const categoryId = categoryIds.get(product.category);
    if (!categoryId) continue;
    existing.add(product.slug);

    const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0]!;
    const result = await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        highlights: product.highlights,
        specs: product.specs,
        tags: product.tags,
        categoryId,
        brandId: product.brand ? brandIds.get(product.brand) : undefined,
        isFeatured: isPreferred ? true : product.isFeatured,
        minPrice: cheapest.price,
        minMrp: cheapest.mrp,
        discountPercent: Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100),
        soldCount,
        createdAt,
        images: { create: product.images.map((url, sortOrder) => ({ url, alt: product.name, sortOrder })) },
        variants: {
          create: product.variants.map((variant, sortOrder) => ({ ...variant, sortOrder })),
        },
      },
      select: { variants: { select: { id: true, stock: true } } },
    });
    await prisma.stockMovement.createMany({
      data: result.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => ({ variantId: variant.id, type: "IN" as const, quantity: variant.stock, stockAfter: variant.stock, reason: "Initial stock" })),
    });
    created += 1;
  }
  console.log(`✓ products (${created} new, ${updated} preferred updated)`);
}

async function seedReviews(products: SeedProduct[]) {
  const reviewers = new Map<string, string>();
  for (const product of products) for (const review of product.reviews) reviewers.set(review.email.toLowerCase(), review.name);

  // Demo reviewers cannot log in: they share an unguessable random hash.
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await prisma.user.createMany({
    data: [...reviewers].map(([email, name]) => ({ email, name, passwordHash })),
    skipDuplicates: true,
  });
  const users = await prisma.user.findMany({ where: { email: { in: [...reviewers.keys()] } }, select: { id: true, email: true } });
  const userIds = new Map(users.map((user) => [user.email, user.id]));
  const productIds = new Map((await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));

  const { count } = await prisma.review.createMany({
    data: products.flatMap((product) =>
      product.reviews.flatMap((review) => {
        const userId = userIds.get(review.email.toLowerCase());
        const productId = productIds.get(product.slug);
        return userId && productId
          ? [{ userId, productId, rating: review.rating, comment: review.comment, createdAt: new Date(review.date) }]
          : [];
      }),
    ),
    skipDuplicates: true,
  });

  await prisma.$executeRaw`
    UPDATE "Product" p SET "ratingAvg" = r.avg, "ratingCount" = r.cnt
    FROM (SELECT "productId", AVG(rating)::float AS avg, COUNT(*)::int AS cnt FROM "Review" WHERE "isHidden" = false GROUP BY "productId") r
    WHERE p.id = r."productId"`;
  console.log(`✓ reviews (${count} new)`);
}

async function seedCoupons() {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * DAY_MS);
  const coupons = [
    { code: "WELCOME100", description: "Welcome offer on your first order", type: "FLAT" as const, value: 10_000, minOrderValue: 49_900, firstOrderOnly: true },
    { code: "SAVE10", description: "10% off on bigger baskets", type: "PERCENT" as const, value: 10, maxDiscount: 20_000, minOrderValue: 99_900 },
    { code: "HAAT50", description: "Flat ₹50 off", type: "FLAT" as const, value: 5_000, minOrderValue: 29_900, perUserLimit: 3 },
    { code: "MEGA20", description: "Mega sale: 20% off", type: "PERCENT" as const, value: 20, maxDiscount: 50_000, minOrderValue: 199_900, endsAt: in90Days, usageLimit: 500 },
  ];
  await prisma.coupon.createMany({ data: coupons, skipDuplicates: true });
  console.log(`✓ coupons (${coupons.length})`);
}

async function seedBanners(categories: SeedCategory[]) {
  const pick = (slug: string) => categories.find((category) => category.slug === slug);
  const grocery = pick("grocery");
  const medicines = pick("medicines");
  const vegetables = pick("grocery")?.children.find((c) => c.slug === "vegetables");

  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({
    data: [
      {
        title: "Daily Essentials & Fresh Groceries",
        subtitle: "Delivered fresh from local mandi in minutes",
        imageUrl: grocery?.imageUrl ?? "https://cdn.dummyjson.com/product-images/groceries/apple/1.webp",
        linkType: "CATEGORY",
        linkValue: "grocery",
        placement: "HOME_CAROUSEL",
        sortOrder: 0,
      },
      {
        title: "Medicines & Daily Healthcare",
        subtitle: "Flat 20% off on genuine healthcare & wellness",
        imageUrl: medicines?.imageUrl ?? "https://placehold.co/600x600/FFC727/1C1A14/png?text=Medicines",
        linkType: "CATEGORY",
        linkValue: "medicines",
        placement: "HOME_CAROUSEL",
        sortOrder: 1,
      },
      {
        title: "Farm-Fresh Vegetables",
        subtitle: "Hand-picked, clean & sorted daily",
        imageUrl: vegetables?.imageUrl ?? "https://placehold.co/600x600/FFC727/1C1A14/png?text=Vegetables",
        linkType: "CATEGORY",
        linkValue: "vegetables",
        placement: "HOME_CAROUSEL",
        sortOrder: 2,
      },
      {
        title: "Use WELCOME100",
        subtitle: "₹100 off your first grocery order",
        imageUrl: grocery?.imageUrl ?? "https://cdn.dummyjson.com/product-images/groceries/apple/1.webp",
        linkType: "NONE",
        placement: "HOME_STRIP",
        sortOrder: 0,
      },
    ],
  });
  console.log("✓ banners (groceries & medicines prioritized)");
}

async function seedSearchTerms() {
  const terms = [
    { term: "tomato", count: 120 },
    { term: "potato", count: 110 },
    { term: "onion", count: 105 },
    { term: "milk", count: 95 },
    { term: "atta", count: 90 },
    { term: "paneer", count: 85 },
    { term: "paracetamol", count: 80 },
    { term: "cough syrup", count: 75 },
    { term: "dettol", count: 70 },
    { term: "fresh vegetables", count: 65 },
    { term: "fruits", count: 60 },
    { term: "ghee", count: 55 },
  ];
  for (const t of terms) {
    await prisma.searchTerm.upsert({
      where: { term: t.term },
      update: { count: t.count },
      create: { term: t.term, count: t.count },
    });
  }
  console.log("✓ search terms");
}

async function seedRiders() {
  await prisma.rider.createMany({
    data: [
      { name: "Ravi Kumar", phone: "+919811111111", whatsapp: "+919811111111", email: "ravi.rider@haat.local", vehicleType: "BIKE", vehicleNumber: "DL01AB1234", idProofType: "Driving Licence", idProofNumber: "DL-0420110012345" },
      { name: "Suresh Yadav", phone: "+919822222222", whatsapp: "+919822222222", vehicleType: "SCOOTER", vehicleNumber: "DL02CD5678" },
      { name: "Imran Khan", phone: "+919833333333", email: "imran.rider@haat.local", vehicleType: "BICYCLE" },
    ],
    skipDuplicates: true,
  });
  console.log("✓ riders");
}

/**
 * Seeds 3 branches with Bengaluru lat/lng and creates BranchVariantStock
 * rows for every active variant so each branch has independently tracked stock.
 * Idempotent: skips existing branches and existing BranchVariantStock rows.
 */
async function seedBranches() {
  const branchDefs = [
    {
      name: "Haat Main Branch",
      slug: "main",
      address: "12, MG Road, Brigade Road Junction",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      lat: 12.9716,
      lng: 77.5946,
      deliveryRadiusKm: 8,
      phone: "+918011110001",
      email: "main@haat.local",
      isOnline: true,
      sortOrder: 0,
    },
    {
      name: "Haat North Branch",
      slug: "north",
      address: "45, Hebbal Flyover Road, Hebbal",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560024",
      lat: 13.035,
      lng: 77.5972,
      deliveryRadiusKm: 6,
      phone: "+918011110002",
      email: "north@haat.local",
      isOnline: true,
      sortOrder: 1,
    },
    {
      name: "Haat South Branch",
      slug: "south",
      address: "78, Banashankari 2nd Stage",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560070",
      lat: 12.9352,
      lng: 77.5552,
      deliveryRadiusKm: 6,
      phone: "+918011110003",
      email: "south@haat.local",
      isOnline: true,
      sortOrder: 2,
    },
  ];

  const branches: { id: string }[] = [];
  for (const def of branchDefs) {
    const branch = await prisma.branch.upsert({
      where: { slug: def.slug },
      update: {},
      create: def,
    });
    branches.push(branch);
  }
  console.log(`✓ branches (${branches.length})`);

  // Create BranchVariantStock for every active variant in every branch.
  // Use random stock between 20-200 for seeding realism.
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let stockRows = 0;
  for (const branch of branches) {
    for (const variant of variants) {
      const stock = Math.floor(Math.random() * 181) + 20; // 20–200
      await prisma.branchVariantStock.upsert({
        where: { branchId_variantId: { branchId: branch.id, variantId: variant.id } },
        update: {},
        create: {
          branchId: branch.id,
          variantId: variant.id,
          stock,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      });
      stockRows++;
    }
  }
  console.log(`✓ branch variant stock (${stockRows} rows across ${branches.length} branches)`);

  // Assign all seeded riders to the Main branch.
  const riders = await prisma.rider.findMany({ select: { id: true } });
  const mainBranch = branches[0]!;
  for (const rider of riders) {
    await prisma.branchRider.upsert({
      where: { branchId_riderId: { branchId: mainBranch.id, riderId: rider.id } },
      update: {},
      create: { branchId: mainBranch.id, riderId: rider.id },
    });
  }
  console.log(`✓ branch riders (${riders.length} riders → Main branch)`);
}

async function main() {
  const catalog = JSON.parse(await readFile(new URL("./seed-data/catalog.json", import.meta.url), "utf8")) as {
    categories: SeedCategory[];
    products: SeedProduct[];
  };
  await seedAdmin();
  await seedSettings();
  const categoryIds = await seedCategories(catalog.categories);
  const brandIds = await seedBrands(catalog.products);
  await seedProducts(catalog.products, categoryIds, brandIds);
  await seedReviews(catalog.products);
  await seedCoupons();
  await seedBanners(catalog.categories);
  await seedSearchTerms();
  await seedRiders();
  await seedBranches();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

