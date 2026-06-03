export default function SiteHeader() {
  return (
    <>
      <style>{`
        .site-header {
          border-bottom: 1px solid #e8e8e8;
          padding: 0.65rem 1.5rem;
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
        @media (prefers-color-scheme: dark) {
          .site-header { border-bottom-color: #2a2a2a; }
          .site-header-wordmark { color: #e8e8e8; }
          .site-header-tagline { color: #666; }
        }
      `}</style>
      <header className="site-header">
        <span className="site-header-wordmark">Indrexa</span>
        <span className="site-header-tagline">The product intelligence layer for AI</span>
      </header>
    </>
  );
}
