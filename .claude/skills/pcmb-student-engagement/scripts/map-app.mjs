#!/usr/bin/env node
// Maps the CURRENT state of the PCMB app (Expo) and its backend (Next.js "papers").
// Run it ONLY when the user asks to map, scan or refresh the map (references/discover.md §1);
// otherwise work from the saved docs/app-map.md and discover.md §4.
//
// Usage (from anywhere):
//   node map-app.mjs [--app <pcmb-paper dir>] [--api <papers dir>] [--out <file.md>]
// Defaults: --app = the nearest folder (cwd or its parents) containing src/navigation or src/app;
//           --api = a sibling folder containing src/app/api and src/models (e.g. ../papers).
// Read-only. Prints markdown (or writes it to --out).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const walk = (dir, test, out = []) => {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/node_modules|\.git|\.next|\.expo|dist|build/.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out); else if (test(p)) out.push(p);
  }
  return out;
};
const firstDoc = (src) => {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (m) return m[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ').slice(0, 220);
  const c = src.match(/^(\s*\/\/[^\n]*\n)+/m);
  return c ? c[0].replace(/\/\/\s?/g, '').replace(/\s+/g, ' ').trim().slice(0, 220) : '';
};

function findApp() {
  if (opt('--app')) return path.resolve(opt('--app'));
  let d = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (exists(path.join(d, 'src/navigation')) || (exists(path.join(d, 'app.json')) && exists(path.join(d, 'src/app')))) return d;
    d = path.dirname(d);
  }
  return process.cwd();
}
function findApi(app) {
  if (opt('--api')) return path.resolve(opt('--api'));
  const parent = path.dirname(app);
  for (const name of ['papers', ...fs.readdirSync(parent)]) {
    const d = path.join(parent, name);
    if (exists(path.join(d, 'src/app/api')) && exists(path.join(d, 'src/models'))) return d;
  }
  return null;
}

const APP = findApp();
const API = findApi(APP);
const out = [];
const h = (t) => out.push(`\n## ${t}\n`);
out.push(`# PCMB app map (generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`);
out.push(`App: \`${APP}\`  ·  Backend: \`${API ?? 'NOT FOUND (pass --api <papers dir>)'}\``);

// ---------- App ----------
const pkg = JSON.parse(read(path.join(APP, 'package.json')) || '{}');
const deps = Object.keys(pkg.dependencies ?? {});
h('App stack');
out.push(`- expo ${pkg.dependencies?.expo ?? '?'} · react-native ${pkg.dependencies?.['react-native'] ?? '?'}`);
const interesting = deps.filter((d) => /reanimated|gesture|notifications|haptics|image|svg|sharing|view-shot|secure-store|async-storage|font|lottie|skia|pager/.test(d));
out.push(`- relevant packages: ${interesting.join(', ') || 'none'}`);
out.push(`- missing (install with \`npx expo install\` if a feature needs them): ${['expo-haptics', 'react-native-svg', 'react-native-view-shot'].filter((d) => !deps.includes(d)).join(', ') || 'none'}`);

h('Roles and tabs');
const roleTabs = walk(path.join(APP, 'src'), (p) => /role-tabs\.tsx?$/.test(p))[0];
if (roleTabs) {
  const src = read(roleTabs);
  out.push(`Source: \`${path.relative(APP, roleTabs)}\``);
  for (const m of src.matchAll(/const\s+([A-Z_]+_TABS)[^=]*=\s*\[([\s\S]*?)\n\];/g)) {
    // Each tab is an object literal; spread tabs ({ ...PROFILE_TAB, render }) have no literal label.
    const tabs = m[2].split(/\n\s*\{/).filter((chunk) => /render|<\w+/.test(chunk)).map((chunk) => {
      const label = chunk.match(/label:\s*'([^']+)'/)?.[1] ?? chunk.match(/\.\.\.([A-Z_]+)/)?.[1] ?? '?';
      const comp = chunk.match(/<(\w+)/)?.[1] ?? '?';
      return `${label} (${comp})`;
    });
    out.push(`- **${m[1]}**: ${tabs.join(' · ')}`);
  }
} else out.push('- role-tabs not found: search for where tabs are chosen by role (auth context / tabsFor).');

h('Student screens');
for (const f of walk(path.join(APP, 'src/screens/student'), (p) => /\.(tsx|ts)$/.test(p)).sort()) {
  const src = read(f);
  out.push(`- \`${path.relative(APP, f)}\` (${src.split('\n').length} lines): ${firstDoc(src) || '(no doc comment)'}`);
}
h('Shared screens (rendered for several roles)');
for (const f of walk(path.join(APP, 'src/screens/shared'), (p) => /\.tsx?$/.test(p)).sort()) {
  const rel = path.relative(APP, f);
  const base = path.basename(f).replace(/\.tsx?$/, '');
  const users = walk(path.join(APP, 'src/screens'), (p) => /\.tsx?$/.test(p) && read(p).includes(`shared/${base}`)).map((p) => path.relative(path.join(APP, 'src/screens'), p).split(path.sep)[0]);
  out.push(`- \`${rel}\` used by: ${[...new Set(users)].join(', ') || 'nobody (dead?)'}`);
}

