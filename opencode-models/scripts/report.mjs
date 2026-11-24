#!/usr/bin/env node
// Render collected data as a chat-ready markdown block (table + inline chart).
//
//   node report.mjs [--file path/to/models.json] [--top 12] [--no-image]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const file = args.file
  ? path.resolve(String(args.file))
  : path.join(os.homedir(), '.cache', 'opencode-models', 'latest.json');

if (!fs.existsSync(file)) {
  console.error(`opencode-models: no data at ${file} — run collect.mjs first`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const topN = args.top ? Number(args.top) : 12;
const writing = data.task === 'writing';
const hasArena = data.models.some((m) => m.arena?.score != null);
const hasGo = data.models.some((m) => m.go?.requests5h != null);
const scored = data.models.filter((m) => m.aa?.intel != null || m.arena?.score != null);

const rank = (a, b) => {
  if (writing) {
    const as = a.arena?.score ?? -1;
    const bs = b.arena?.score ?? -1;
    if (as !== bs) return bs - as;
    return (b.aa?.intel ?? -1) - (a.aa?.intel ?? -1);
  }
  const ai = a.aa?.intel ?? -1;
  const bi = b.aa?.intel ?? -1;
  if (ai !== bi) return bi - ai;
  return (b.arena?.score ?? -1) - (a.arena?.score ?? -1);
};
scored.sort(rank);

const fmt = (v) => (v == null ? '—' : String(v));
const best = scored[0];

const lines = [];
lines.push(`### Your OpenCode models — ${data.taskLabel}`);
lines.push('');
if (best) {
  const bits = [`**${best.label}**`];
  if (best.aa?.intel != null) bits.push(`AA intelligence **${best.aa.intel}**`);
  if (best.arena?.score != null) bits.push(`arena #${best.arena.rank} (${best.arena.score})`);
  bits.push(`\`${best.id}\``);
  lines.push(`${writing ? 'Best for this kind of work' : 'Smartest available'}: ${bits.join(' · ')}.`);
  lines.push('');
}

const head = ['#', 'Model', 'Provider', 'AA intelligence'];
if (hasArena) head.push('Arena (chat)');
head.push('$/task');
if (hasGo) head.push('Go: req/5h');
head.push('Min/task');
lines.push(`| ${head.join(' | ')} |`);
lines.push(`|${head.map(() => '---').join('|')}|`);

scored.slice(0, topN).forEach((m, i) => {
  const intel = m.aa?.intel != null ? `${m.aa.intel}${m.aa.approx ? '≈' : ''}` : '—';
  const arena = m.arena ? `#${m.arena.rank} · ${m.arena.score}${m.arena.approx ? '≈' : ''}` : '—';
  const cells = [i + 1, m.label, m.provider, intel];
  if (hasArena) cells.push(arena);
  cells.push(m.aa?.cost != null ? `$${m.aa.cost}` : '—');
  if (hasGo) cells.push(m.go?.requests5h != null ? m.go.requests5h.toLocaleString('en-US') : '—');
  cells.push(fmt(m.aa?.minutes));
  lines.push(`| ${cells.join(' | ')} |`);
});

const approx = data.models.filter((m) => m.aa?.approx || m.arena?.approx);
if (approx.length) {
  lines.push('');
  lines.push(
    `**≈ nearest match, not an exact name match:** ${approx
      .map((m) => `${m.label} → ${m.aa?.approx ? m.aa.name : m.arena.name}`)
      .join(', ')}.`,
  );
}

const missing = data.models.filter((m) => m.aa?.intel == null && m.arena?.score == null);
if (missing.length) {
  lines.push('');
  lines.push(`**Not benchmarked anywhere:** ${missing.map((m) => m.label).join(', ')}.`);
}

if (data.arenaTop?.length) {
  lines.push('');
  lines.push(
    `**Top of the arena chat leaderboard${data.sources?.arenaCategory ? ` (${data.sources.arenaCategory})` : ''}** — available to anyone, not just you:`,
  );
  data.arenaTop.slice(0, 5).forEach((r) => {
    lines.push(`${r.rank}. ${r.name}${r.maker ? ` — ${r.maker.split('·')[0].trim()}` : ''} (${r.score})`);
  });
}

if (data.screenshot && !args.noImage) {
  lines.push('');
  lines.push(`![Artificial Analysis: intelligence vs cost, your models](${data.screenshot})`);
}

lines.push('');
lines.push(
  `_Artificial Analysis intelligence index${hasArena ? ' + arena.ai text arena' : ''}, ${data.generatedAt.slice(0, 10)}. ` +
    `"$/task" is the cost of AA's whole ~100-task index at API list prices, not one chat message._`,
);
if (hasGo) {
  lines.push('');
  lines.push(
    `_Go quota snapshot ${data.quotaSnapshot || ''}: on the OpenCode Go subscription the real constraint is requests per 5 h, not API dollars — ` +
      `a model at 43k req/5h costs you far less in practice than its $/task implies._`,
  );
}
if (!hasArena) {
  lines.push('');
  lines.push('_Arena column missing: arena.ai blocks automation-owned browsers, so those rows must come from the user\'s own browser (see SKILL.md)._');
}

console.log(lines.join('\n'));
