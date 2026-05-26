import { getSupabaseAdmin } from "../../../lib/supabase";
import {
  buildProductListItem,
  errorResponse,
  fetchLatestPriceHistoryForProducts,
  jsonResponse,
  PRODUCT_LIST_SELECT,
} from "../../../lib/products";

const SORT_MAP = {
  price_asc: { column: "current_price_usd", ascending: true, nullsFirst: false },
  price_desc: { column: "current_price_usd", ascending: false, nullsFirst: false },
  rating: { column: "average_rating", ascending: false, nullsFirst: false },
  reviews: { column: "total_reviews", ascending: false, nullsFirst: false },
  newest: { column: "indrexa_created_at", ascending: false, nullsFirst: false },
};

function parseSort(value) {
  return SORT_MAP[value] ?? null;
}

function parseLimit(value) {
  const parsed = Number.parseInt(value ?? "20", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(parsed, 100);
}

function parseOffset(value) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const useCase = searchParams.get("use_case");
    const category = searchParams.get("category");
    const retailer = searchParams.get("retailer");
    const upc = searchParams.get("upc");
    const retailerId = searchParams.get("retailer_id");
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));
    const sortConfig = parseSort(searchParams.get("sort"));

    if (retailerId && !retailer) {
      return errorResponse(
        "retailer parameter is required when retailer_id is provided",
        400,
      );
    }

    const supabase = getSupabaseAdmin();

    if (upc) {
      const { data: product, error } = await supabase
        .from("products")
        .select(PRODUCT_LIST_SELECT)
        .ilike("upc", `%${upc}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!product) {
        return jsonResponse({
          total: 0,
          limit,
          offset,
          products: [],
          _llm_hints: listHints(),
        });
      }

      const historyByProduct = await fetchLatestPriceHistoryForProducts(
        supabase,
        [product.id],
      );
      const item = buildProductListItem(
        product,
        historyByProduct.get(product.id) ?? [],
      );

      return jsonResponse({
        total: 1,
        limit,
        offset,
        products: [item],
        _llm_hints: listHints(),
      });
    }

    if (retailerId && retailer) {
      const { data: historyMatch, error: historyError } = await supabase
        .from("product_price_history")
        .select("product_id")
        .eq("retailer", retailer)
        .eq("retailer_id", retailerId)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (historyError) {
        throw historyError;
      }

      if (!historyMatch?.product_id) {
        const fallback = await supabase
          .from("product_price_history")
          .select("product_id")
          .eq("retailer", retailer)
          .eq("asin", retailerId)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallback.error) {
          throw fallback.error;
        }

        if (!fallback.data?.product_id) {
          return jsonResponse({
            total: 0,
            limit,
            offset,
            products: [],
            _llm_hints: listHints(),
          });
        }

        historyMatch.product_id = fallback.data.product_id;
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select(PRODUCT_LIST_SELECT)
        .eq("id", historyMatch.product_id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!product) {
        return jsonResponse({
          total: 0,
          limit,
          offset,
          products: [],
          _llm_hints: listHints(),
        });
      }

      const historyByProduct = await fetchLatestPriceHistoryForProducts(
        supabase,
        [product.id],
      );
      const item = buildProductListItem(
        product,
        historyByProduct.get(product.id) ?? [],
      );

      return jsonResponse({
        total: 1,
        limit,
        offset,
        products: [item],
        _llm_hints: listHints(),
      });
    }

    let productIdsForRetailer = null;
    if (retailer) {
      const { data: retailerRows, error: retailerError } = await supabase
        .from("product_price_history")
        .select("product_id")
        .eq("retailer", retailer)
        .limit(10000);

      if (retailerError) {
        throw retailerError;
      }

      productIdsForRetailer = [
        ...new Set((retailerRows ?? []).map((row) => row.product_id)),
      ];

      if (productIdsForRetailer.length === 0) {
        return jsonResponse({
          total: 0,
          limit,
          offset,
          products: [],
          _llm_hints: listHints(),
        });
      }
    }

    function applyFilters(query) {
      if (useCase) query = query.contains("use_case_tags", [useCase]);
      if (category) query = query.eq("category_id", category);
      if (productIdsForRetailer) query = query.in("id", productIdsForRetailer);
      return query;
    }

    const { count, error: countError } = await applyFilters(
      supabase.from("products").select("*", { count: "exact", head: true }),
    );

    if (countError) {
      throw countError;
    }

    let dataQuery = applyFilters(
      supabase.from("products").select(PRODUCT_LIST_SELECT),
    );
    if (sortConfig) {
      dataQuery = dataQuery.order(sortConfig.column, {
        ascending: sortConfig.ascending,
        nullsFirst: sortConfig.nullsFirst,
      });
    } else {
      dataQuery = dataQuery.order("product_title", { ascending: true });
    }
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data: products, error: productsError } = await dataQuery;

    if (productsError) {
      throw productsError;
    }

    const page = products ?? [];
    const historyByProduct = await fetchLatestPriceHistoryForProducts(
      supabase,
      page.map((product) => product.id),
    );

    const listItems = page.map((product) =>
      buildProductListItem(product, historyByProduct.get(product.id) ?? []),
    );

    return jsonResponse({
      total: count ?? 0,
      limit,
      offset,
      products: listItems,
      _llm_hints: listHints(),
    });
  } catch (error) {
    console.error("GET /api/products failed:", error);
    return errorResponse("Internal server error", 500);
  }
}

function listHints() {
  return {
    detail_endpoint: "GET /api/products/{indrexa_id} for full record",
    available_filters: [
      "use_case",
      "category",
      "retailer",
      "upc",
      "retailer_id",
      "sort",
    ],
    available_sort_values: [
      "price_asc",
      "price_desc",
      "rating",
      "reviews",
      "newest",
    ],
    sort_default: "no sort applied — Supabase natural order",
    pagination: "use offset parameter for next page",
    best_offer_null_means:
      "all known offers are currently out of stock — check all_offers for availability",
    shipping_note:
      "shipping costs are estimates only — final cost depends on user location and membership status",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
