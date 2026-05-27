export default function Home() {
  return (
    <>
      <style>{`
        :root { color-scheme: light dark; }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; background: #fafafa; }
        @media (prefers-color-scheme: dark) {
          body { color: #e8e8e8; background: #111; }
          a { color: #7eb8ff; }
          .card { background: #1a1a1a; border-color: #333; }
        }
        main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
        h1 { font-size: 2rem; font-weight: 600; margin: 0 0 0.25rem; letter-spacing: -0.02em; }
        h2 { font-size: 1rem; font-weight: 600; margin: 2.5rem 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
        p { margin: 0 0 1rem; }
        .tagline { font-size: 1.125rem; opacity: 0.8; margin-bottom: 1.5rem; }
        ul { margin: 0; padding: 0; list-style: none; }
        li { margin-bottom: 1.25rem; }
        li strong { display: block; margin-bottom: 0.25rem; }
        li a { word-break: break-all; }
        .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1.25rem; margin-top: 0.5rem; }
        footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; opacity: 0.75; }
        @media (prefers-color-scheme: dark) { footer { border-color: #333; } }
        footer nav { margin: 0.5rem 0; }
        footer nav a { margin-right: 1rem; }
        a { color: #0066cc; }
      `}</style>
      <main>
        <header>
          <h1>Indrexa</h1>
          <p className="tagline">AI-readable semantic commerce infrastructure</p>
          <p>
            Indrexa is a structured product intelligence layer built for LLMs and AI agents — not for human browsing.
            We enrich e-commerce product data with semantic descriptions, use-case tags, buyer profiles, and review
            intelligence so AI systems can retrieve, compare, and recommend products natively.
          </p>
        </header>

        <section>
          <h2>What this site is</h2>
          <p>
            These pages exist for machine consumption, structured data indexing, and AI crawler discovery. Product
            pages at <code>/products/&#123;id&#125;</code> contain JSON-LD structured data for crawlers. Human-facing
            UI is not the focus — if you&apos;re looking for product recommendations, ask your AI assistant.
          </p>
        </section>

        <section>
          <h2>For AI agents and developers</h2>
          <ul>
            <li>
              <strong>API</strong>
              <a href="https://www.indrexa.com/api/schema">https://www.indrexa.com/api/schema</a>
              <p>Start here — self-documenting API with all available categories, filters, and field docs.</p>
            </li>
            <li>
              <strong>LLM Discovery</strong>
              <a href="https://www.indrexa.com/llms.txt">https://www.indrexa.com/llms.txt</a>
              <p>Machine-readable site description, API guide, and data licensing information.</p>
            </li>
            <li>
              <strong>Sitemap</strong>
              <a href="https://www.indrexa.com/sitemap.xml">https://www.indrexa.com/sitemap.xml</a>
              <p>All product URLs for crawler indexing.</p>
            </li>
          </ul>
        </section>

        <section>
          <h2>Data access</h2>
          <div className="card">
            <p><strong>Public API</strong> — free, no auth, semantic product intelligence with masked redirect URLs.</p>
            <p><strong>Commercial API</strong> — raw structured feeds, direct retailer URLs, bulk exports, embeddings, higher rate limits.</p>
            <p>Contact: <a href="mailto:hello@indrexa.com">hello@indrexa.com</a></p>
          </div>
        </section>

        <footer>
          <p>© 2026 Indrexa. All rights reserved.</p>
          <nav>
            <a href="https://www.indrexa.com/api/schema">API</a>
            <a href="https://www.indrexa.com/llms.txt">llms.txt</a>
            <a href="https://www.indrexa.com/sitemap.xml">Sitemap</a>
          </nav>
          <p><a href="mailto:hello@indrexa.com">hello@indrexa.com</a></p>
        </footer>
      </main>
    </>
  );
}
