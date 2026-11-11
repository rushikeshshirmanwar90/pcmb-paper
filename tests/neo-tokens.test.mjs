// The student look's colours and status chips: contrast rules and mappings.
//   node --experimental-strip-types --test tests/neo-tokens.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { contrast, darkFrom, lavender, mix, neoColors, toAppPalette, textStyles, font } from '../src/design/tokens.ts';
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
    assert.notEqual(lavender.canvas.toUpperCase(), '#FFFFFF');
  });
});

describe('darkFrom and mix', () => {
  test('mix at 0 and 1 gives the two ends', () => {
    assert.equal(mix('#A98BFA', '#24222A', 1), '#A98BFA');
    assert.equal(mix('#A98BFA', '#24222A', 0), '#24222A');
  });
  test('dark keeps the accents and turns the ink cream', () => {
    const d = darkFrom(lavender);
    assert.equal(d.primary, lavender.primary);
    assert.equal(d.highlight, lavender.highlight);
    assert.equal(d.onAccent, '#1A1A1A');
    assert.notEqual(d.ink, lavender.ink);
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

describe('type scale', () => {
  test('weight always comes from the family (no fontWeight)', () => {
    for (const [name, style] of Object.entries(textStyles)) {
      assert.equal(style.fontWeight, undefined, name);
      assert.ok(Object.values(font).includes(style.fontFamily), `${name} uses a loaded face`);
    }
  });
  test('the wide display face only at 24px and up', () => {
    for (const [name, style] of Object.entries(textStyles)) {
      if (style.fontFamily === font.display) assert.ok(style.fontSize >= 24, name);
    }
  });
  test('reading text is at least 13px', () => {
    for (const [name, style] of Object.entries(textStyles)) {
      if (name !== 'overline') assert.ok(style.fontSize >= 13, name);
    }
  });
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
