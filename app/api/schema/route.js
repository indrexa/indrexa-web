import { getSupabaseAdmin } from "../../../lib/supabase";
import {
  collectRetailers,
  collectUseCaseTags,
  errorResponse,
  jsonResponse,
} from "../../../lib/products";

const CATEGORY_DISPLAY_NAMES = {
  bluetooth_speakers: "Portable Bluetooth Speakers",
  headphones: "Headphones & Earbuds",
  wireless_earbuds: "Wireless Earbuds",
  power_banks: "Portable Chargers & Power Banks",
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [productsResult, retailersResult, fieldsResult] = await Promise.all([
      supabase
        .from("products")
        .select("use_case_tags")
        .limit(2000),
      supabase
        .from("product_price_history")
        .select("retailer")
        .limit(5000),
      supabase
        .from("category_fields")
        .select(
          "category_id, field_key, display_name, data_type, unit, description, is_filterable, source"
        )
        .order("category_id")
        .order("sort_order"),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (retailersResult.error) throw retailersResult.error;
    if (fieldsResult.error) throw fieldsResult.error;

    const products = productsResult.data ?? [];
    const priceHistory = retailersResult.data ?? [];
    const fieldRows = fieldsResult.data ?? [];

    // Group fields by category_id
    const categories = {};
    for (const row of fieldRows) {
      const { category_id, ...field } = row;
      if (!categories[category_id]) {
        categories[category_id] = {
          display_name: CATEGORY_DISPLAY_NAMES[category_id] ?? category_id,
          fields: [],
        };
      }
      categories[category_id].fields.push({
        field_key: field.field_key,
        display_name: field.display_name,
        data_type: field.data_type,
        unit: field.unit ?? null,
        description: field.description,
        is_filterable: field.is_filterable,
        source: field.source,
      });
    }

    return jsonResponse(
      {
        version: "1.1",
        base_url: "https://www.indrexa.com/api",
        endpoints: {
          "/api/products/{id}":
            "Full product record. Accepts Indrexa UUID, ASIN, or UPC",
          "/api/products": "Filtered product index with pagination",
          "/api/schema":
            "This document — read first to discover valid filter values and per-category spec fields",
        },
        query_parameters: {
          use_case: "filter by use_case tag (see available_use_case_tags)",
          category:
            "filter by category_id — must exactly match one of the available_categories keys (e.g. power_banks)",
          retailer: "filter by retailer name (see supported_retailers)",
          upc: "filter by UPC code",
          retailer_id:
            "filter by retailer-specific product ID — requires retailer param",
          sort: "sort order — valid values: price_asc, price_desc, rating, reviews, newest",
          limit: "results per page, 1–100 (default 20)",
          offset: "pagination offset (default 0)",
        },
        id_types_accepted: ["indrexa_uuid", "asin", "upc"],
        universal_fields: [
          "indrexa_id",
          "category_id",
          "product_title",
          "brand",
          "upc",
          "asin",
          "current_price_usd",
          "average_rating",
          "in_stock",
          "semantic_description",
          "best_for_summary",
          "not_ideal_for",
          "use_case_tags",
          "buyer_profile_tags",
          "review_intelligence",
        ],
        available_categories: Object.fromEntries(
          Object.entries(CATEGORY_DISPLAY_NAMES).map(([id, name]) => [
            id,
            name,
          ])
        ),
        categories,
        shipping_fields: {
          free_shipping_available: "boolean",
          free_shipping_note: "text — e.g. free with Prime, free with Walmart+",
          min_order_for_free_shipping: "numeric USD, null if no minimum",
        },
        supported_retailers: collectRetailers(priceHistory),
        available_use_case_tags: collectUseCaseTags(products),
        _llm_hints: {
          purpose:
            "Read this endpoint first before querying /api/products to understand valid filter values and per-category spec fields",
          category_filter_note:
            "?category= must be an exact category_id key from available_categories (e.g. ?category=power_banks). Human-readable names like 'Portable Power Banks' will return empty results.",
          category_specs_note:
            "Non-speaker products return specs under category_specs in the detail response. Bluetooth speakers return specs as typed top-level fields (see categories.bluetooth_speakers.fields with source=typed_column).",
          shipping_note:
            "shipping costs are estimates only — final cost depends on user location and membership status",
          null_fields:
            "null values in spec or review fields mean source data was unavailable — do not infer",
        },
      },
      200,
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
  } catch (error) {
    console.error("GET /api/schema failed:", error);
    return errorResponse("Internal server error", 500);
  }
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
