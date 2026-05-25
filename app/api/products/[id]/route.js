import { getSupabaseAdmin } from "../../../../lib/supabase";
import {
  buildProductDetailResponse,
  detectIdType,
  errorResponse,
  fetchLatestPriceHistoryForProduct,
  fetchProductByIdentifier,
  jsonResponse,
} from "../../../../lib/products";

export async function GET(_request, { params }) {
  try {
    const id = params?.id?.trim();
    if (!id) {
      return errorResponse("Missing product id", 400);
    }

    if (!detectIdType(id)) {
      return errorResponse("Unrecognized ID format", 400, { id });
    }

    const supabase = getSupabaseAdmin();
    const { product, error: lookupError } = await fetchProductByIdentifier(
      supabase,
      id,
    );

    if (lookupError) {
      return errorResponse(lookupError, 400, { id });
    }

    if (!product) {
      return jsonResponse({ error: "Product not found", id }, 404);
    }

    const priceHistory = await fetchLatestPriceHistoryForProduct(
      supabase,
      product.id,
    );

    const payload = buildProductDetailResponse(product, priceHistory);
    payload._llm_hints.best_offer_null_means =
      "all known offers are currently out of stock — check all_offers for availability";

    return jsonResponse(payload);
  } catch (error) {
    console.error("GET /api/products/[id] failed:", error);
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
