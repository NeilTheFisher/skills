#!/usr/bin/env node
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SEVERITY_RANK = { p0: 0, p1: 1, p2: 2 };
const USAGE = "usage: node merge-findings.mjs <run-dir> [--out <dir>]";

function fail(message) {
  console.error(`merge-findings: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg.startsWith("--out=")) args.out = arg.slice(6);
    else if (!arg.startsWith("-") && !args.input) args.input = arg;
    else fail(`unexpected argument: ${arg}`);
  }
  if (!args.input) fail(USAGE);
  args.out = args.out ?? args.input;
  return args;
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function findFindingFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      found.push(...(await findFindingFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      if (entry.name === "merged.json" || entry.name === "run.json") continue;
      found.push(full);
    }
  }
  return found;
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, "/")
    .trim();
}

function normalizeSeverity(value) {
  const sev = String(value ?? "p2").toLowerCase();
  return SEVERITY_RANK[sev] === undefined ? "p2" : sev;
}

function tokens(value) {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter(Boolean));
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
}

function normalizeEvidence(persona, files) {
  if (!Array.isArray(files)) return [];
  return files.filter(Boolean).map((file) => {
    const str = String(file);
    if (str.includes("/")) return str;
    return `${persona}/screenshots/${str}`;
  });
}

function loadDocument(doc, file) {
  const records = Array.isArray(doc) ? doc : [doc];
  if (!Array.isArray(doc) && typeof doc !== "object") {
    fail(`${file}: expected an object or array`);
  }
  return records;
}

const args = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(args.input);
const outDir = path.resolve(args.out);
if (!(await pathExists(inputDir))) fail(`no such directory: ${inputDir}`);

const files = await findFindingFiles(inputDir);
if (files.length === 0) fail(`no findings JSON found under ${inputDir}`);

const groups = new Map();
const verdicts = new Map();
const personas = new Set();
const limitations = [];

for (const file of files) {
  let doc;
  try {
    doc = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
  }
  for (const record of loadDocument(doc, file)) {
    const persona = record.persona ?? path.basename(path.dirname(file));
    if (!persona) fail(`${file}: missing persona`);
    personas.add(persona);
    verdicts.set(persona, {
      verdict: record.verdict ?? "unknown",
      reachedStep: record.reachedStep ?? null,
      steps: Array.isArray(record.steps) ? record.steps.length : null,
    });
    if (Array.isArray(record.limitations)) {
      limitations.push(...record.limitations.map((text) => `${persona}: ${text}`));
    }
    if (!Array.isArray(record.findings)) {
      if (record.findings === undefined) continue;
      fail(`${file}: findings must be an array`);
    }
    for (const finding of record.findings) {
      const step = finding.step ?? "unknown-step";
      const surface = finding.surface ?? "unknown-surface";
      const symptom = finding.symptom ?? finding.description;
      if (!symptom) fail(`${file}: finding missing symptom`);
      const canonical = `${normalize(surface)}|${normalize(step)}|${normalize(symptom)}`;
      const severity = normalizeSeverity(finding.severity);
      const existing = groups.get(canonical);
      const entry = existing ?? {
        step,
        surface,
        symptom,
        severity,
        aliases: new Set(),
        personas: new Set(),
        evidence: [],
        selectors: new Set(),
        reproTriggers: new Set(),
      };
      if (finding.fingerprint) entry.aliases.add(normalize(finding.fingerprint));
      entry.personas.add(persona);
      entry.evidence.push(...normalizeEvidence(persona, finding.evidence));
      if (finding.selector) entry.selectors.add(String(finding.selector));
      if (finding.trigger) entry.reproTriggers.add(String(finding.trigger));
      if (SEVERITY_RANK[severity] < SEVERITY_RANK[entry.severity]) entry.severity = severity;
      groups.set(canonical, entry);
    }
  }
}

const deduped = [];
for (const entry of groups.values()) {
  const target = deduped.find(
    (kept) =>
      normalize(kept.step) === normalize(entry.step) &&
      normalize(kept.surface) === normalize(entry.surface) &&
      similarity(kept.symptom, entry.symptom) >= 0.6,
  );
  if (!target) {
    deduped.push(entry);
    continue;
  }
  const keepNew = entry.personas.size > target.personas.size;
  if (keepNew) {
    target.symptom = entry.symptom;
    target.step = entry.step;
    target.surface = entry.surface;
  }
  for (const alias of entry.aliases) target.aliases.add(alias);
  for (const persona of entry.personas) target.personas.add(persona);
  target.evidence.push(...entry.evidence);
  for (const selector of entry.selectors) target.selectors.add(selector);
  for (const trigger of entry.reproTriggers) target.reproTriggers.add(trigger);
  if (SEVERITY_RANK[entry.severity] < SEVERITY_RANK[target.severity]) target.severity = entry.severity;
}

const ranked = deduped
  .map((entry) => ({
    fingerprint: `${normalize(entry.surface)}|${normalize(entry.step)}|${normalize(entry.symptom)}`,
    aliases: [...entry.aliases].filter(Boolean).sort(),
    step: entry.step,
    surface: entry.surface,
    symptom: entry.symptom,
    severity: entry.severity,
    personaCount: entry.personas.size,
    weakSignal: entry.personas.size === 1,
    personas: [...entry.personas].sort(),
    selectors: [...entry.selectors],
    triggers: [...entry.reproTriggers],
    evidence: [...new Set(entry.evidence)],
  }))
  .sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.personaCount - a.personaCount ||
      a.symptom.localeCompare(b.symptom),
  );

const possibleDuplicates = [];
for (let i = 0; i < ranked.length; i++) {
  for (let j = i + 1; j < ranked.length; j++) {
    const a = ranked[i];
    const b = ranked[j];
    if (normalize(a.step) !== normalize(b.step) || normalize(a.surface) !== normalize(b.surface)) continue;
    const sharedSelector = a.selectors.some((selector) => b.selectors.includes(selector));
    const similarityScore = similarity(a.symptom, b.symptom);
    if (similarityScore >= 0.34 || sharedSelector) {
      possibleDuplicates.push({
        a: a.fingerprint,
        b: b.fingerprint,
        similarity: Number(similarityScore.toFixed(2)),
        sharedSelector,
      });
    }
  }
}

let run = {};
const runPath = path.join(inputDir, "run.json");if (await pathExists(runPath)) {
  try {
    run = JSON.parse(await readFile(runPath, "utf8"));
  } catch {
    run = {};
  }
}

const merged = {
  generatedAt: new Date().toISOString(),
  run,
  personas: [...personas].sort(),
  verdicts: Object.fromEntries([...verdicts].sort(([a], [b]) => a.localeCompare(b))),
  findings: ranked,
  possibleDuplicates,
};

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderReport() {
  const lines = [];
  lines.push(`# First-user swarm — merged findings`);
  lines.push("");
  if (run.url) lines.push(`URL: ${run.url}`);
  if (run.build) lines.push(`Build: ${run.build}`);
  if (run.mode) lines.push(`Mode: ${run.mode}`);
  lines.push(`Personas: ${merged.personas.length} (${merged.personas.join(", ")})`);
  lines.push("");
  lines.push("## Verdicts");
  lines.push("");
  lines.push("| persona | verdict | reached step |");
  lines.push("|---|---|---|");
  for (const [persona, info] of Object.entries(merged.verdicts)) {
    lines.push(`| ${escapeCell(persona)} | ${escapeCell(info.verdict)} | ${escapeCell(info.reachedStep)} |`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  if (ranked.length === 0) {
    lines.push("No findings reported.");
  } else {
    lines.push("| # | severity | personas | step | symptom | evidence |");
    lines.push("|---|---|---|---|---|---|");
    ranked.forEach((finding, index) => {
      const evidence = finding.evidence.length ? finding.evidence.join("<br>") : "";
      const weak = finding.weakSignal ? " (weak signal)" : "";
      lines.push(
        `| ${index + 1} | ${finding.severity} | ${finding.personaCount}${weak}: ${finding.personas.join(", ")} | ${escapeCell(finding.step)} | ${escapeCell(finding.symptom)} | ${escapeCell(evidence)} |`,
      );
    });
    lines.push("");
    for (const [index, finding] of ranked.entries()) {
      lines.push(`### ${index + 1}. ${finding.symptom}`);
      lines.push("");
      lines.push(`- Severity: ${finding.severity}`);
      lines.push(`- Hit by ${finding.personaCount}/${merged.personas.length}: ${finding.personas.join(", ")}`);
      lines.push(`- Step / surface: ${finding.step} / ${finding.surface}`);
      if (finding.selectors.length) lines.push(`- Selector: ${finding.selectors.join(", ")}`);
      if (finding.triggers.length) lines.push(`- Trigger: ${finding.triggers.join("; ")}`);
      if (finding.evidence.length) {
        lines.push(`- Evidence: ${finding.evidence.map((file) => `[${file}](${file})`).join(", ")}`);
      }
      lines.push("");
    }
  }
  if (possibleDuplicates.length) {
    lines.push("## Possible duplicates (review by hand)");
    lines.push("");
    for (const duplicate of possibleDuplicates) {
      lines.push(
        `- \`${duplicate.a}\` ~ \`${duplicate.b}\` (similarity ${duplicate.similarity}${duplicate.sharedSelector ? ", shared selector" : ""})`,
      );
    }
    lines.push("");
  }
  if (limitations.length) {
    lines.push("## Limitations");
    lines.push("");
    for (const text of [...new Set(limitations)]) lines.push(`- ${text}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "merged.json"), `${JSON.stringify(merged, null, 2)}\n`);
await writeFile(path.join(outDir, "report.md"), renderReport());
console.log(
  `merged ${ranked.length} findings from ${personas.size} personas -> ${path.join(outDir, "report.md")}`,
);
