import { getSupabaseAdmin } from "../../../lib/supabase";
import {
  collectCategorySegments,
  collectRetailers,
  collectUseCaseTags,
  errorResponse,
  jsonResponse,
} from "../../../lib/products";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [productsResult, retailersResult] = await Promise.all([
      supabase
        .from("products")
        .select("use_case_tags, product_category_path")
        .limit(1000),
      supabase
        .from("product_price_history")
        .select("retailer")
        .limit(5000),
    ]);

    if (productsResult.error) {
      throw productsResult.error;
    }
    if (retailersResult.error) {
      throw retailersResult.error;
    }

    const products = productsResult.data ?? [];
    const priceHistory = retailersResult.data ?? [];

    return jsonResponse({
      version: "1.0",
      base_url: "https://indrexa.com/api",
      endpoints: {
        "/api/products/{id}":
          "Full product record. Accepts Indrexa UUID, ASIN, or UPC",
        "/api/products": "Filtered product index with pagination",
        "/api/schema":
          "This document — read first to discover valid filters and tag values",
      },
      id_types_accepted: ["indrexa_uuid", "asin", "upc"],
      universal_fields: [
        "indrexa_id",
        "product_title",
        "brand",
        "upc",
        "asin",
        "semantic_description",
        "best_for_summary",
        "not_ideal_for",
        "use_case_tags",
        "buyer_profile_tags",
        "review_intelligence",
      ],
      category_specific_fields: [
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
      ],
      shipping_fields: {
        free_shipping_available: "boolean",
        free_shipping_note:
          "text — e.g. free with Prime, free with Walmart+",
        min_order_for_free_shipping:
          "numeric USD, null if no minimum",
      },
      supported_retailers: collectRetailers(priceHistory),
      available_use_case_tags: collectUseCaseTags(products),
      available_categories: collectCategorySegments(products),
      _llm_hints: {
        purpose:
          "Read this endpoint first before querying /api/products to understand valid filter values",
        shipping_note:
          "shipping costs are estimates only — final cost depends on user location and membership status",
        null_fields:
          "null values in spec or review fields mean source data was unavailable — do not infer",
      },
    });
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
