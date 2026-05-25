import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function GET(_request, { params: paramsPromise }) {
  const { slug, retailer } = await paramsPromise;

  if (!slug || !retailer) {
    return Response.json({ error: "Missing slug or retailer" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("redirects")
    .select("destination_url, product_id, retailer")
    .eq("slug", slug)
    .eq("retailer", retailer)
    .maybeSingle();

  if (error) {
    console.error(`GET /go/${slug}/${retailer} lookup failed:`, error);
    return Response.json({ error: "Redirect not found" }, { status: 404 });
  }

  if (!data) {
    return Response.json({ error: "Redirect not found" }, { status: 404 });
  }

  // Fire-and-forget click count — never awaited, never blocks the redirect
  supabase
    .rpc("increment_redirect_click", { slug_val: slug, retailer_val: retailer })
    .then(() => {})
    .catch(() => {});

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.destination_url,
      "Cache-Control": "no-store",
      "X-Indrexa-Product": data.product_id ?? "",
      "X-Indrexa-Retailer": data.retailer ?? retailer,
    },
  });
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
