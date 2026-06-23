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

    const allProducts = [];
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("products")
        .select("id, indrexa_updated_at")
        .order("indrexa_updated_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) break;
      allProducts.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const products = allProducts;

    const allComparisons = [];
    from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("comparisons")
        .select("slug, updated_at")
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) break;
      allComparisons.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
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

    const comparisonEntries = allComparisons
      .map((comparison) => {
        const lastmod = formatLastMod(comparison.updated_at);
        const loc = `${origin}/compare/${comparison.slug}`;
        return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}${comparisonEntries ? `\n${comparisonEntries}` : ""}
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
