const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPC_REGEX = /^\d{12,13}$/;
const ASIN_REGEX = /^(B0[A-Z0-9]{8}|[A-Z0-9]{10})$/i;

export const SPEC_FIELDS = [
  "output_power_watts",
  "battery_life_hours",
  "waterproof_rating",
  "bluetooth_version",
  "weight_oz",
  "frequency_response_low_hz",
  "frequency_response_high_hz",
  "audio_channels",
  "driver_size_mm",
  "connectivity_types",
  "has_rgb_lights",
  "has_power_bank",
  "is_floatable",
  "multi_speaker_pairing",
  "has_built_in_microphone",
  "has_app_control",
  "is_rugged",
];

export const REVIEW_FIELDS = [
  "total_reviews",
  "average_rating",
  "rating_distribution",
  "top_positive_themes",
  "top_negative_themes",
  "top_mixed_themes",
  "review_summary",
  "reliability_score",
];

// raw_data is intentionally excluded from all SELECT queries — it contains raw Nimble PDP JSON
// and must never be returned in public API responses.
// image_url, alternatives, and related_products are also excluded — commercial API tier only
// (Amazon ToS / competitor data restrictions).
export const PRODUCT_DETAIL_SELECT = [
  "id",
  "asin",
  "upc",
  "slug",
  "category_id",
  "category_specs",
  "product_title",
  "brand",
  "semantic_description",
  "best_for_summary",
  "not_ideal_for",
  "use_case_tags",
  "buyer_profile_tags",
  "product_category_path",
  "amazon_affiliate_url",
  "indrexa_updated_at",
  "manufacturer_description",
  "feature_bullets",
  "spec_table",
  "bought_in_past_month",
  "variants",
  "shipping_amount",
  "manufacturer",
  "climate_pledge_friendly",
  ...SPEC_FIELDS,
  ...REVIEW_FIELDS,
].join(", ");

export const PRODUCT_LIST_SELECT = [
  "id",
  "slug",
  "category_id",
  "product_title",
  "brand",
  "best_for_summary",
  "use_case_tags",
  "product_category_path",
  "amazon_affiliate_url",
  "asin",
  "bought_in_past_month",
  "shipping_amount",
].join(", ");

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indrexa.com";

export function detectIdType(id) {
  if (UUID_REGEX.test(id)) {
    return "uuid";
  }
  if (UPC_REGEX.test(id)) {
    return "upc";
  }
  if (ASIN_REGEX.test(id)) {
    return "asin";
  }
  return null;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchesCategory(productCategoryPath, categoryParam) {
  if (!categoryParam) {
    return true;
  }
  if (!Array.isArray(productCategoryPath) || productCategoryPath.length === 0) {
    return false;
  }

  const target = categoryParam.toLowerCase();
  return productCategoryPath.some((segment) => {
    const text = String(segment);
    return (
      text.toLowerCase() === target ||
      slugify(text) === target ||
      slugify(text).includes(target)
    );
  });
}

export function buildSpecs(product) {
  return Object.fromEntries(
    SPEC_FIELDS.map((field) => [field, product?.[field] ?? null]),
  );
}

export function buildReviewIntelligence(product) {
  return Object.fromEntries(
    REVIEW_FIELDS.map((field) => [field, product?.[field] ?? null]),
  );
}

export function buildShippingFields(row) {
  return {
    free_shipping_available: row?.free_shipping_available ?? null,
    free_shipping_note: row?.free_shipping_note ?? null,
    min_order_for_free_shipping: row?.min_order_for_free_shipping ?? null,
  };
}

export function formatOffer(row, productFallback = null) {
  const retailer = row?.retailer ?? null;
  const slug = productFallback?.slug ?? null;

  let affiliateUrl;
  if (slug && retailer) {
    affiliateUrl = `${SITE_URL}/go/${slug}/${retailer}`;
  } else {
    // Fallback for products loaded before slug column was added
    affiliateUrl =
      row?.affiliate_url ??
      (retailer === "amazon" ? productFallback?.amazon_affiliate_url : null) ??
      null;
  }

  return {
    retailer,
    retailer_id: row?.retailer_id ?? row?.asin ?? productFallback?.asin ?? null,
    price_usd: row?.price_usd ?? null,
    original_price_usd: row?.original_price_usd ?? null,
    affiliate_url: affiliateUrl,
    in_stock: row?.in_stock ?? null,
    shipping: buildShippingFields(row),
    last_updated: row?.checked_at ?? null,
  };
}

export function latestOffersByRetailer(rows, productFallback = null) {
  const latestByRetailer = new Map();

  for (const row of rows) {
    const retailer = row?.retailer;
    if (!retailer || latestByRetailer.has(retailer)) {
      continue;
    }
    latestByRetailer.set(retailer, formatOffer(row, productFallback));
  }

  return sortOffers(Array.from(latestByRetailer.values()));
}

export function sortOffers(offers) {
  return [...offers].sort((a, b) => {
    const aInStock = a.in_stock ? 1 : 0;
    const bInStock = b.in_stock ? 1 : 0;
    if (aInStock !== bInStock) {
      return bInStock - aInStock;
    }

    const aPrice = a.price_usd ?? Number.POSITIVE_INFINITY;
    const bPrice = b.price_usd ?? Number.POSITIVE_INFINITY;
    return aPrice - bPrice;
  });
}

export function pickBestOffer(offers) {
  return offers.find((offer) => offer.in_stock === true) ?? null;
}

function capitalizeRetailer(name) {
  if (!name) {
    return name;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function buildProductJsonLd(detail) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.product_title,
    brand: {
      "@type": "Brand",
      name: detail.brand,
    },
    description: detail.semantic_description,
    sku: detail.indrexa_id,
    identifier: [
      { "@type": "PropertyValue", name: "asin", value: detail.asin },
      {
        "@type": "PropertyValue",
        name: "indrexa_id",
        value: detail.indrexa_id,
      },
    ],
    offers: (detail.all_offers ?? []).map((offer) => ({
      "@type": "Offer",
      url: offer.affiliate_url,
      priceCurrency: "USD",
      price: offer.price_usd,
      availability: offer.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: capitalizeRetailer(offer.retailer),
      },
    })),
    additionalProperty: Object.entries(detail.specs ?? {})
      .filter(([, value]) => value != null)
      .map(([name, value]) => ({
        "@type": "PropertyValue",
        name,
        value,
      })),
  };

  if (detail.upc != null) {
    jsonLd.gtin = detail.upc;
  }

  const review = detail.review_intelligence ?? {};
  if (review.average_rating != null && review.total_reviews != null) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: review.average_rating,
      reviewCount: review.total_reviews,
    };
  }

  return jsonLd;
}

