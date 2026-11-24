#!/usr/bin/env node
// Collect leaderboard data for the models this OpenCode install actually offers.
//
//   node collect.mjs [--task writing|reasoning|both] [--provider opencode-go]
//                    [--models a,b,c] [--refresh] [--headless] [--all]
//                    [--no-shot] [--dpr 2] [--arena-file rows.json]
//
// Artificial Analysis is fetched here (no bot wall). arena.ai sits behind
// Cloudflare, which rejects every automation-owned Chrome profile, so its rows
// are supplied by the agent through `--arena-file` (see SKILL.md) or a previous
// cache. Missing arena data only drops that column, never the run.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { idToName, matchKey, matchRow, money, normKey, num, parseArgs, TASKS } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WIN_CHROME = path.resolve(ROOT, '../playwright-windows/scripts/win-chrome.mjs');
const OVERRIDES = path.join(ROOT, 'reference/overrides.json');
const QUOTAS = path.join(ROOT, 'reference/opencode-go-quotas.json');
const CACHE = path.join(os.homedir(), '.cache', 'opencode-models');
const TTL_MS = 12 * 60 * 60 * 1000;

const AA_URL = 'https://artificialanalysis.ai/leaderboards/models';
const AA_CHART = 'https://artificialanalysis.ai/models';
const ARENA_URL = 'https://arena.ai/leaderboard/chat/text';
const CHART_SEL = '#intelligence-index-vs-cost-per-task-chart';

const args = parseArgs(process.argv.slice(2));
const task = String(args.task || 'reasoning');
if (!TASKS[task]) die(`unknown --task "${task}" (use ${Object.keys(TASKS).join(', ')})`);
const preset = TASKS[task];
const outDir = args.out ? path.resolve(String(args.out)) : path.join(CACHE, new Date().toISOString().slice(0, 10));

main().catch((e) => die(e.stack || String(e)));

function die(msg) {
  console.error(`opencode-models: ${msg}`);
  process.exit(1);
}

const sameName = (a, b) => normKey(a) === normKey(b);

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const models = listModels();
  if (!models.length) die('no models matched — check --provider/--models');

  const { aa, arena, arenaCategory } = await loadData();
  const quotas = readJson(QUOTAS, {});

  const rows = models.map((m) => {
    const over = readJson(OVERRIDES, {})[m.name] || {};
    const aaRow = over.aa ? findByKey(aa, over.aa) : matchRow(matchKey(m.name), aa);
    const arenaRow = over.arena ? findByKey(arena, over.arena) : matchRow(matchKey(m.name), arena);
    return {
      id: m.id,
      provider: m.provider,
      name: m.name,
      label: over.label || titleCase(m.name),
      aa: aaRow
        ? {
            name: aaRow.name,
            intel: aaRow.intel,
            cost: aaRow.cost,
            minutes: aaRow.minutes,
            approx: aaRow.match === 'approx' && !sameName(m.name, aaRow.name),
          }
        : null,
      arena: arenaRow
        ? {
            name: arenaRow.name,
            rank: arenaRow.rank,
            score: arenaRow.score,
            cost: arenaRow.cost,
            approx: arenaRow.match === 'approx' && !sameName(m.name, arenaRow.name),
          }
        : null,
      go: quotas.models?.[m.name] || null,
      note: over.note || null,
    };
  });

  let shot = null;
  const aaNames = rows.filter((r) => r.aa && r.aa.intel != null).map((r) => r.aa.name);
  if (!args.noShot && aaNames.length) shot = await takeChartShot(aaNames);

  const payload = {
    generatedAt: new Date().toISOString(),
    task,
    taskLabel: preset.label,
    sources: {
      aa: AA_URL,
      arena: arenaCategory
        ? `${ARENA_URL}/${arenaCategory.toLowerCase().replace(/\s+/g, '-')}`
        : ARENA_URL,
      arenaCategory: arenaCategory || null,
    },
    arenaAvailable: arena.length > 0,
    quotaSnapshot: quotas.asOf || null,
    screenshot: shot?.path || null,
    screenshotModels: shot?.count ?? null,
    models: rows,
    arenaTop: arena.slice(0, 12).map((r) => ({ rank: r.rank, name: r.name, maker: r.maker, score: r.score, cost: r.cost })),
  };

  fs.writeFileSync(path.join(CACHE, 'latest.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, 'models.json'), JSON.stringify(payload, null, 2));

  const matched = rows.filter((r) => r.aa?.intel != null || r.arena?.score != null).length;
  // Progress goes to stderr: stdout is the markdown the agent pastes verbatim.
  console.error(
    `collected ${rows.length} models (${matched} benchmarked, arena ${arena.length ? 'yes' : 'missing'}) -> ${outDir}` +
      (shot ? `\nchart: ${shot.path} (${shot.count} plotted)` : ''),
  );
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

// arena.ai also renders a hidden duplicate table for its wide layout; those rows
// glue the maker onto the model name ("Gemini 4 Argon (High)Google · Proprietary")
// and would poison the matcher, so drop them and dedupe by rank.
function sanitizeArena(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r || !r.name) continue;
    const name = String(r.name).trim();
    if (!name || name.length > 60 || name.includes('·')) continue;
    const k = r.rank ?? name;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...r, name });
  }
  return out;
}

