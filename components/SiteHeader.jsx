export default function SiteHeader() {
  return (
    <>
      <style>{`
        .site-header { border-bottom: 1px solid #e8e8e8; }
        .site-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 1.5rem;
          gap: 1rem;
        }
        .site-header-wordmark {
          font-family: system-ui, -apple-system, sans-serif;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
          color: #1a1a1a;
        }
        .site-header-tagline {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.8rem;
          color: #888;
          margin-left: 0.6rem;
        }
        /* ── "What is Indrexa?" disclosure ── */
        .site-header-what { position: relative; flex-shrink: 0; }
        .site-header-what-toggle {
          list-style: none;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.8rem;
          color: #888;
          cursor: pointer;
          user-select: none;
          padding: 0;
          margin: 0;
        }
        .site-header-what-toggle::-webkit-details-marker { display: none; }
        .site-header-what-toggle::after { content: " ▾"; font-size: 0.65rem; }
        .site-header-what[open] .site-header-what-toggle::after { content: " ▴"; font-size: 0.65rem; }
        .site-header-what-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 0.6rem);
          width: 22rem;
          max-width: 90vw;
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.85rem;
          line-height: 1.55;
          color: #444;
          z-index: 20;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        /* ── dark mode (before mobile so mobile cascade wins on box-shadow) ── */
        @media (prefers-color-scheme: dark) {
          .site-header { border-bottom-color: #2a2a2a; }
          .site-header-wordmark { color: #e8e8e8; }
          .site-header-tagline  { color: #666; }
          .site-header-what-toggle { color: #666; }
          .site-header-what-panel {
            background: #1a1a1a;
            border-color: #333;
            color: #ccc;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
        }
        /* ── mobile: details on its own line; panel in document flow (no float) ── */
        @media (max-width: 600px) {
          .site-header-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.15rem;
          }
          .site-header-what {
            position: static;
            width: 100%;
            margin-top: 0.4rem;
          }
          .site-header-what-panel {
            position: static;
            width: 100%;
            max-width: none;
            margin-top: 0.5rem;
            box-shadow: none;
          }
        }
      `}</style>
      <header className="site-header">
        <div className="site-header-bar">
          <div>
            <span className="site-header-wordmark">Indrexa</span>
            <span className="site-header-tagline">The product intelligence layer for AI</span>
          </div>
          <details className="site-header-what">
            <summary className="site-header-what-toggle">What is Indrexa?</summary>
            <div className="site-header-what-panel">
              Indrexa enriches product data so AI assistants can compare and
              recommend. These picks are generated from specs and verified
              customer reviews — not paid placement.
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