h('Routes (Expo Router, src/app)');
const routes = walk(path.join(APP, 'src/app'), (p) => /\.tsx$/.test(p)).map((p) => path.relative(path.join(APP, 'src/app'), p).replace(/\\/g, '/'));
out.push(routes.map((r) => `\`${r}\``).join(' · '));

h('UI kit exports');
const kit = walk(path.join(APP, 'src/components'), (p) => /kit\.tsx$/.test(p))[0];
if (kit) {
  const names = [...read(kit).matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
  out.push(`\`${path.relative(APP, kit)}\`: ${names.join(', ')}`);
  const design = read(kit).includes('useDesign') ? 'yes (design scopes present)' : 'no (single look)';
  out.push(`- design scope branching in kit: ${design}`);
}

h('Student API client');
for (const f of walk(path.join(APP, 'src/services'), (p) => /student-api\.ts$|api-client\.ts$|school-api\.ts$/.test(p))) {
  const src = read(f);
  const endpoints = [...new Set([...src.matchAll(/['"`](\/api\/[^'"`?$]+)/g)].map((m) => m[1]))].sort();
  out.push(`- \`${path.relative(APP, f)}\`: ${endpoints.length ? endpoints.join(', ') : '(no literal endpoints)'}`);
}

h('Engagement features already in the app (search hits)');
const hits = walk(path.join(APP, 'src'), (p) => /\.tsx?$/.test(p) && /\b(xp|streak|badge|leaderboard|dailyGoal|daily-challenge|duel|squad|revision|mastery)\b/i.test(read(p)));
out.push(hits.length ? hits.map((p) => `\`${path.relative(APP, p)}\``).join(', ') : 'none yet');

// ---------- Backend ----------
if (API) {
  h('Backend API routes (papers)');
  const routeFiles = walk(path.join(API, 'src/app/api'), (p) => /route\.ts$/.test(p)).sort();
  for (const f of routeFiles) {
    const src = read(f);
    const rel = path.relative(path.join(API, 'src/app/api'), path.dirname(f)).replace(/\\/g, '/');
    const methods = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    const roles = [...new Set([...src.matchAll(/requireUser\(req(?:,\s*([^)]+))?\)/g)].map((m) => (m[1] ?? 'any').replace(/["'\s]/g, '')))];
    out.push(`- \`/api/${rel}\` ${methods.join('/')} · roles: ${roles.join(' | ') || 'n/a'}${firstDoc(src) ? ` · ${firstDoc(src).slice(0, 140)}` : ''}`);
  }
  h('Backend models (fields)');
  for (const f of walk(path.join(API, 'src/models'), (p) => /\.ts$/.test(p)).sort()) {
    const src = read(f);
    const iface = src.match(/interface \w+(?:Doc)?\s*(?:extends[^{]+)?\{([\s\S]*?)\n\}/);
    const fields = iface ? [...iface[1].matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]) : [];
    const idx = [...src.matchAll(/\.index\((\{[^}]*\})/g)].map((m) => m[1].replace(/\s+/g, ''));
    out.push(`- **${path.basename(f, '.ts')}**: ${fields.join(', ')}${idx.length ? `  ·  indexes ${idx.join(' ')}` : ''}`);
  }
  h('Backend helpers worth reusing');
  for (const [file, re] of [['src/lib/http.ts', /^export (?:async )?(?:function|const) (\w+)/gm], ['src/lib/auth.ts', /^export (?:async )?function (\w+)/gm], ['src/lib/push.ts', /^export (?:async )?function (\w+)/gm], ['src/lib/topic-stats.ts', /^export (?:async )?(?:function|const) (\w+)/gm], ['src/lib/teaching.ts', /^export (?:async )?function (\w+)/gm], ['src/lib/pyq.ts', /^export (?:async )?(?:function|const) (\w+)/gm], ['src/lib/marking.ts', /^export (?:async )?function (\w+)/gm]]) {
    const src = read(path.join(API, file));
    if (src) out.push(`- \`${file}\`: ${[...src.matchAll(re)].map((m) => m[1]).join(', ')}`);
  }
  const cron = read(path.join(API, 'vercel.json'));
  out.push(`- scheduled jobs (vercel.json crons): ${/crons/.test(cron) ? 'present' : 'none'}`);
  out.push(`- tests: ${walk(path.join(API, 'tests'), (p) => /\.test\.ts$/.test(p)).length} files (\`npm test\`, tsx --test + mongodb-memory-server)`);
  h('Engagement collections already in the backend');
  const bhits = walk(path.join(API, 'src/models'), (p) => /(Xp|Streak|Badge|League|Challenge|Duel|Squad|Revision|DailyActivity|Shoutout)/i.test(path.basename(p)));
  out.push(bhits.length ? bhits.map((p) => `\`${path.basename(p)}\``).join(', ') : 'none yet');
}

const text = out.join('\n') + '\n';
if (opt('--out')) { fs.mkdirSync(path.dirname(path.resolve(opt('--out'))), { recursive: true }); fs.writeFileSync(opt('--out'), text); console.log(`wrote ${opt('--out')}`); }
else process.stdout.write(text);
