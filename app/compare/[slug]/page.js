import { notFound } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import { getSupabaseAdmin } from "../../../lib/supabase";
import {
  buildProductDetailResponse,
  fetchLatestPriceHistoryForProduct,
  fetchProductByIdentifier,
} from "../../../lib/products";

export const revalidate = 21600; // 6-hour ISR — daily price refresh is the data clock

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.indrexa.com";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("comparisons")
    .select("title")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return { title: "Not found — Indrexa" };
  const base = data.title.replace(/:\s*which should you buy\?$/i, "");
  return {
    title: `${data.title} — Indrexa`,
    description: `Side-by-side specs, live pricing, and a data-backed verdict: ${base}.`,
    alternates: { canonical: `${SITE_URL}/compare/${slug}` },
  };
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function fetchComparison(supabase, slug) {
  const { data, error } = await supabase
    .from("comparisons")
    .select("slug, title, product_ids, comparison_type")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Spec table
// ---------------------------------------------------------------------------

function getSpecValue(detail, key) {
  if (key === "price")   return detail.best_offer?.price_usd ?? null;
  if (key === "rating")  return detail.review_intelligence?.average_rating ?? null;
  if (key === "reviews") return detail.review_intelligence?.total_reviews ?? null;
  if (key === "freq") {
    const lo = detail.specs?.frequency_response_low_hz;
    const hi = detail.specs?.frequency_response_high_hz;
    if (lo != null && hi != null) return `${lo}–${hi} Hz`;
    if (lo != null) return `${lo}+ Hz`;
    if (hi != null) return `up to ${hi} Hz`;
    return null;
  }
  if (key === "connectivity_types") {
    const v = detail.specs?.connectivity_types;
    return Array.isArray(v) ? v.join(", ") : (v ?? null);
  }
  return detail.specs?.[key] ?? null;
}

function fmtSpec(value, type) {
  if (value == null) return null;
  if (type === "money")   return `$${Number(value).toFixed(2)}`;
  if (type === "rating")  return `${value}★`;
  if (type === "reviews") return Number(value).toLocaleString();
  if (type === "bool")    return value ? "Yes" : "No";
  return String(value);
}

// Rows rendered only when at least one side has a non-null value.
const SPEC_ROWS = [
  { key: "price",                   label: "Price",          type: "money" },
  { key: "rating",                  label: "Rating",         type: "rating" },
  { key: "reviews",                 label: "Reviews",        type: "reviews" },
  { key: "output_power_watts",      label: "Output Power",   suffix: " W" },
  { key: "battery_life_hours",      label: "Battery Life",   suffix: " hrs" },
  { key: "waterproof_rating",       label: "Waterproof" },
  { key: "bluetooth_version",       label: "Bluetooth" },
  { key: "weight_oz",               label: "Weight",         suffix: " oz" },
  { key: "freq",                    label: "Freq. Response" },
  { key: "audio_channels",          label: "Channels" },
  { key: "driver_size_mm",          label: "Driver",         suffix: " mm" },
  { key: "connectivity_types",      label: "Connectivity" },
  { key: "has_rgb_lights",          label: "RGB Lights",     type: "bool" },
  { key: "has_power_bank",          label: "Power Bank",     type: "bool" },
  { key: "is_floatable",            label: "Floatable",      type: "bool" },
  { key: "multi_speaker_pairing",   label: "Multi-Speaker",  type: "bool" },
  { key: "has_built_in_microphone", label: "Built-in Mic",   type: "bool" },
  { key: "has_app_control",         label: "App Control",    type: "bool" },
  { key: "is_rugged",               label: "Rugged",         type: "bool" },
];

function buildVisibleRows(detailA, detailB) {
  return SPEC_ROWS.flatMap((row) => {
    const vA = getSpecValue(detailA, row.key);
    const vB = getSpecValue(detailB, row.key);
    if (vA == null && vB == null) return [];
    const fmt = (v) => {
      if (v == null) return "—";
      const base = fmtSpec(v, row.type);
      return base != null ? (row.suffix ? base + row.suffix : base) : String(v);
    };
    return [{ label: row.label, a: fmt(vA), b: fmt(vB) }];
  });
}

// ---------------------------------------------------------------------------
// Verdict — every claim cites a stored field value, no prose fallbacks
// ---------------------------------------------------------------------------

// Strip trailing parenthetical counts from review themes and normalize for
// collision detection: "Sound quality (3,600)" → "sound quality"
function cleanTheme(t) {
  return t.replace(/\s*\(\d[\d,]*\)\s*$/, "").trim();
}
function normTheme(t) {
  return cleanTheme(t).toLowerCase();
}

function buildVerdict(detailA, detailB) {
  const specsA = detailA.specs ?? {};
  const specsB = detailB.specs ?? {};
  const revA   = detailA.review_intelligence ?? {};
  const revB   = detailB.review_intelligence ?? {};
  const priceA = detailA.best_offer?.price_usd;
  const priceB = detailB.best_offer?.price_usd;
  const picks  = { a: [], b: [] };

  function add(side, condition, evidence) {
    if (picks[side].length < 3) picks[side].push({ condition, evidence });
  }

  // 1. Use-case tags unique to each side
  const tagsA = new Set(detailA.use_case_tags ?? []);
  const tagsB = new Set(detailB.use_case_tags ?? []);
  for (const t of tagsA) {
    if (!tagsB.has(t)) { add("a", t, `tagged "${t}" — not on ${detailB.brand}`); break; }
  }
  for (const t of tagsB) {
    if (!tagsA.has(t)) { add("b", t, `tagged "${t}" — not on ${detailA.brand}`); break; }
  }

  // 2. Positive review themes unique to each side.
  // Normalize before comparison so "Sound quality (3,600)" and "Sound quality"
  // are treated as the same theme and not used as a differentiator.
  const rawPosA = revA.top_positive_themes ?? [];
  const rawPosB = revB.top_positive_themes ?? [];
  const normPosA = new Set(rawPosA.map(normTheme));
  const normPosB = new Set(rawPosB.map(normTheme));
  const uniqA = rawPosA.filter((t) => !normPosB.has(normTheme(t)));
  const uniqB = rawPosB.filter((t) => !normPosA.has(normTheme(t)));
  if (uniqA.length) {
    const themes = uniqA.slice(0, 2).map(cleanTheme);
    add("a",
      normTheme(uniqA[0]),
      `reviewers highlight "${themes.join('", "')}"`,
    );
  }
  if (uniqB.length) {
    const themes = uniqB.slice(0, 2).map(cleanTheme);
    add("b",
      normTheme(uniqB[0]),
      `reviewers highlight "${themes.join('", "')}"`,
    );
  }

  // 3. Battery delta (≥3 h)
  const bA = specsA.battery_life_hours, bB = specsB.battery_life_hours;
  if (bA != null && bB != null) {
    if (bA - bB >= 3) add("a", "all-day or multi-day use", `${bA}h vs ${bB}h battery`);
    else if (bB - bA >= 3) add("b", "all-day or multi-day use", `${bB}h vs ${bA}h battery`);
  }

  // 4. Output power (≥5 W)
  const pA = specsA.output_power_watts, pB = specsB.output_power_watts;
  if (pA != null && pB != null) {
    if (pA - pB >= 5) add("a", "louder outdoor or party use", `${pA}W vs ${pB}W rated output`);
    else if (pB - pA >= 5) add("b", "louder outdoor or party use", `${pB}W vs ${pA}W rated output`);
  }

  // 5. Waterproof rating — compare water and dust digits independently.
  // IPXn → water=n, no dust. IPmn → water=n (last), dust=m (first).
  // IP67 vs IPX7 have equal water (both 7); only dust differs — don't surface
  // "use near water" for equal water protection regardless of dust digit.
  function ipWaterDigit(ip) {
    const s = String(ip ?? "").toUpperCase().replace(/\s/g, "");
    const xm = s.match(/^IPX(\d)/);  if (xm) return parseInt(xm[1], 10);
    const fm = s.match(/^IP(\d)(\d)/); if (fm) return parseInt(fm[2], 10);
    return -1;
  }
  function ipDustDigit(ip) {
    const fm = String(ip ?? "").toUpperCase().replace(/\s/g, "").match(/^IP(\d)(\d)/);
    return fm ? parseInt(fm[1], 10) : -1;
  }
  const waterA = ipWaterDigit(specsA.waterproof_rating);
  const waterB = ipWaterDigit(specsB.waterproof_rating);
  if (waterA !== waterB && Math.max(waterA, waterB) >= 5) {
    if (waterA > waterB) {
      add("a", "use near water",
        `${specsA.waterproof_rating}${specsB.waterproof_rating ? ` vs ${specsB.waterproof_rating}` : " — no rating on other"}`);
    } else {
      add("b", "use near water",
        `${specsB.waterproof_rating}${specsA.waterproof_rating ? ` vs ${specsA.waterproof_rating}` : " — no rating on other"}`);
    }
  } else if (waterA === waterB && waterA >= 0) {
    // Water equal — surface dust protection if it differs (e.g. IP67 vs IPX7)
    const dustA = ipDustDigit(specsA.waterproof_rating);
    const dustB = ipDustDigit(specsB.waterproof_rating);
    if (dustA > dustB) {
      add("a", "dusty environments",
        `${specsA.waterproof_rating} dust + water vs ${specsB.waterproof_rating || "no rating"}`);
    } else if (dustB > dustA) {
      add("b", "dusty environments",
        `${specsB.waterproof_rating} dust + water vs ${specsA.waterproof_rating || "no rating"}`);
    }
  }

  // 6. Average rating (≥0.3 delta, ≥100 reviews)
  const rA = revA.average_rating, rB = revB.average_rating;
  const nA = revA.total_reviews ?? 0, nB = revB.total_reviews ?? 0;
  if (rA != null && rB != null) {
    if (rA - rB >= 0.3 && nA >= 100) {
      add("a", "long-term reliability", `${rA}★ across ${nA.toLocaleString()} reviews vs ${rB}★`);
    } else if (rB - rA >= 0.3 && nB >= 100) {
      add("b", "long-term reliability", `${rB}★ across ${nB.toLocaleString()} reviews vs ${rA}★`);
    }
  }

  // 7. Weight — lighter = more portable (≥2 oz)
  const ozA = specsA.weight_oz, ozB = specsB.weight_oz;
  if (ozA != null && ozB != null) {
    if (ozB - ozA >= 2 && !picks.a.length) add("a", "ultra-portable carry", `${ozA}oz vs ${ozB}oz`);
    if (ozA - ozB >= 2 && !picks.b.length) add("b", "ultra-portable carry", `${ozB}oz vs ${ozA}oz`);
  }

  // 8. Price — last-resort numeric delta
  if (priceA != null && priceB != null) {
    if (priceA < priceB && !picks.a.length) {
      add("a", "budget-conscious buyers", `$${priceA.toFixed(2)} vs $${priceB.toFixed(2)}`);
    }
    if (priceB < priceA && !picks.b.length) {
      add("b", "budget-conscious buyers", `$${priceB.toFixed(2)} vs $${priceA.toFixed(2)}`);
    }
  }

  // 9. Positive theme count — absolute last resort
  if (!picks.a.length) {
    add("a", "overall customer satisfaction",
      `${normPosA.size} vs ${normPosB.size} positive review themes`);
  }
  if (!picks.b.length) {
    add("b", "overall customer satisfaction",
      `${normPosB.size} vs ${normPosA.size} positive review themes`);
  }

  return picks;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

// Strip price phrases baked into semantic_description at enrichment time.
// e.g. "priced at $139.95" — price is stale the moment it changes, so strip
// it rather than propagate wrong data into structured markup.
function sanitizeDescription(text) {
  if (!text) return text;
  return text
    .replace(/\b(priced\s+(?:at|around)|costs?\s+(?:about|around)?|retails?\s+(?:at|for)|available\s+for|offered\s+at)\s+\$[\d,]+(?:\.\d{2})?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Truncate to first N sentences, capped at maxChars — keeps hero card compact.
function shortDescription(text, maxSentences = 2, maxChars = 200) {
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  const excerpt = sentences.slice(0, maxSentences).join("").trim();
  const result = excerpt || text;
  return result.length > maxChars ? result.slice(0, maxChars).trimEnd() + "…" : result;
}

function buildJsonLd(title, detailA, detailB) {
  function makeProduct(detail) {
    const rev = detail.review_intelligence ?? {};
    const offer = detail.best_offer;
    const node = {
      "@type": "Product",
      name: detail.product_title,
      brand: { "@type": "Brand", name: detail.brand },
      description: sanitizeDescription(detail.semantic_description),
    };
    if (rev.average_rating != null && rev.total_reviews != null) {
      node.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rev.average_rating,
        reviewCount: rev.total_reviews,
      };
    }
    if (offer?.affiliate_url) {
      node.offers = {
        "@type": "Offer",
        url: offer.affiliate_url,
        priceCurrency: "USD",
        ...(offer.price_usd != null && { price: offer.price_usd }),
        availability: offer.in_stock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      };
    }
    return node;
  }
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: `Side-by-side comparison of ${detailA.product_title} vs ${detailB.product_title}`,
    itemListElement: [
      { "@type": "ListItem", position: 1, item: makeProduct(detailA) },
      { "@type": "ListItem", position: 2, item: makeProduct(detailB) },
    ],
  };
}

// Prevent XSS in JSON-LD: escape angle brackets and ampersands.
function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function shortTitle(title, max = 30) {
  if (!title || title.length <= max) return title;
  const cut = title.slice(0, max).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 15 ? cut.slice(0, lastSpace) : cut) + "…";
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ComparisonPage({ params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();

  const comparison = await fetchComparison(supabase, slug);
  if (!comparison) notFound();

  const [idA, idB] = comparison.product_ids;

  const [[resultA, historyA], [resultB, historyB]] = await Promise.all([
    Promise.all([
      fetchProductByIdentifier(supabase, idA),
      fetchLatestPriceHistoryForProduct(supabase, idA),
    ]),
    Promise.all([
      fetchProductByIdentifier(supabase, idB),
      fetchLatestPriceHistoryForProduct(supabase, idB),
    ]),
  ]);

  if (!resultA.product || !resultB.product) notFound();

  const detailA  = buildProductDetailResponse(resultA.product, historyA, "typed_column");
  const detailB  = buildProductDetailResponse(resultB.product, historyB, "typed_column");
  const verdict  = buildVerdict(detailA, detailB);
  const specRows = buildVisibleRows(detailA, detailB);
  const jsonLd   = buildJsonLd(comparison.title, detailA, detailB);

  const labelA = shortTitle(detailA.product_title);
  const labelB = shortTitle(detailB.product_title);

  return (
    <>
      <style>{`
        :root { color-scheme: light dark; }
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; background: #fafafa; }
        @media (prefers-color-scheme: dark) {
          body { color: #e8e8e8; background: #111; }
          a { color: #7eb8ff; }
          .card { background: #1a1a1a; border-color: #333; }
          th { background: #222 !important; }
          tr:nth-child(even) { background: #161616 !important; }
          tr:hover { background: #1e1e1e !important; }
          .pick { background: #1a1a1a; border-color: #333; }
          footer { border-color: #333; }
        }
        main { max-width: 56rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        h1 { font-size: 1.55rem; font-weight: 700; margin: 0 0 2rem; letter-spacing: -0.02em; line-height: 1.3; }
        h2 { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #666; margin: 2.5rem 0 0.75rem; }
        @media (prefers-color-scheme: dark) { h2 { color: #999; } }
        a { color: #0066cc; }
        .hero { display: flex; gap: 1rem; }
        @media (max-width: 580px) { .hero { flex-direction: column; } }
        .card { flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem 1.5rem; background: #fff; }
        .card-name { font-weight: 600; font-size: 1rem; line-height: 1.4; margin-bottom: 0.2rem; }
        .card-brand { font-size: 0.875rem; color: #666; margin-bottom: 0.4rem; }
        .card-rating { font-size: 0.875rem; color: #555; }
        @media (prefers-color-scheme: dark) { .card-brand, .card-rating { color: #999; } }
        .card-price { font-size: 1.3rem; font-weight: 700; color: #1a6e2e; margin: 0.5rem 0 0; }
        @media (prefers-color-scheme: dark) { .card-price { color: #4caf72; } }
        .card-oos { font-size: 0.9rem; color: #888; margin: 0.5rem 0 0; }
        .card-desc { font-size: 0.85rem; line-height: 1.5; color: #555; margin-top: 0.5rem; }
        @media (prefers-color-scheme: dark) { .card-desc { color: #aaa; } }
        .btn { display: inline-block; margin-top: 0.9rem; padding: 0.5rem 1.1rem; background: #0066cc; color: #fff; border-radius: 5px; text-decoration: none; font-size: 0.875rem; font-weight: 600; }
        .btn:hover { background: #0052a3; color: #fff; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        th { padding: 0.5rem 0.75rem; background: #f4f4f4; font-weight: 600; font-size: 0.8rem; text-align: left; }
        th:not(:first-child) { text-align: center; max-width: 10rem; }
        td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #ebebeb; }
        td:not(:first-child) { text-align: center; }
        tr:nth-child(even) { background: #fafafa; }
        tr:hover { background: #f0f4ff; }
        .spec-label { color: #555; font-size: 0.85rem; }
        @media (prefers-color-scheme: dark) { .spec-label { color: #aaa; } }
        .verdict-cols { display: flex; gap: 1rem; margin-top: 0.5rem; }
        @media (max-width: 580px) { .verdict-cols { flex-direction: column; } }
        .verdict-side { flex: 1; }
        .verdict-heading { font-weight: 700; font-size: 0.95rem; margin-bottom: 0.6rem; }
        .pick { border: 1px solid #e0e0e0; border-radius: 6px; padding: 0.7rem 0.9rem; margin-bottom: 0.6rem; background: #fff; }
        .pick-cond { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.15rem; }
        .pick-ev { font-size: 0.75rem; color: #777; font-family: ui-monospace, monospace; }
        @media (prefers-color-scheme: dark) { .pick-ev { color: #999; } }
        footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; color: #666; }
        @media (prefers-color-scheme: dark) { footer { color: #999; } }
        footer nav { margin: 0.4rem 0 0.75rem; }
        footer nav a { margin-right: 1rem; }
      `}</style>

      <SiteHeader />
      <main>
        <h1>{comparison.title}</h1>

        {/* Product hero cards */}
        <section className="hero" aria-label="Product overview">
          <ProductCard detail={detailA} />
          <ProductCard detail={detailB} />
        </section>

        {/* Side-by-side spec table */}
        <h2>Specs comparison</h2>
        <table aria-label="Side-by-side spec comparison">
          <thead>
            <tr>
              <th></th>
              <th scope="col">{labelA}</th>
              <th scope="col">{labelB}</th>
            </tr>
          </thead>
          <tbody>
            {specRows.map((row) => (
              <tr key={row.label}>
                <td className="spec-label">{row.label}</td>
                <td>{row.a}</td>
                <td>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Verdict */}
        <h2>Verdict — which should you buy?</h2>
        <div className="verdict-cols">
          <VerdictSide
            label={`Pick ${labelA} for:`}
            picks={verdict.a}
            offer={detailA.best_offer}
            productTitle={detailA.product_title}
          />
          <VerdictSide
            label={`Pick ${labelB} for:`}
            picks={verdict.b}
            offer={detailB.best_offer}
            productTitle={detailB.product_title}
          />
        </div>

        <footer>
          <nav>
            <a href={`${SITE_URL}/api/products`}>API</a>
            <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>
            <a href={`${SITE_URL}/sitemap.xml`}>Sitemap</a>
          </nav>
          <p>
            Prices and availability reflect the most recent data refresh.
            Outbound links are affiliate links — Indrexa earns a commission on qualifying
            purchases at no extra cost to you.{" "}
            <a href="mailto:hello@indrexa.com">hello@indrexa.com</a>
          </p>
        </footer>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (Server Components — no client state needed)
// ---------------------------------------------------------------------------

function ProductCard({ detail }) {
  const rev   = detail.review_intelligence ?? {};
  const offer = detail.best_offer;
  const desc  = shortDescription(sanitizeDescription(detail.semantic_description));
  return (
    <div className="card">
      <div className="card-name">{detail.product_title}</div>
      <div className="card-brand">{detail.brand}</div>
      {desc && <div className="card-desc">{desc}</div>}
      {rev.average_rating != null && (
        <div className="card-rating">
          {rev.average_rating}&#9733;
          {rev.total_reviews != null && (
            <> &middot; {Number(rev.total_reviews).toLocaleString()} reviews</>
          )}
        </div>
      )}
      {offer?.price_usd != null ? (
        <div className="card-price">${Number(offer.price_usd).toFixed(2)}</div>
      ) : (
        <div className="card-oos">Price unavailable</div>
      )}
      {offer?.affiliate_url && offer.in_stock ? (
        <a
          href={offer.affiliate_url}
          className="btn"
          rel="sponsored nofollow"
          target="_blank"
        >
          Buy at {capitalize(offer.retailer)}
        </a>
      ) : (
        <div className="card-oos">Currently unavailable</div>
      )}
    </div>
  );
}

function VerdictSide({ label, picks, offer, productTitle }) {
  return (
    <div className="verdict-side">
      <div className="verdict-heading">{label}</div>
      {picks.map((pick, i) => (
        <div key={i} className="pick">
          <div className="pick-cond">{capitalize(pick.condition)}</div>
          <div className="pick-ev">{pick.evidence}</div>
        </div>
      ))}
      {offer?.affiliate_url && offer.in_stock && (
        <a
          href={offer.affiliate_url}
          className="btn"
          rel="sponsored nofollow"
          target="_blank"
        >
          Buy {shortTitle(productTitle, 22)}
        </a>
      )}
    </div>
  );
}
