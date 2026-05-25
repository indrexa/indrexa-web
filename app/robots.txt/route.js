import { getSiteOrigin } from "../../lib/site";

function getSitemapOrigin(request) {
  const origin = getSiteOrigin(request);
  if (origin === "https://indrexa.com" || origin === "http://indrexa.com") {
    return "https://www.indrexa.com";
  }
  return origin;
}

export async function GET(request) {
  try {
    const sitemapOrigin = getSitemapOrigin(request);

    const body = `User-agent: *
Allow: /

Sitemap: ${sitemapOrigin}/sitemap.xml

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: anthropic-ai
Allow: /
`;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("GET /robots.txt failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