function findByKey(rows, name) {  const k = normKey(name);
  const hit = rows.find((r) => r.key === k) || null;
  return hit ? { ...hit, match: 'exact' } : null;
}

// "Gemini 4 Argon (high)" -> "Gemini 4 Argon"
function cleanLabel(name) {
  if (!name) return null;
  return String(name).replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
}

function titleCase(id) {
  const BRANDS = {
    gpt: 'GPT',
    glm: 'GLM',
    mimo: 'MiMo',
    minimax: 'MiniMax',
    deepseek: 'DeepSeek',
    longcat: 'LongCat',
    qwen: 'Qwen',
    kimi: 'Kimi',
    llm: 'LLM',
  };
  return id
    .replace(/(\d)-(\d)/g, '$1.$2')
    .split('-')
    .map((p) => BRANDS[p] || (/^[a-z]/.test(p) ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');
}

function listModels() {
  let raw;
  try {
    raw = execFileSync('opencode', ['models'], { encoding: 'utf8', timeout: 120000 });
  } catch (e) {
    die(`\`opencode models\` failed: ${e.message}`);
  }
  const all = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const wantedProviders = args.provider
    ? String(args.provider).split(',').map((p) => p.trim())
    : args.all
      ? null
      : ['opencode', 'opencode-go'];
  const only = args.models ? String(args.models).split(',').map((m) => normKey(m)) : null;

  const picked = all
    .map((id) => ({ id, provider: id.split('/')[0], name: idToName(id) }))
    .filter((m) => (wantedProviders ? wantedProviders.includes(m.provider) : true))
    .filter((m) => (only ? only.includes(normKey(m.name)) || only.includes(normKey(m.id)) : true));

  // `hy4` and `hy4-preview` collapse to the same benchmark row once suffixes are
  // stripped; keep one entry, preferring the plain id.
  const seen = new Map();
  for (const m of picked) {
    const k = matchKey(m.name);
    const prev = seen.get(k);
    if (!prev) { seen.set(k, m); continue; }
    if (prev.id.includes('preview') && !m.id.includes('preview')) seen.set(k, m);
  }
  return [...seen.values()];
}

async function loadData() {
  const aaCache = path.join(CACHE, 'aa.json');
  const arenaCache = path.join(CACHE, 'arena.json');
  const fresh = (p) => {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return !args.refresh && Date.now() - Date.parse(j.fetchedAt) < TTL_MS ? j : null;
    } catch {
      return null;
    }
  };

  // arena rows may be handed over by the agent (browse cannot be scripted here)
  let arena = fresh(arenaCache);
  if (args.arenaFile) {
    const rows = readJson(path.resolve(String(args.arenaFile)), []);
    if (Array.isArray(rows) && rows.length) {
      arena = {
        fetchedAt: new Date().toISOString(),
        category: String(args.arenaCategory || preset.arenaCategory || 'Overall'),
        rows: sanitizeArena(rows).map((r) => ({ ...r, key: r.key || normKey(r.name) })),
      };
      fs.writeFileSync(arenaCache, JSON.stringify(arena, null, 2));
    } else {
      console.error(`opencode-models: --arena-file ${args.arenaFile} unreadable or empty, continuing without arena`);
    }
  }
  if (!arena) arena = { fetchedAt: new Date().toISOString(), category: null, rows: [] };

  let aa = fresh(aaCache);
  if (!aa) {
    aa = { fetchedAt: new Date().toISOString(), rows: await withBrowser(scrapeAA) };
    fs.writeFileSync(aaCache, JSON.stringify(aa, null, 2));
  }

  return { aa: aa.rows, arena: arena.rows, arenaCategory: arena.category };
}

async function withBrowser(fn) {
  const { launch } = await import(pathToFileURL(WIN_CHROME).href);
  const b = await launch({
    headless: Boolean(args.headless),
    args: [`--force-device-scale-factor=${args.dpr ? Number(args.dpr) : 2}`, '--window-size=1600,1100'],
  });
  try {
    b.page.setDefaultTimeout(60000);
    return await fn(b.page);
  } finally {
    await b.close().catch(() => {});
  }
}

async function scrapeAA(page) {
  await page.goto(AA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('table tr').length > 40, null, { timeout: 60000 });
  const cells = await page.$$eval('table tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim().replace(/\s+/g, ' '))),
  );
  const rows = cells
    .filter((c) => c.length >= 6)
    .map((c) => ({
      name: c[0],
      key: normKey(c[0]),
      maker: c[2],
      intel: num(c[3]),
      cost: money(c[4]),
      minutes: num(c[5]),
    }))
    .filter((r) => r.name && r.name !== 'Model');
  if (!rows.length) die('Artificial Analysis table came back empty (site changed?)');
  return rows;
}

async function takeChartShot(aaNames) {
  try {
    return await withBrowser(async (page) => {
      await page.goto(AA_CHART, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector(CHART_SEL, { timeout: 60000 });
      await page.waitForTimeout(4000);
      const count = await filterChart(page, aaNames);
      const el = await page.$(CHART_SEL);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);
      // Trim the collapsed accordion rows at the bottom, which add an empty band.
      const box = await el.boundingBox();
      const off = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      const clip = {
        x: Math.max(0, box.x + off.x - 4),
        y: Math.max(0, box.y + off.y - 4),
        width: box.width + 8,
        height: Math.max(240, box.height - 74),
      };
      const file = path.join(outDir, 'aa-intelligence-vs-cost.png');
      await page.screenshot({ path: file, fullPage: true, clip });
      return { path: file, count };
    });
  } catch (e) {
    console.error(`opencode-models: chart screenshot skipped (${e.message})`);
    return null;
  }
}

// Narrow the scatter to just this install's models, so the picture answers
// "which of *mine*" instead of showing 700 strangers. Best effort: the chart
// still screenshots fine if the filter UI has moved.
async function filterChart(page, names) {
  const combo = page.locator(`${CHART_SEL} button`, { hasText: /of \d+ models/ }).first();
  if (!(await combo.count())) return 0;
  const dialog = page.locator('[role="dialog"]').first();

  // Start from an empty selection so the shot shows only this install's models.
  for (let attempt = 0; attempt < 2; attempt++) {
    await combo.click();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);
    const clear = dialog.locator('button', { hasText: /^Clear$/ }).first();
    if (await clear.count()) await clear.click().catch(() => {});
    await page.waitForTimeout(1500);
    if (/^0\s+of/.test(await combo.innerText().catch(() => ''))) break;
  }

  // Selection is a toggle and `aria-selected` stays true even when nothing is
  // selected, so the only reliable protocol is: clear to zero, then click each
  // model exactly once.
  let chosen = 0;
  for (const name of names.slice(0, 40)) {
    try {
      if (!(await dialog.isVisible().catch(() => false))) {
        await combo.click();
        await dialog.waitFor({ state: 'visible', timeout: 8000 });
      }
      await dialog.locator('input').first().fill(name);
      await page.waitForTimeout(700);
      const opts = await dialog.locator('[role="option"]').all();
      let hit = null;
      for (const o of opts) {
        const text = (await o.innerText().catch(() => '')).trim();
        if (text && normKey(text) === normKey(name)) { hit = o; break; }
      }
      if (!hit) continue;
      await hit.click();
      chosen++;
      await page.waitForTimeout(500);
    } catch {
      // a missing option is not fatal; the report still lists the model
    }
  }

  await page.waitForTimeout(1500);
  // The popover overlaps the plot, so dismiss it before the shot lands.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  if (await dialog.isVisible().catch(() => false)) {
    await page.locator(`${CHART_SEL} h3, ${CHART_SEL} h2`).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
  if (await dialog.isVisible().catch(() => false)) {
    await page.mouse.click(30, 400).catch(() => {});
    await page.waitForTimeout(700);
  }

  const label = await combo.innerText().catch(() => '');
  const m = label.match(/(\d+)\s+of/);
  return m ? Number(m[1]) : chosen;
}
