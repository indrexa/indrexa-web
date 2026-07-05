import { createHash } from "crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Known crawler / automated-client user-agent substrings (case-insensitive).
// Used only to classify rows written to click_events; does not affect the
// existing isBot() redirect-counting behavior.
const CRAWLER_UA_PATTERNS = [
  "gptbot",
  "claudebot",
  "claude-user",
  "perplexitybot",
  "oai-searchbot",
  "googlebot",
  "bingbot",
  "bytespider",
  "ccbot",
  "amazonbot",
  "curl",
  "python",
  "axios",
  "node-fetch",
  "headless",
];

function classifyRequest(userAgent, referer, acceptLanguage) {
  const ua = (userAgent || "").toLowerCase();
  if (ua && CRAWLER_UA_PATTERNS.some((pattern) => ua.includes(pattern))) {
    return "bot";
  }
  // Headless browsers typically omit both a referer and accept-language.
  if (!referer && !acceptLanguage) {
    return "suspect";
  }
  return "human";
}

// SHA-256 the client IP and keep only the first 16 hex chars. The raw IP is
// never stored. Returns null when no forwarded IP is present.
function hashIp(forwardedFor) {
  if (!forwardedFor) return null;
  const clientIp = forwardedFor.split(",")[0].trim();
  if (!clientIp) return null;
  return createHash("sha256").update(clientIp).digest("hex").slice(0, 16);
}

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
  const referer = request.headers.get("referer") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
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

  // Fire-and-forget click-event logging. Never block or fail the redirect if
  // the insert errors.
  try {
    supabase
      .from("click_events")
      .insert({
        slug,
        retailer,
        user_agent: ua || null,
        referrer: referer || null,
        ip_hash: hashIp(request.headers.get("x-forwarded-for")),
        classified_as: classifyRequest(ua, referer, acceptLanguage),
      })
      .then(() => {})
      .catch(() => {});
  } catch {
    // swallow — click logging must never affect the redirect
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
