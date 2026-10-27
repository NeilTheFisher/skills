---
name: web-perf
description: Audit, diagnose, or optimize website loading and interaction performance, Core Web Vitals, and Lighthouse performance scores.
---

# Web Performance Audit

Your knowledge of web performance metrics, thresholds, and tooling APIs may be outdated. **Prefer retrieval over pre-training** when citing specific numbers or recommendations.

## Retrieval Sources

| Source | How to retrieve | Use for |
|--------|----------------|---------|
| web.dev | `https://web.dev/articles/vitals` | Core Web Vitals thresholds, definitions |
| Chrome DevTools docs | `https://developer.chrome.com/docs/devtools/performance` | Tooling APIs, trace analysis |
| Lighthouse scoring | `https://developer.chrome.com/docs/lighthouse/performance/performance-scoring` | Score weights, metric thresholds |

## Browser tooling

Use `bunx chrome-devtools-axi` for traces, network inspection, and screenshots. Its commands change, so the source of truth is the CLI itself:

```bash
bunx chrome-devtools-axi --help              # commands and flags
bunx chrome-devtools-axi <command> --help    # per-command usage
```

Do not hardcode subcommand names from memory or from this skill; read `--help` first and follow the CLI's next-step hints. If trace tooling is unavailable, continue source and network analysis and say which measurements could not be collected.

## Key Guidelines

- **Be assertive**: Verify claims by checking network requests, DOM, or codebase—then state findings definitively.
- **Verify before recommending**: Confirm something is unused before suggesting removal.
- **Quantify impact**: Use estimated savings from insights. Don't prioritize changes with 0ms impact.
- **Skip non-issues**: If render-blocking resources have 0ms estimated impact, note but don't recommend action.
- **Be specific**: Say "compress hero.png (450KB) to WebP" not "optimize images".
- **Prioritize ruthlessly**: A site with 200ms LCP and 0 CLS is already excellent—say so.

## Workflow

Copy this checklist to track progress:

```
Audit Progress:
- [ ] Phase 1: Performance trace (navigate + record)
- [ ] Phase 2: Core Web Vitals analysis (includes CLS culprits)
- [ ] Phase 3: Network analysis
- [ ] Phase 4: Accessibility snapshot
- [ ] Phase 5: Codebase analysis (skip if third-party site)
```

### Phase 1: Performance trace

Navigate to the target and record a cold-load trace with reload enabled, using the navigation and performance commands from `bunx chrome-devtools-axi --help`. Retrieve the trace results and keep the insight set id for the next phase.

If the trace is empty or fails, confirm the page loaded first. If an insight name does not match, list the available insights from the trace response.

### Phase 2: Core Web Vitals analysis

Extract the key metrics from the trace's performance insights. Insight names vary by Chrome DevTools version, so discover them from the trace response rather than assuming.

| Metric | What to Look For |
|--------|------------------|
| LCP | Time to largest contentful paint; breakdown of TTFB, resource load, render delay |
| CLS | Elements causing layout shifts (images without dimensions, injected content, font swaps) |
| Render Blocking | CSS/JS blocking first paint |
| Document Latency | Server response time issues |
| Network Dependencies | Request chains delaying critical resources |

**Key thresholds (good/needs-improvement/poor):**
- TTFB: < 800ms / < 1.8s / > 1.8s
- FCP: < 1.8s / < 3s / > 3s
- LCP: < 2.5s / < 4s / > 4s
- INP: < 200ms / < 500ms / > 500ms
- TBT: < 200ms / < 600ms / > 600ms
- CLS: < 0.1 / < 0.25 / > 0.25
- Speed Index: < 3.4s / < 5.8s / > 5.8s

### Phase 3: Network analysis

List network requests (scripts, stylesheets, documents, fonts, images) and inspect individual requests.

**Look for:**

1. **Render-blocking resources**: JS/CSS in `<head>` without `async`/`defer`/`media` attributes
2. **Network chains**: Resources discovered late because they depend on other resources loading first (e.g., CSS imports, JS-loaded fonts)
3. **Missing preloads**: Critical resources (fonts, hero images, key scripts) not preloaded
4. **Caching issues**: Missing or weak `Cache-Control`, `ETag`, or `Last-Modified` headers
5. **Large payloads**: Uncompressed or oversized JS/CSS bundles
6. **Unused preconnects**: If flagged, verify by checking if ANY requests went to that origin. If zero requests, it's definitively unused—recommend removal. If requests exist but loaded late, the preconnect may still be valuable.

### Phase 4: Accessibility snapshot

Take an accessibility tree snapshot and flag high-level gaps:

- Missing or duplicate ARIA IDs
- Elements with poor contrast ratios (check against WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- Focus traps or missing focus indicators
- Interactive elements without accessible names

## Phase 5: Codebase Analysis

**Skip if auditing a third-party site without codebase access.**

Analyze the codebase to understand where improvements can be made.

### Detect Framework & Bundler

Search for configuration files to identify the stack:

| Tool | Config Files |
|------|--------------|
| Webpack | `webpack.config.js`, `webpack.*.js` |
| Vite | `vite.config.js`, `vite.config.ts` |
| Rollup | `rollup.config.js`, `rollup.config.mjs` |
| esbuild | `esbuild.config.js`, build scripts with `esbuild` |
| Parcel | `.parcelrc`, `package.json` (parcel field) |
| Next.js | `next.config.js`, `next.config.mjs` |
| Nuxt | `nuxt.config.js`, `nuxt.config.ts` |
| SvelteKit | `svelte.config.js` |
| Astro | `astro.config.mjs` |

Also check `package.json` for framework dependencies and build scripts.

### Tree-Shaking & Dead Code

- **Webpack**: Check for `mode: 'production'`, `sideEffects` in package.json, `usedExports` optimization
- **Vite/Rollup**: Tree-shaking enabled by default; check for `treeshake` options
- **Look for**: Barrel files (`index.js` re-exports), large utility libraries imported wholesale (lodash, moment)

### Unused JS/CSS

- Check for CSS-in-JS vs. static CSS extraction
- Look for PurgeCSS/UnCSS configuration (Tailwind's `content` config)
- Identify dynamic imports vs. eager loading

### Polyfills

- Check for `@babel/preset-env` targets and `useBuiltIns` setting
- Look for `core-js` imports (often oversized)
- Check `browserslist` config for overly broad targeting

### Compression & Minification

- Check for `terser`, `esbuild`, or `swc` minification
- Look for gzip/brotli compression in build output or server config
- Check for source maps in production builds (should be external or disabled)

## Output Format

Present findings as:

1. **Core Web Vitals Summary** - Table with metric, value, and rating (good/needs-improvement/poor)
2. **Top Issues** - Prioritized list of problems with estimated impact (high/medium/low)
3. **Recommendations** - Specific, actionable fixes with code snippets or config changes
4. **Codebase Findings** - Framework/bundler detected, optimization opportunities (omit if no codebase access)
