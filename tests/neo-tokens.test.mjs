// The student look's colours and status chips: contrast rules and mappings.
//   node --experimental-strip-types --test tests/neo-tokens.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { contrast, darkFrom, sunny, mix, neoColors, toAppPalette, typeScale, FONT_OPTIONS } from '../src/design/tokens.ts';
import { STATUS, statusWord } from '../src/design/status.ts';

const MODES = [
  ['light', neoColors(false)],
  ['dark', neoColors(true)],
];
const AA = 4.5;

describe('contrast (WCAG AA) in light and dark', () => {
  for (const [mode, n] of MODES) {
    test(`${mode}: ink on canvas, surface, subtle and every soft tint`, () => {
      for (const bg of ['canvas', 'surface', 'subtle', 'zebra', 'primarySoft', 'successSoft', 'dangerSoft', 'warningSoft', 'violetSoft', 'infoSoft']) {
        assert.ok(contrast(n.ink, n[bg]) >= AA, `${mode} ink on ${bg}: ${contrast(n.ink, n[bg]).toFixed(2)}`);
      }
    });
    test(`${mode}: secondary text (inkSoft) on canvas, surface and soft tints`, () => {
      for (const bg of ['canvas', 'surface', 'primarySoft', 'successSoft', 'warningSoft', 'infoSoft', 'dangerSoft']) {
        assert.ok(contrast(n.inkSoft, n[bg]) >= AA, `${mode} inkSoft on ${bg}: ${contrast(n.inkSoft, n[bg]).toFixed(2)}`);
      }
    });
    test(`${mode}: dark text on every accent fill`, () => {
      for (const bg of ['primary', 'success', 'danger', 'warning', 'violet', 'info', 'highlight']) {
        assert.ok(contrast(n.onAccent, n[bg]) >= AA, `${mode} onAccent on ${bg}: ${contrast(n.onAccent, n[bg]).toFixed(2)}`);
      }
    });
    test(`${mode}: error text on surfaces`, () => {
      for (const bg of ['canvas', 'surface', 'dangerSoft']) {
        assert.ok(contrast(n.dangerInk, n[bg]) >= AA, `${mode} dangerInk on ${bg}: ${contrast(n.dangerInk, n[bg]).toFixed(2)}`);
      }
    });
    test(`${mode}: ink borders stand out (≥ 3:1) from canvas and surface`, () => {
      assert.ok(contrast(n.ink, n.canvas) >= 3);
      assert.ok(contrast(n.ink, n.surface) >= 3);
    });
  }
  test('the canvas is never pure white', () => {
    assert.notEqual(sunny.canvas.toUpperCase(), '#FFFFFF');
  });
});

describe('darkFrom and mix', () => {
  test('mix at 0 and 1 gives the two ends', () => {
    assert.equal(mix('#A98BFA', '#24222A', 1), '#A98BFA');
    assert.equal(mix('#A98BFA', '#24222A', 0), '#24222A');
  });
  test('primary, location and the tab bar: yellow, yellow, near-black', () => {
    assert.equal(sunny.primary, sunny.highlight);
    assert.equal(sunny.tabBar, sunny.ink);
  });
  test('dark keeps the accents and turns the ink cream', () => {
    const d = darkFrom(sunny);
    assert.equal(d.primary, sunny.primary);
    assert.equal(d.highlight, sunny.highlight);
    assert.equal(d.onAccent, '#1A1A1A');
    assert.notEqual(d.ink, sunny.ink);
  });
});

