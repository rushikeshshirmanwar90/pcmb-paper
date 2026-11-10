#!/usr/bin/env node
// Structure audit: finds screens that try to do too much at once.
// Usage: node structure-audit.mjs [src-dir] [--all]
// Heuristic, read-only. It ranks .tsx/.jsx files by "cognitive load" signals so a human (or Claude)
// knows which screens to restructure first. Numbers are hints, not verdicts: read the file before deciding.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const root = args.find((a) => !a.startsWith('--')) ?? (fs.existsSync('src') ? 'src' : fs.existsSync('app') ? 'app' : '.');
const SKIP = /node_modules|\.expo|dist|build|ios|android|__tests__|\.test\.|\.stories\./;
const KITLIKE = /(^|\/)(kit|ui|theme|icons?|primitives)(\.|\/)|\/components\/ui\//i;

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|jsx)$/.test(e.name) && !KITLIKE.test(p)) files.push(p);
  }
})(root);

const count = (src, re) => (src.match(re) || []).length;

// Signals and the budget a single mobile screen can comfortably carry (Miller/Hick-informed).
const SIGNALS = [
  { key: 'inputs',   label: 'inputs',     re: /<(TextInput|Field|PasswordField|Input|CodeInput|DateField|TimeField|DropdownSelect|MultiSelect\w*|Picker|Switch|Checkbox)\b/g, budget: 6,  why: 'long forms → split into steps or sections' },
  { key: 'actions',  label: 'actions',    re: /\bon(Press|LongPress)=/g,                                                    budget: 12, why: 'too many choices → Hick: group, hide secondary in a menu' },
  { key: 'sections', label: 'sections',   re: /<(SectionTitle|SectionHeader|SectionList|Section)\b|styles\.section(Title|Header)\b/g, budget: 5, why: 'many sections → tabs, "see all" drill-downs or progressive disclosure' },
  { key: 'overlays', label: 'overlays',   re: /<(Modal|FormSheet|DetailSheet|BottomSheet\w*|ActionSheet|Dialog)\b/g,         budget: 2,  why: 'modals inside modals → move to routes / a stepper' },
  { key: 'state',    label: 'useState',   re: /\buseState\s*[<(]/g,                                                          budget: 12, why: 'one screen juggling many modes → separate screens' },
  { key: 'modes',    label: 'mode flags', re: /\b(step|mode|view|tab|stage|phase|screen)\s*===\s*['"]/g,                      budget: 6,  why: 'hand-rolled modes → real tabs/stepper/routes' },
  { key: 'scrolls',  label: 'scrollers',  re: /<(ScrollView|FlatList|SectionList|FlashList)\b/g,                              budget: 2,  why: 'nested/competing scroll areas → one scroll per screen' },
];

const rows = files.map((f) => {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n').length;
  const s = Object.fromEntries(SIGNALS.map((g) => [g.key, count(src, g.re)]));
  const interactive = s.inputs + s.actions + s.sections + s.overlays;
  if (interactive === 0) return null; // pure renderers (math, charts, icons) aren't screens
  const over = SIGNALS.filter((g) => s[g.key] > g.budget);
  // score: how far over budget, weighted, plus size pressure
  const score = SIGNALS.reduce((acc, g) => acc + Math.max(0, s[g.key] / g.budget - 1), 0) + Math.max(0, lines / 400 - 1);
  return { f: path.relative(process.cwd(), f), lines, ...s, over, score };
}).filter(Boolean).sort((a, b) => b.score - a.score);

const flagged = rows.filter((r) => r.score > 0.5);
const list = showAll ? rows : flagged;

console.log(`Structure audit for ${root}: ${files.length} screen/component files, ${flagged.length} likely overloaded\n`);
console.log('score  lines  inputs actions sections overlays state modes scrolls  file');
for (const r of list) {
  const n = (v, b) => String(v).padStart(b);
  console.log(`${r.score.toFixed(1).padStart(5)} ${n(r.lines, 6)} ${n(r.inputs, 7)} ${n(r.actions, 7)} ${n(r.sections, 8)} ${n(r.overlays, 8)} ${n(r.state, 5)} ${n(r.modes, 5)} ${n(r.scrolls, 7)}  ${r.f}`);
}
if (flagged.length) {
  console.log('\nWhy they are flagged (top 8):');
  for (const r of flagged.slice(0, 8)) {
    console.log(`- ${r.f}`);
    for (const g of r.over) console.log(`    ${g.label} ${r[g.key]} > ${g.budget}: ${g.why}`);
    if (r.lines > 400) console.log(`    ${r.lines} lines: probably several screens' worth of UI in one file`);
  }
}
console.log('\nBudgets are per screen. Read each flagged file and map it (references/restructure-playbook.md) before changing anything.');
