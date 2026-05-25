import { getSupabaseAdmin } from "../../../lib/supabase";
import { getSiteOrigin } from "../../../lib/site";
import {
  buildProductDetailResponse,
  buildProductJsonLd,
  fetchLatestPriceHistoryForProduct,
  fetchProductByAnyIdentifier,
} from "../../../lib/products";

export async function GET(request, { params }) {
  try {
    const id = params?.id?.trim();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing product id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();
    const { product } = await fetchProductByAnyIdentifier(supabase, id);

    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found", id }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const origin = getSiteOrigin(request);
    const canonicalUrl = `${origin}/products/${product.id}`;

    if (id.toLowerCase() !== product.id.toLowerCase()) {
      return Response.redirect(canonicalUrl, 301);
    }

    const priceHistory = await fetchLatestPriceHistoryForProduct(
      supabase,
      product.id,
    );
    const productData = buildProductDetailResponse(product, priceHistory);
    productData._llm_hints.best_offer_null_means =
      "all known offers are currently out of stock — check all_offers for availability";

    const payload = {
      ...productData,
      json_ld: buildProductJsonLd(productData),
    };

    return Response.json(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        Link: `<${origin}/api/products/${product.id}>; rel="api", type="application/json"`,
        "X-Canonical": canonicalUrl,
      },
    });
  } catch (error) {
    console.error("GET /products/[id] failed:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
