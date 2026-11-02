// Smart PDF focused tests: the layout rules match the server's copy, saved
// layouts restore, and the sample preview follows each setting.
//   node --experimental-strip-types --test tests/smart-pdf.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  chooseMcqLayout,
  DEFAULT_SMART_SLIDE_SETTINGS,
  normalizeSlideSettings,
  planQuestionSlides,
  SLIDE,
  slideGeometry,
  slidePrefsKey,
} from '../src/shared/smart-slide-layout.ts';

const APP_COPY = new URL('../src/shared/smart-slide-layout.ts', import.meta.url);
const SERVER_COPY = new URL('../../papers/src/lib/smartSlides/layout.ts', import.meta.url);

const SAMPLE = {
  questionText: 'A ball is thrown straight up at 20 m/s. Taking g = 10 m/s², how high does it rise before it stops?',
  optionA: '10 m',
  optionB: '20 m',
  optionC: '30 m',
  optionD: '40 m',
  answerType: 'MCQ',
  diagramUrls: [],
  optionDiagramUrls: { A: [], B: [], C: [], D: [] },
};

describe('shared layout rules', () => {
  test('the app and the server use the same file', { skip: !existsSync(SERVER_COPY) && 'papers is not next to the app' }, () => {
    assert.equal(readFileSync(APP_COPY, 'utf8'), readFileSync(SERVER_COPY, 'utf8'));
  });
});

describe('saved layout', () => {
  test('a saved layout restores exactly', () => {
    const saved = { theme: 'white', questionAreaPct: 45, fontSize: 'small', mcqLayout: 'grid', showInstitute: false };
    assert.deepEqual(normalizeSlideSettings(JSON.parse(JSON.stringify(saved))), saved);
  });

  test('nothing saved, or something broken, gives the default', () => {
    assert.deepEqual(normalizeSlideSettings(null), DEFAULT_SMART_SLIDE_SETTINGS);
    assert.deepEqual(normalizeSlideSettings({ theme: 'neon', fontSize: 3 }), DEFAULT_SMART_SLIDE_SETTINGS);
  });

  test('only the layout is kept: question or title fields are dropped', () => {
    const kept = normalizeSlideSettings({ ...DEFAULT_SMART_SLIDE_SETTINGS, title: 'Old paper', questions: [1, 2] });
    assert.deepEqual(Object.keys(kept).sort(), ['fontSize', 'mcqLayout', 'questionAreaPct', 'showInstitute', 'theme']);
  });

  test('each teacher has their own key, valid for SecureStore', () => {
    const a = slidePrefsKey('64b7f0c2a1b2c3d4e5f60718');
    assert.notEqual(a, slidePrefsKey('64b7f0c2a1b2c3d4e5f60719'));
    assert.match(a, /^[A-Za-z0-9._-]+$/);
  });
});

describe('sample preview', () => {
  test('the question area is 25–50% of the board, the rest blank', () => {
    for (const pct of [25, 30, 40, 50]) {
      const g = slideGeometry({ ...DEFAULT_SMART_SLIDE_SETTINGS, questionAreaPct: pct });
      assert.equal(g.regionHeight, Math.round((SLIDE.height * pct) / 100));
      assert.ok(SLIDE.height - g.regionHeight >= SLIDE.height / 2);
    }
  });

  test('the options layout follows the setting; auto puts short options in one row', () => {
    const g = slideGeometry(DEFAULT_SMART_SLIDE_SETTINGS);
    assert.equal(chooseMcqLayout(SAMPLE, 'auto', g.fontPx, g.contentWidth), 'horizontal');
    for (const layout of ['horizontal', 'grid', 'vertical']) {
      assert.equal(chooseMcqLayout(SAMPLE, layout, g.fontPx, g.contentWidth), layout);
    }
  });

  test('font sizes grow small → large', () => {
    const px = ['small', 'medium', 'large'].map((fontSize) => slideGeometry({ ...DEFAULT_SMART_SLIDE_SETTINGS, fontSize }).fontPx);
    assert.ok(px[0] < px[1] && px[1] < px[2]);
  });

  test('the sample fits one slide with the default layout', () => {
    assert.equal(planQuestionSlides(SAMPLE, DEFAULT_SMART_SLIDE_SETTINGS).parts.length, 1);
  });
});
