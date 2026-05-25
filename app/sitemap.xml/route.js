import { getSupabaseAdmin } from "../../lib/supabase";
import { getSiteOrigin } from "../../lib/site";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastMod(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const origin = getSiteOrigin(request);

    const { data: products, error } = await supabase
      .from("products")
      .select("id, indrexa_updated_at")
      .order("indrexa_updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    const urlEntries = (products ?? [])
      .map((product) => {
        const lastmod = formatLastMod(product.indrexa_updated_at);
        const loc = `${origin}/products/${product.id}`;

        return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("GET /sitemap.xml failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