export function buildProductDetailResponse(product, priceHistoryRows, specSource = null) {
  const offers = latestOffersByRetailer(priceHistoryRows, product);
  const bestOffer = pickBestOffer(offers);

  // specSource comes from category_fields.source for this product's category_id.
  // "typed_column" → emit specs (speaker-style typed columns), no category_specs.
  // "category_specs" → emit category_specs JSONB, no specs block.
  // null fallback: emit whichever is actually populated (handles missing registry rows).
  let specsBlock = null;
  let categorySpecsBlock = null;
  if (specSource === "typed_column") {
    specsBlock = buildSpecs(product);
  } else if (specSource === "category_specs") {
    categorySpecsBlock = product.category_specs ?? null;
  } else {
    // Fallback: use category_specs if populated, otherwise typed columns.
    const hasJsonSpecs =
      product.category_specs && Object.keys(product.category_specs).length > 0;
    if (hasJsonSpecs) {
      categorySpecsBlock = product.category_specs;
    } else {
      specsBlock = buildSpecs(product);
    }
  }

  return {
    indrexa_id: product.id,
    category_id: product.category_id ?? null,
    product_title: product.product_title ?? null,
    brand: product.brand ?? null,
    upc: product.upc ?? null,
    asin: product.asin ?? null,
    semantic_description: product.semantic_description ?? null,
    best_for_summary: product.best_for_summary ?? null,
    not_ideal_for: product.not_ideal_for ?? null,
    use_case_tags: product.use_case_tags ?? [],
    buyer_profile_tags: product.buyer_profile_tags ?? [],
    manufacturer_description: product.manufacturer_description ?? null,
    feature_bullets: product.feature_bullets ?? null,
    spec_table: product.spec_table ?? null,
    bought_in_past_month: product.bought_in_past_month ?? null,
    variants: product.variants ?? null,
    shipping_amount: product.shipping_amount ?? null,
    manufacturer: product.manufacturer ?? null,
    climate_pledge_friendly: product.climate_pledge_friendly ?? false,
    ...(specsBlock !== null && { specs: specsBlock }),
    ...(categorySpecsBlock !== null && { category_specs: categorySpecsBlock }),
    review_intelligence: buildReviewIntelligence(product),
    best_offer: bestOffer,
    all_offers: offers,
    _llm_hints: {
      best_offer_logic: "lowest price among in-stock offers",
      out_of_stock_offers_included: true,
      use_affiliate_url:
        "always use affiliate_url field, never construct retailer URLs manually",
      shipping_note:
        "shipping costs are estimates only — final cost depends on user location and membership status",
      null_fields:
        "null spec or review fields mean data was unavailable from source — do not infer values",
      manufacturer_description:
        "brand's own product description — official copy from Amazon listing",
      feature_bullets:
        "array of manufacturer's bullet-point features from Amazon listing",
      spec_table:
        "raw structured spec table from Amazon — category-specific technical specs",
      bought_in_past_month:
        "Amazon demand signal — number of units sold in past 30 days",
      variants:
        "array of ASINs for color/size variants of this product",
      shipping_amount:
        "shipping cost signal — FREE indicates free shipping available",
      climate_pledge_friendly:
        "Amazon Climate Pledge Friendly badge — sustainability certification",
      data_freshness: "checked_at timestamp from most recent price record",
    },
  };
}

