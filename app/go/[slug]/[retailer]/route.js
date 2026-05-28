import { getSupabaseAdmin } from "../../../../lib/supabase";

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  const botPatterns = [
    "googlebot",
    "gptbot",
    "perplexitybot",
    "claudebot",
    "anthropic-ai",
    "googleother",
    "bingbot",
    "msnbot",
    "yandexbot",
    "duckduckbot",
    "applebot",
    "facebot",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "discordbot",
    "telegrambot",
    "bot",
    "crawler",
    "spider",
    "crawl",
    "slurp",
    "mediapartners",
    "scrapy",
    "wget",
    "curl",
    "python-requests",
    "axios",
    "go-http-client",
    "java/",
    "libwww",
  ];
  return botPatterns.some((pattern) => ua.includes(pattern));
}

export async function GET(request, { params: paramsPromise }) {
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

  const ua = request.headers.get("user-agent") || "";
  const botVisit = isBot(ua);

  if (botVisit) {
    supabase
      .rpc("increment_bot_visit", { slug_val: slug, retailer_val: retailer })
      .then(() => {})
      .catch(() => {});
  } else {
    supabase
      .rpc("increment_redirect_click", { slug_val: slug, retailer_val: retailer })
      .then(() => {})
      .catch(() => {});
  }

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