describe('toAppPalette', () => {
  const classic = {
    primary: '#C6613F', primaryInk: '#71351F', primaryBorder: '#E7C1B1', border: '#E5E0D7', borderStrong: '#CFC8BC', input: '#D8D1C6', line: '#E5E0D7',
    successInk: '#24563F', warningInk: '#7A4D19', dangerInk: '#79332D', successBorder: '#B9D7C5', warningBorder: '#E9D3AC', dangerBorder: '#E6BDB5', violetBorder: '#D5CADF',
    background: '#FAF9F5', card: '#FFFFFF', foreground: '#282622', mutedForeground: '#736F68', white: '#FFFFFF', navy: '#181715',
  };
  for (const [mode, n] of MODES) {
    const p = toAppPalette(classic, n);
    test(`${mode}: every border and line token is ink`, () => {
      for (const k of ['border', 'borderStrong', 'input', 'line', 'primaryBorder', 'successBorder', 'warningBorder', 'dangerBorder', 'violetBorder']) assert.equal(p[k], n.ink, k);
    });
    test(`${mode}: text tokens never use an accent colour`, () => {
      for (const k of ['primaryInk', 'successInk', 'warningInk', 'foreground']) assert.equal(p[k], n.ink, k);
      assert.equal(p.mutedForeground, n.inkSoft);
      assert.equal(p.dangerInk, n.dangerInk);
      assert.equal(p.white, n.onAccent, 'text on primary is dark, not white');
    });
    test(`${mode}: page and cards use the preset`, () => {
      assert.equal(p.background, n.canvas);
      assert.equal(p.card, n.surface);
      assert.equal(p.highlight, n.highlight);
    });
    test(`${mode}: keys the mapping doesn't know keep their classic value`, () => {
      assert.equal(p.navy, classic.navy);
    });
  }
});

describe('type scale (both font options)', () => {
  for (const [name, faces] of Object.entries(FONT_OPTIONS)) {
    const scale = typeScale(faces);
    test(`${name}: one family, weight always from the face name (no fontWeight)`, () => {
      for (const [variant, style] of Object.entries(scale)) {
        assert.equal(style.fontWeight, undefined, variant);
        assert.ok(Object.values(faces).includes(style.fontFamily), `${variant} uses a loaded face`);
      }
    });
    test(`${name}: reading text is at least 13px; numbers are big`, () => {
      for (const [variant, style] of Object.entries(scale)) if (variant !== 'overline') assert.ok(style.fontSize >= 13, variant);
      assert.ok(scale.number.fontSize >= 24 && scale.bigNumber.fontSize >= 36);
    });
    test(`${name}: headings bold, body medium`, () => {
      for (const v of ['display', 'title', 'heading']) assert.equal(scale[v].fontFamily, faces.bold, v);
      assert.equal(scale.body.fontFamily, faces.medium);
    });
  }
});

describe('status chips', () => {
  test('every status has a word, an icon for both platforms and a calm tone', () => {
    for (const [kind, look] of Object.entries(STATUS)) {
      assert.ok(look.word.length > 0, kind);
      assert.ok(look.icon.ios && look.icon.android, kind);
      assert.notEqual(look.tone, 'danger', `${kind} must not use alarm red`);
    }
  });
  test('the colours carry dark text in both modes', () => {
    for (const [, n] of MODES) {
      for (const [kind, look] of Object.entries(STATUS)) assert.ok(contrast(look.tone === 'subtle' || look.tone.endsWith('Soft') ? n.ink : n.onAccent, n[look.tone]) >= AA, kind);
    }
  });
  test('statusWord uses a custom word when given', () => {
    assert.equal(statusWord('due'), 'Due today');
    assert.equal(statusWord('upcoming', ' Fri 4 PM '), 'Fri 4 PM');
    assert.equal(statusWord('done', '  '), 'Done');
  });
});

describe('faceForWeight (the drop-in Text maps weights to the app font)', async () => {
  const { faceForWeight } = await import('../src/design/tokens.ts');
  const f = FONT_OPTIONS.chivo;
  test('numeric and named weights pick the matching face', () => {
    assert.equal(faceForWeight(f, '800'), f.heavy);
    assert.equal(faceForWeight(f, '900'), f.heavy);
    assert.equal(faceForWeight(f, 'bold'), f.bold);
    assert.equal(faceForWeight(f, '700'), f.bold);
    assert.equal(faceForWeight(f, '600'), f.semibold);
    assert.equal(faceForWeight(f, '500'), f.medium);
    assert.equal(faceForWeight(f, '400'), f.regular);
    assert.equal(faceForWeight(f, 'normal', 13), f.regular);
  });
  test('no weight: medium for body-size text, regular for small print', () => {
    assert.equal(faceForWeight(f, undefined, 15), f.medium);
    assert.equal(faceForWeight(f, undefined, 13), f.regular);
  });
});
