import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { categoryWithDescendantIds } from "../categories/categories.service.js";
import { listPublicCoupons } from "../coupons/coupons.service.js";
import { wishlistedIds } from "../wishlist/wishlist.service.js";
import { productCardSelect, toProductCard } from "./products.presenter.js";
import type { ProductListQuery } from "./products.schema.js";
import { normalizeSearchTerm } from "./search-term.js";

async function buildWhere(query: ProductListQuery): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (query.category) and.push({ categoryId: { in: await categoryWithDescendantIds(query.category) } });
  if (query.brand?.length) and.push({ brand: { slug: { in: query.brand } } });
  if (query.minPrice !== undefined) and.push({ minPrice: { gte: query.minPrice } });
  if (query.maxPrice !== undefined) and.push({ minPrice: { lte: query.maxPrice } });
  if (query.rating !== undefined) and.push({ ratingAvg: { gte: query.rating } });
  if (query.discount !== undefined) and.push({ discountPercent: { gte: query.discount } });
  if (query.inStock) and.push({ variants: { some: { isActive: true, stock: { gt: 0 } } } });
  if (query.featured) and.push({ isFeatured: true });
  if (query.ids?.length) and.push({ id: { in: query.ids } });

  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  return { AND: and };
}

function buildOrderBy(query: ProductListQuery): Prisma.ProductOrderByWithRelationInput[] {
  const byId: Prisma.ProductOrderByWithRelationInput = { id: "asc" };
  switch (query.sort) {
    case "popular":
      return [{ soldCount: "desc" }, byId];
    case "price_asc":
      return [{ minPrice: "asc" }, byId];
    case "price_desc":
      return [{ minPrice: "desc" }, byId];
    case "newest":
      return [{ createdAt: "desc" }, byId];
    case "discount":
      return [{ discountPercent: "desc" }, byId];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }, byId];
    case "relevance":
      return [{ isFeatured: "desc" }, { soldCount: "desc" }, { ratingAvg: "desc" }, byId];
  }
}

function recordSearchTerm(q: string) {
  // Voice queries arrive as spoken sentences; they are searchable but must not become trending chips.
  const term = normalizeSearchTerm(q);
  if (!term) return;
  prisma.searchTerm
    .upsert({ where: { term }, update: { count: { increment: 1 } }, create: { term } })
    .catch((error: unknown) => logger.warn({ err: error }, "Failed to record search term"));
}

export async function listProducts(query: ProductListQuery, userId?: string) {
  const where = await buildWhere(query);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(query),
      select: productCardSelect,
      ...toSkipTake(query),
    }),
    prisma.product.count({ where }),
  ]);
  if (query.q && query.page === 1) recordSearchTerm(query.q);

  const wishlisted = await wishlistedIds(userId, rows.map((row) => row.id));
  return { items: rows.map((row) => toProductCard(row, wishlisted)), meta: pageMeta(query, total) };
}

/** Brands and price range available for the current category/search, for the filter sheet. */
export async function getFacets(query: ProductListQuery) {
  const where = await buildWhere({ ...query, brand: undefined, minPrice: undefined, maxPrice: undefined });
  const [brandGroups, price] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: { AND: [where, { brandId: { not: null } }] }, _count: true }),
    prisma.product.aggregate({ where, _min: { minPrice: true }, _max: { minPrice: true } }),
  ]);
  const brandIds = brandGroups.map((group) => group.brandId).filter((id): id is string => id !== null);
  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const counts = new Map(brandGroups.map((group) => [group.brandId, group._count]));
  return {
    brands: brands.map((brand) => ({ ...brand, count: counts.get(brand.id) ?? 0 })),
    price: { min: price._min.minPrice ?? 0, max: price._max.minPrice ?? 0 },
  };
}

export async function getProductDetail(slug: string, userId?: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      category: {
        select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } },
      },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, alt: true } },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        select: { id: true, sku: true, label: true, attributes: true, mrp: true, price: true, stock: true },
      },
    },
  });
  if (!product) throw AppError.notFound("Product");

  const [ratingGroups, topReviews, wishlisted, offers] = await Promise.all([
    prisma.review.groupBy({ by: ["rating"], where: { productId: product.id, isHidden: false }, _count: true }),
    prisma.review.findMany({
      where: { productId: product.id, isHidden: false },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, rating: true, title: true, comment: true, createdAt: true, user: { select: { name: true } } },
    }),
    wishlistedIds(userId, [product.id]),
    listPublicCoupons(3),
  ]);

  const breakdown = Object.fromEntries([5, 4, 3, 2, 1].map((star) => [star, 0])) as Record<number, number>;
  for (const group of ratingGroups) breakdown[group.rating] = group._count;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    highlights: product.highlights,
    specs: product.specs as { label: string; value: string }[],
    tags: product.tags,
    brand: product.brand,
    category: product.category,
    images: product.images,
    variants: product.variants.map((variant) => ({
      ...variant,
      attributes: variant.attributes as Record<string, string>,
      inStock: variant.stock > 0,
      // Exact stock is only revealed when scarce ("Only 3 left").
      stock: variant.stock <= 5 ? variant.stock : null,
    })),
    price: product.minPrice,
    mrp: product.minMrp,
    discountPercent: product.discountPercent,
    rating: {
      average: Math.round(product.ratingAvg * 10) / 10,
      count: product.ratingCount,
      breakdown,
    },
    topReviews: topReviews.map(({ user, ...review }) => ({ ...review, userName: user.name })),
    offers,
    isWishlisted: wishlisted.has(product.id),
  };
}

export async function getSimilarProducts(slug: string, userId?: string) {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, categoryId: true, brandId: true } });
  if (!product) throw AppError.notFound("Product");
  const rows = await prisma.product.findMany({
    where: { isActive: true, id: { not: product.id }, categoryId: product.categoryId },
    orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }],
    take: 12,
    select: productCardSelect,
  });
  const wishlisted = await wishlistedIds(userId, rows.map((row) => row.id));
  return rows.map((row) => toProductCard(row, wishlisted));
}

export async function getSuggestions(q: string) {
  const contains = { contains: q, mode: "insensitive" as const };
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, name: contains },
      orderBy: { soldCount: "desc" },
      take: 6,
      select: { id: true, slug: true, name: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } },
    }),
    prisma.category.findMany({ where: { isActive: true, name: contains }, take: 3, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ where: { isActive: true, name: contains }, take: 3, select: { id: true, name: true, slug: true } }),
  ]);
  return {
    products: products.map(({ images, ...product }) => ({ ...product, imageUrl: images[0]?.url ?? null })),
    categories,
    brands,
  };
}

export async function getTrendingSearches() {
  const terms = await prisma.searchTerm.findMany({ orderBy: { count: "desc" }, take: 10, select: { term: true } });
  return terms.map((row) => row.term);
}

/** Product cards for a curated rail on the home screen. */
export async function productRail(
  where: Prisma.ProductWhereInput,
  orderBy: Prisma.ProductOrderByWithRelationInput[],
  userId?: string,
  take = 10,
) {
  const rows = await prisma.product.findMany({
    where: { AND: [{ isActive: true }, where] },
    orderBy,
    take,
    select: productCardSelect,
  });
  const wishlisted = await wishlistedIds(userId, rows.map((row) => row.id));
  return rows.map((row) => toProductCard(row, wishlisted));
}
