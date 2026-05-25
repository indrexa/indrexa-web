import { getSiteOrigin } from "../../lib/site";

export async function GET(request) {
  try {
    const origin = getSiteOrigin(request);

    const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml

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