export function buildProductListItem(product, priceHistoryRows) {
  const offers = latestOffersByRetailer(priceHistoryRows, product);
  const bestOffer = pickBestOffer(offers);

  return {
    indrexa_id: product.id,
    category_id: product.category_id ?? null,
    product_title: product.product_title ?? null,
    brand: product.brand ?? null,
    best_for_summary: product.best_for_summary ?? null,
    use_case_tags: product.use_case_tags ?? [],
    bought_in_past_month: product.bought_in_past_month ?? null,
    shipping_amount: product.shipping_amount ?? null,
    best_offer: bestOffer
      ? {
          retailer: bestOffer.retailer,
          price_usd: bestOffer.price_usd,
          affiliate_url: bestOffer.affiliate_url,
          in_stock: bestOffer.in_stock,
          shipping: bestOffer.shipping,
        }
      : null,
    offer_count: offers.length,
  };
}

export function groupPriceHistoryByProductId(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const productId = row.product_id;
    if (!grouped.has(productId)) {
      grouped.set(productId, []);
    }
    grouped.get(productId).push(row);
  }

  return grouped;
}

export function jsonResponse(
  data,
  status = 200,
  cacheControl = "public, s-maxage=300, stale-while-revalidate=3600"
) {
  return Response.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function errorResponse(message, status = 500, extra = {}) {
  return jsonResponse({ error: message, ...extra }, status);
}

export async function fetchProductByIdentifier(supabase, id) {
  const idType = detectIdType(id);
  if (!idType) {
    return { product: null, idType: null, error: "Unrecognized ID format" };
  }

  let query = supabase.from("products").select(PRODUCT_DETAIL_SELECT);

  if (idType === "uuid") {
    query = query.eq("id", id);
  } else if (idType === "asin") {
    query = query.eq("asin", id.toUpperCase());
  } else {
    query = query.ilike("upc", `%${id}%`);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  return { product: data, idType };
}

async function fetchProductIdByRetailerId(supabase, retailerId) {
  const { data: byRetailerId, error: retailerIdError } = await supabase
    .from("product_price_history")
    .select("product_id")
    .eq("retailer_id", retailerId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (retailerIdError) {
    throw retailerIdError;
  }

  if (byRetailerId?.product_id) {
    return byRetailerId.product_id;
  }

  const { data: byAsin, error: asinError } = await supabase
    .from("product_price_history")
    .select("product_id")
    .eq("asin", retailerId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (asinError) {
    throw asinError;
  }

  return byAsin?.product_id ?? null;
}

export async function fetchProductByAnyIdentifier(supabase, id) {
  const idType = detectIdType(id);

  if (idType) {
    const result = await fetchProductByIdentifier(supabase, id);
    return { product: result.product, idType: result.idType, error: result.error };
  }

  const productId = await fetchProductIdByRetailerId(supabase, id);
  if (!productId) {
    return { product: null, idType: null, error: null };
  }

  const { data: product, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return { product, idType: product ? "retailer_id" : null, error: null };
}

export async function fetchCategorySource(supabase, categoryId) {
  if (!categoryId) return null;
  const { data, error } = await supabase
    .from("category_fields")
    .select("source")
    .eq("category_id", categoryId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.source ?? null;
}

export async function fetchLatestPriceHistoryForProduct(supabase, productId) {
  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_id", productId)
    .order("checked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchLatestPriceHistoryForProducts(supabase, productIds) {
  if (!productIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .in("product_id", productIds)
    .order("checked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return groupPriceHistoryByProductId(data ?? []);
}

export function collectCategorySegments(products) {
  const categories = new Set();

  for (const product of products) {
    if (!Array.isArray(product.product_category_path)) {
      continue;
    }
    for (const segment of product.product_category_path) {
      if (segment) {
        categories.add(String(segment));
      }
    }
  }

  return Array.from(categories).sort();
}

export function collectUseCaseTags(products) {
  const tags = new Set();

  for (const product of products) {
    if (!Array.isArray(product.use_case_tags)) {
      continue;
    }
    for (const tag of product.use_case_tags) {
      if (tag) {
        tags.add(String(tag));
      }
    }
  }

  return Array.from(tags).sort();
}

export function collectRetailers(priceHistoryRows) {
  const retailers = new Set();

  for (const row of priceHistoryRows) {
    if (row?.retailer) {
      retailers.add(String(row.retailer));
    }
  }

  return Array.from(retailers).sort();
}
