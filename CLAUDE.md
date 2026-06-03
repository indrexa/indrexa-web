## Secret handling (non-negotiable)

Never put secret values in code, commands, comments, or output. This includes
SUPABASE_SERVICE_KEY, SUPABASE_URL keys, NIMBLE_API_KEY, ANTHROPIC_API_KEY,
and any *_KEY / *_TOKEN / *_SECRET.

- ALWAYS read secrets from the environment, e.g. os.environ["SUPABASE_SERVICE_KEY"]
  (Python) or process.env.SUPABASE_SERVICE_KEY (JS). Assume a .env file is present.
- NEVER hardcode a key inline in a one-off bash command, script, or test snippet.
- NEVER print, echo, or log a secret's value, or include it in diffs or messages.
  Refer to the variable name, never the value.
- If you find a secret hardcoded anywhere, stop and flag it to me.

Comparison and product pages must be zero client-side JavaScript — server-render
all content as static HTML so non-JS crawlers and LLM fetchers see it, and to
keep latency minimal. Use HTML/CSS (e.g. <details>) for interactions, not React
state, unless a feature genuinely cannot be done without JS (justify it first).