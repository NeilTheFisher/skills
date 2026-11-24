// Shared helpers: name normalisation, argument parsing, small formatters.

export const MAKERS = [
  'thinking machines',
  'inclusionai',
  'reflection',
  'spacexai',
  'anthropic',
  'deepseek',
  'longcat',
  'minimax',
  'stepfun',
  'tencent',
  'mistral',
  'nvidia',
  'google',
  'openai',
  'alibaba',
  'xiaomi',
  'moonshot',
  'cohere',
  'upstage',
  'meta',
  'kimi',
  'z ai',
  'z.ai',
  'zai',
  'xai',
];

// Version separators differ between sources ("claude-haiku-5-5" vs
// "Claude Haiku 5.5"), so unify digit-dash-digit into a dot before comparing.
function unifyVersions(s) {
  return s.replace(/(\d)\s*[-_]\s*(\d)/g, '$1.$2');
}

/**
 * Comparison key for a model name from any of the three namespaces
 * (opencode ids, Artificial Analysis labels, arena.ai labels).
 * Strips effort/parenthetical tags, provider prefixes, benchmark date stamps
 * and punctuation, so "GPT-6 Luna (max)" and "opencode/gpt-6-luna" collide.
 */
export function normKey(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.split('\n')[0]; // arena cells glue maker + licence onto the name
  s = unifyVersions(s);
  // trailing parentheticals: (high) (max) (xhigh) (medium) (low) (non-reasoning)
  // (max, default fallback) (preliminary)
  s = s.replace(/\((?:high|max|xhigh|low|medium|non-reasoning|default fallback|preliminary)[^)]*\)/g, ' ');
  s = s.replace(/\([^)]*\)\s*$/, ' ');
  // trailing benchmark date stamps such as "1017", "0902", "0813"
  s = s.replace(/\b(?:19|20)\d{2}\b/g, ' ').replace(/\s\d{3,4}\s*$/, ' ');
  for (const m of MAKERS) {
    s = s.replace(new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s-]+`), '');
  }
  s = s.replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
  s = s.replace(/\.+$/g, '');
  return s;
}

/** Drop vendor-side suffixes that never appear in benchmark names. */
export function idToName(id) {
  const bare = id.split('/').slice(-1)[0];
  return bare
    .replace(/-(free|contributor)(?=-|$)/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Key used for benchmark matching: preview tiers share a name with the base model. */
export function matchKey(name) {
  return normKey(String(name).replace(/-preview$/, ''));
}

/**
 * Find the benchmark row whose key matches an opencode model.
 * Exact key match wins; otherwise a unique containment match.
 */
export function matchRow(modelKey, rows) {
  const exact = rows.filter((r) => r.key === modelKey);
  if (exact.length) return { ...pickBestVariant(exact), match: 'exact' };
  if (modelKey.length < 3) return null;
  // Containment matching, but never across a version boundary: "minimax-m3" must
  // not claim "minimax-m3.1-flash" (a different model), while
  // "qwen3.8-flash" may claim "qwen3.8-flash-next" (same family, newer suffix).
  const containsAt = (short, long) => {
    const i = long.indexOf(short);
    if (i === -1) return false;
    const next = long[i + short.length];
    return !(next === '.' || (next && /\d/.test(next)));
  };
  const hits = rows.filter(
    (r) => r.key !== modelKey && (containsAt(r.key, modelKey) || containsAt(modelKey, r.key)),
  );
  if (!hits.length) return null;
  const uniq = [...new Set(hits.map((h) => h.key))];
  if (uniq.length > 1) {
    // Prefer the shortest differing key (closest match), else give up: a guess
    // is worse than "not benchmarked".
    const best = hits.slice().sort((a, b) => Math.abs(a.key.length - modelKey.length) - Math.abs(b.key.length - modelKey.length));
    if (Math.abs(best[0].key.length - modelKey.length) > 4) return null;
    const second = best[1];
    if (second && Math.abs(second.key.length - modelKey.length) === Math.abs(best[0].key.length - modelKey.length)) return null;
    return { ...best[0], match: 'approx' };
  }
  return { ...hits[0], match: 'approx' };
}

// Several rows can share a key (effort variants); keep the highest-scoring one
// and remember which variant it was, so the report can say "effort=high".
function pickBestVariant(rows) {
  if (rows.length === 1) return rows[0];
  return rows.slice().sort((a, b) => (b.intel ?? b.score ?? -1) - (a.intel ?? a.score ?? -1))[0];
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq)).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (eq !== -1) { out[key] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

export function num(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function money(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export const TASKS = {
  writing: {
    label: 'writing / prose (CV, bio, long-form)',
    primary: 'arena',
    arenaCategory: 'Creative Writing',
  },
  reasoning: {
    label: 'reasoning / analysis / code',
    primary: 'aa',
    arenaCategory: null,
  },
  both: {
    label: 'balanced',
    primary: 'both',
    arenaCategory: null,
  },
};
