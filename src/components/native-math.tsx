/**
 * Draws text with LaTeX maths using plain native views — no web view.
 *
 * KaTeX turns each formula into MathML (mathTree), and the elements here lay
 * that out with React Native views and text. Earlier every formula was its
 * own web view; low-memory Android phones kill the shared web renderer and
 * every formula went blank, so nothing here may depend on a web view.
 *
 * The paragraph is a wrapping row of words and maths. Lines may break after a
 * space, and inside a formula after a relation (=, →) or binary operator (+).
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { splitLatex } from '@/shared/latex';
import { mathTree, type MNode } from '@/shared/mathml-tree';

// ─── Sizes (as fractions of the font size) ──────────────────────────────────

const LEAF_LINE = 1.25; // line height of maths characters
const WORD_LINE = 1.45; // line height of the words around the maths
const SCRIPT = 0.72; // super/subscripts and limits
const INLINE_FRAC = 0.82; // numerator and denominator of an inline fraction
const MIN_SIZE = 9;
const REL_SPACE = 0.28;
const BIN_SPACE = 0.22;

type Ctx = { fs: number; color: string; display: boolean; script: boolean };

const shrink = (fs: number, k: number) => Math.max(MIN_SIZE, fs * k);
const stroke = (fs: number) => Math.max(1, fs / 13);
const leafLine = (fs: number) => Math.round(fs * LEAF_LINE);

// ─── Operators ──────────────────────────────────────────────────────────────

const REL = new Set(
  Array.from('=<>≤≥≠≈≅≡∼≃∝→←↔⇒⇐⇔⟹⟸⟺⟶⟵⟷⇌↑↓∈∉∋⊂⊃⊆⊇∥⊥≪≫⩽⩾:∴∵≺≻∣'),
);
const BIN = new Set(Array.from('+−-×÷±∓⋅∙∗∪∩⊕⊗·∧∨∖'));
const LARGE = new Set(Array.from('∑∏∫∬∭∮⋃⋂'));
const INVISIBLE = new Set(['⁡', '⁢', '⁣', '⁤', '​']);
const OPENERS = new Set(Array.from('([{⟨⌊⌈'));

const STRETCH_ARROWS = new Set(Array.from('→←↔⟶⟵⟷⇌⇋'));

const isMo = (n: MNode | undefined): n is MNode => !!n && n.tag === 'mo';
const isStretchyFence = (n: MNode) => n.tag === 'mo' && n.attrs.fence === 'true' && n.attrs.stretchy !== 'false';

function opKind(n: MNode): 'rel' | 'bin' | 'sep' | null {
  if (n.attrs.stretchy === 'false' || n.attrs.fence === 'true') return null;
  if (n.attrs.separator === 'true') return 'sep';
  if (REL.has(n.text)) return 'rel';
  if (BIN.has(n.text)) return 'bin';
  if (n.text === '⟹' || n.text === '⟶') return 'rel';
  return null;
}

/** A + or − with nothing to its left (or after another operator) is a sign, not an operation. */
function isUnary(prev: MNode | undefined): boolean {
  if (!prev) return true;
  if (!isMo(prev)) return false;
  return opKind(prev) !== null || OPENERS.has(prev.text);
}

function em(value: string | undefined, fs: number): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith('px') ? n : n * fs;
}

/** Horizontal space around an operator, following TeX: none inside scripts. */
function opMargins(n: MNode, prev: MNode | undefined, ctx: Ctx): { marginLeft: number; marginRight: number } {
  if (n.attrs.lspace !== undefined || n.attrs.rspace !== undefined) {
    return { marginLeft: em(n.attrs.lspace, ctx.fs), marginRight: em(n.attrs.rspace, ctx.fs) };
  }
  const kind = opKind(n);
  if (kind === 'sep') return { marginLeft: 0, marginRight: ctx.fs * 0.17 };
  if (ctx.script || !kind) return { marginLeft: 0, marginRight: 0 };
  if (kind === 'bin' && isUnary(prev)) return { marginLeft: 0, marginRight: 0 };
  const space = ctx.fs * (kind === 'rel' ? REL_SPACE : BIN_SPACE);
  return { marginLeft: space, marginRight: space };
}

/** Where a line may break inside an inline formula: after a relation or a binary operator. */
function breaksAfter(n: MNode, prev: MNode | undefined): boolean {
  if (!isMo(n)) return false;
  const kind = opKind(n);
  if (kind === 'rel' || kind === 'sep') return true;
  return kind === 'bin' && !isUnary(prev);
}

// ─── Drawing helpers ────────────────────────────────────────────────────────

/** A straight line from (x1, y1) to (x2, y2), drawn as a rotated view. */
function Line({ x1, y1, x2, y2, width, color }: { x1: number; y1: number; x2: number; y2: number; width: number; color: string }) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - width / 2,
        width: length,
        height: width,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// Glyphs the phone's font draws too small, swapped for ones it draws well.
const GLYPH_SWAP: Record<string, string> = { '∣': '|', '∥': '‖' };

function Leaf({ text, ctx, italic, bold, style }: { text: string; ctx: Ctx; italic?: boolean; bold?: boolean; style?: object }) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          color: ctx.color,
          fontSize: ctx.fs,
          lineHeight: leafLine(ctx.fs),
          fontStyle: italic ? 'italic' : 'normal',
          fontWeight: bold ? '700' : '400',
        },
        style,
      ]}
    >
      {GLYPH_SWAP[text] ?? text}
    </Text>
  );
}

/** Measures its own height, for signs that grow with what they wrap (√, big brackets). */
function useHeight(initial: number): [number, (e: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(initial);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeight((old) => (Math.abs(old - h) > 1 ? h : old));
  }, []);
  return [height, onLayout];
}

/** Measures a view's width, so an accent can be drawn exactly as wide as what it sits on. */
function useWidth(initial: number): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(initial);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((old) => (Math.abs(old - w) > 1 ? w : old));
  }, []);
  return [width, onLayout];
}

/** A bracket stretched to the height of its row: drawn with borders, or a glyph scaled up. */
function Fence({ glyph, ctx, fixedHeight }: { glyph: string; ctx: Ctx; fixedHeight?: number }) {
  const line = leafLine(ctx.fs);
  const [measured, onLayout] = useHeight(line);
  const height = fixedHeight ?? measured;
  const w = stroke(ctx.fs);
  const box = fixedHeight ? { height: fixedHeight, alignSelf: 'center' as const } : { minHeight: line };

  if (glyph === '.' || glyph === '') return <View style={{ width: ctx.fs * 0.1 }} />;
  if (height <= line * 1.2) {
    return (
      <View style={[box, { justifyContent: 'center' }]} onLayout={fixedHeight ? undefined : onLayout}>
        <Leaf text={glyph} ctx={ctx} />
      </View>
    );
  }

  const edge = { borderColor: ctx.color };
  if (glyph === '[' || glyph === ']' || glyph === '⌊' || glyph === '⌋' || glyph === '⌈' || glyph === '⌉') {
    const left = glyph === '[' || glyph === '⌊' || glyph === '⌈';
    const top = glyph === '[' || glyph === ']' || glyph === '⌈' || glyph === '⌉';
    const bottom = glyph === '[' || glyph === ']' || glyph === '⌊' || glyph === '⌋';
    return (
      <View
        onLayout={fixedHeight ? undefined : onLayout}
        style={[
          box,
          edge,
          {
            width: ctx.fs * 0.3,
            marginHorizontal: ctx.fs * 0.06,
            [left ? 'borderLeftWidth' : 'borderRightWidth']: w,
            borderTopWidth: top ? w : 0,
            borderBottomWidth: bottom ? w : 0,
          },
        ]}
      />
    );
  }
  if (glyph === '|' || glyph === '∣' || glyph === '‖' || glyph === '∥') {
    const double = glyph === '‖' || glyph === '∥';
    return (
      <View
        onLayout={fixedHeight ? undefined : onLayout}
        style={[box, edge, { width: double ? w * 4 : w, marginHorizontal: ctx.fs * 0.1, borderLeftWidth: w, borderRightWidth: double ? w : 0 }]}
      />
    );
  }
  // ( ) { } ⟨ ⟩ — the glyph, stretched to the row's height.
  return (
    <View
      onLayout={fixedHeight ? undefined : onLayout}
      style={[box, { width: ctx.fs * 0.42, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          color: ctx.color,
          fontSize: ctx.fs,
          lineHeight: line,
          transform: [{ scaleY: height / line }],
        }}
      >
        {glyph}
      </Text>
    </View>
  );
}

function Radical({ ctx }: { ctx: Ctx }) {
  const [height, onLayout] = useHeight(leafLine(ctx.fs));
  const width = ctx.fs * 0.6;
  const w = stroke(ctx.fs);
  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', width, minHeight: leafLine(ctx.fs) }}>
      <Line x1={0} y1={height * 0.6} x2={width * 0.22} y2={height * 0.52} width={w} color={ctx.color} />
      <Line x1={width * 0.22} y1={height * 0.52} x2={width * 0.48} y2={height - w} width={w * 1.5} color={ctx.color} />
      <Line x1={width * 0.48} y1={height - w} x2={width} y2={w / 2} width={w} color={ctx.color} />
    </View>
  );
}

/**
 * An accent over (or under) its base: arrow, hat, bar, or a small glyph.
 * Every part has an explicit width; `width` is the measured width to span,
 * or undefined for the accent's own small size.
 */
function Accent({ mark, width, ctx }: { mark: string; width?: number; ctx: Ctx }) {
  const w = stroke(ctx.fs);
  const color = ctx.color;
  if (mark === '⃗' || mark === '→' || mark === '⟶' || mark === '←' || mark === '↔') {
    const W = Math.max(width ?? ctx.fs * 0.6, ctx.fs * 0.4);
    const h = ctx.fs * 0.3;
    const head = ctx.fs * 0.16;
    const pointsLeft = mark === '←' || mark === '↔';
    const pointsRight = mark !== '←';
    return (
      <View style={{ width: W, height: h }}>
        <View style={{ position: 'absolute', left: 0, top: h / 2 - w / 2, width: W, height: w, backgroundColor: color }} />
        {pointsRight ? (
          <>
            <Line x1={W} y1={h / 2} x2={W - head} y2={h / 2 - head * 0.7} width={w} color={color} />
            <Line x1={W} y1={h / 2} x2={W - head} y2={h / 2 + head * 0.7} width={w} color={color} />
          </>
        ) : null}
        {pointsLeft ? (
          <>
            <Line x1={0} y1={h / 2} x2={head} y2={h / 2 - head * 0.7} width={w} color={color} />
            <Line x1={0} y1={h / 2} x2={head} y2={h / 2 + head * 0.7} width={w} color={color} />
          </>
        ) : null}
      </View>
    );
  }
  if (mark === '⇌' || mark === '⇋') {
    const W = Math.max(width ?? ctx.fs * 0.9, ctx.fs * 0.6);
    const h = ctx.fs * 0.42;
    const head = ctx.fs * 0.16;
    const top = h * 0.3;
    const bottom = h * 0.7;
    return (
      <View style={{ width: W, height: h }}>
        <View style={{ position: 'absolute', left: 0, top: top - w / 2, width: W, height: w, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 0, top: bottom - w / 2, width: W, height: w, backgroundColor: color }} />
        <Line x1={W} y1={top} x2={W - head} y2={top - head * 0.7} width={w} color={color} />
        <Line x1={0} y1={bottom} x2={head} y2={bottom + head * 0.7} width={w} color={color} />
      </View>
    );
  }
  if (mark === '^' || mark === 'ˆ' || mark === '̂') {
    const W = ctx.fs * 0.42;
    const h = ctx.fs * 0.2;
    return (
      <View style={{ width: W, height: h + w + ctx.fs * 0.04 }}>
        <Line x1={0} y1={h} x2={W / 2} y2={w / 2} width={w} color={color} />
        <Line x1={W / 2} y1={w / 2} x2={W} y2={h} width={w} color={color} />
      </View>
    );
  }
  if (mark === '‾' || mark === 'ˉ' || mark === '¯' || mark === '_' || mark === '̲' || mark === '―') {
    return <View style={{ width: width ?? ctx.fs * 0.5, height: w, backgroundColor: color, marginVertical: ctx.fs * 0.06 }} />;
  }
  // Dots, tildes and anything else: the character itself, small, tucked against the base.
  const glyph = mark === '~' || mark === '˜' ? '∼' : mark === '˙' ? '·' : mark === '¨' ? '··' : mark;
  return (
    <Text
      allowFontScaling={false}
      style={{ color, fontSize: ctx.fs * 0.8, lineHeight: Math.round(ctx.fs * 0.8 * LEAF_LINE), marginBottom: -ctx.fs * 0.45, fontWeight: '700' }}
    >
      {glyph}
    </Text>
  );
}

// ─── Elements ───────────────────────────────────────────────────────────────

const DOUBLE_STRUCK: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', H: 'ℍ' };

function Token({ node, ctx, prev }: { node: MNode; ctx: Ctx; prev?: MNode }) {
  const text = node.text;
  const variant = node.attrs.mathvariant;
  if (node.tag === 'mo') {
    if (!text || INVISIBLE.has(text)) return null;
    if (node.attrs.minsize && node.attrs.stretchy === 'true') {
      return <Fence glyph={text} ctx={ctx} fixedHeight={em(node.attrs.minsize, ctx.fs) * 0.85} />;
    }
    const large = ctx.display && LARGE.has(text);
    const opCtx = large ? { ...ctx, fs: ctx.fs * 1.4 } : ctx;
    return <Leaf text={text === '-' ? '−' : text} ctx={opCtx} style={opMargins(node, prev, ctx)} />;
  }
  if (node.tag === 'mi') {
    if (variant === 'double-struck') return <Leaf text={Array.from(text, (c) => DOUBLE_STRUCK[c] ?? c).join('')} ctx={ctx} />;
    const italic = (variant === undefined && Array.from(text).length === 1) || variant === 'italic' || variant === 'bold-italic';
    const bold = variant === 'bold' || variant === 'bold-italic';
    return <Leaf text={text} ctx={ctx} italic={italic} bold={bold} />;
  }
  // mn, mtext, ms
  return <Leaf text={text} ctx={ctx} italic={variant === 'italic'} bold={variant === 'bold'} />;
}

function Row({ nodes, ctx }: { nodes: MNode[]; ctx: Ctx }) {
  if (nodes.some(isStretchyFence)) return <FencedRow nodes={nodes} ctx={ctx} />;
  if (nodes.length === 1) return <Node node={nodes[0]} ctx={ctx} />;
  return (
    <View style={styles.row}>
      {nodes.map((n, i) => (
        <Node key={i} node={n} ctx={ctx} prev={nodes[i - 1]} />
      ))}
    </View>
  );
}

function Scripted({ node, ctx }: { node: MNode; ctx: Ctx }) {
  const [base, a, b] = node.children;
  const sctx: Ctx = { ...ctx, fs: shrink(ctx.fs, SCRIPT), script: true };
  const gap = ctx.fs * 0.04;
  const baseView = base ? <Node node={base} ctx={ctx} /> : null;

  if (node.tag === 'msup') {
    // A prime is written as a superscript but sits at full size.
    if (a && a.tag === 'mo' && /^[′″‴]+$/.test(a.text)) {
      return (
        <View style={styles.row}>
          {baseView}
          <Leaf text={a.text} ctx={ctx} />
        </View>
      );
    }
    return (
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        {baseView}
        <View style={{ marginTop: -ctx.fs * 0.2, marginLeft: gap }}>{a ? <Node node={a} ctx={sctx} /> : null}</View>
      </View>
    );
  }
  if (node.tag === 'msub') {
    return (
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        {baseView}
        <View style={{ marginBottom: -ctx.fs * 0.14, marginLeft: gap * 0.5 }}>{a ? <Node node={a} ctx={sctx} /> : null}</View>
      </View>
    );
  }
  // msubsup: children are base, sub, sup.
  return (
    <View style={styles.row}>
      {baseView}
      <View style={{ marginLeft: gap, marginVertical: -ctx.fs * 0.2, justifyContent: 'space-between' }}>
        {b ? <Node node={b} ctx={sctx} /> : <View />}
        {a ? <Node node={a} ctx={sctx} /> : <View />}
      </View>
    </View>
  );
}

function Fraction({ node, ctx }: { node: MNode; ctx: Ctx }) {
  const [num, den] = node.children;
  const fs = ctx.display ? ctx.fs : shrink(ctx.fs, INLINE_FRAC);
  const part: Ctx = { ...ctx, fs, display: false };
  const thickness = node.attrs.linethickness === '0px' || node.attrs.linethickness === '0' ? 0 : stroke(ctx.fs);
  return (
    <View style={{ marginHorizontal: ctx.fs * 0.1, paddingVertical: ctx.fs * 0.04 }}>
      <View style={{ alignItems: 'center', paddingHorizontal: ctx.fs * 0.08 }}>{num ? <Node node={num} ctx={part} /> : null}</View>
      <View style={{ height: thickness, backgroundColor: ctx.color, marginVertical: ctx.fs * 0.06 }} />
      <View style={{ alignItems: 'center', paddingHorizontal: ctx.fs * 0.08 }}>{den ? <Node node={den} ctx={part} /> : null}</View>
    </View>
  );
}

function Root({ node, ctx }: { node: MNode; ctx: Ctx }) {
  const isNth = node.tag === 'mroot';
  const radicand = isNth ? [node.children[0]].filter(Boolean) : node.children;
  const index = isNth ? node.children[1] : undefined;
  return (
    <View style={[styles.row, { alignItems: 'stretch', marginHorizontal: ctx.fs * 0.04 }]}>
      {index ? (
        <View style={{ marginRight: -ctx.fs * 0.3, alignSelf: 'flex-start' }}>
          <Node node={index} ctx={{ ...ctx, fs: shrink(ctx.fs, 0.6), script: true }} />
        </View>
      ) : null}
      <Radical ctx={ctx} />
      <View style={{ borderTopWidth: stroke(ctx.fs), borderColor: ctx.color, paddingTop: ctx.fs * 0.06, paddingHorizontal: ctx.fs * 0.06, justifyContent: 'center' }}>
        <Row nodes={radicand} ctx={ctx} />
      </View>
    </View>
  );
}

function OverUnder({ node, ctx }: { node: MNode; ctx: Ctx }) {
  const [base, x, y] = node.children;
  const over = node.tag === 'mover' ? x : node.tag === 'munderover' ? y : undefined;
  const under = node.tag === 'munder' || node.tag === 'munderover' ? x : undefined;
  const sctx: Ctx = { ...ctx, fs: shrink(ctx.fs, SCRIPT), script: true };
  const italicLetter = base?.tag === 'mi' && !base.attrs.mathvariant && Array.from(base.text).length === 1;

  const overAccent = over && node.attrs.accent === 'true' && over.tag === 'mo' ? over : undefined;
  const underAccent = under && node.attrs.accentunder === 'true' && under.tag === 'mo' ? under : undefined;
  const spansBase = overAccent?.attrs.stretchy === 'true' || underAccent?.attrs.stretchy === 'true';
  // A reaction arrow with conditions over/under it: the arrow is as wide as they are.
  const arrowBase = base?.tag === 'mo' && base.attrs.stretchy === 'true' && STRETCH_ARROWS.has(base.text) ? base : undefined;

  // Widths come from measuring on the device rather than from flex stretching,
  // which left stretched arrows zero-wide on Android.
  const [baseWidth, onBaseLayout] = useWidth(ctx.fs * 0.6);
  const [overWidth, onOverLayout] = useWidth(0);
  const [underWidth, onUnderLayout] = useWidth(0);
  const pad = ctx.fs * 0.2;
  const arrowWidth = Math.max(ctx.fs * 1.8, overWidth, underWidth);
  // Accents on italic letters sit a little to the right, over the slanted letter.
  const slant = italicLetter ? [{ translateX: ctx.fs * 0.1 }] : undefined;

  return (
    <View style={[{ alignItems: 'center' }, arrowBase ? { marginHorizontal: ctx.fs * REL_SPACE } : null]}>
      {overAccent ? (
        <View style={{ marginBottom: -ctx.fs * 0.14, transform: slant }}>
          <Accent mark={overAccent.text} width={overAccent.attrs.stretchy === 'true' ? baseWidth : undefined} ctx={ctx} />
        </View>
      ) : over ? (
        <View onLayout={arrowBase ? onOverLayout : undefined} style={arrowBase ? { paddingHorizontal: pad } : null}>
          <Node node={over} ctx={sctx} />
        </View>
      ) : null}

      {arrowBase ? (
        <View style={{ marginVertical: ctx.fs * 0.06 }}>
          <Accent mark={arrowBase.text} width={arrowWidth} ctx={ctx} />
        </View>
      ) : base ? (
        <View onLayout={spansBase ? onBaseLayout : undefined}>
          <Node node={base} ctx={ctx} />
        </View>
      ) : null}

      {underAccent ? (
        <Accent mark={underAccent.text} width={underAccent.attrs.stretchy === 'true' ? baseWidth : undefined} ctx={ctx} />
      ) : under ? (
        <View onLayout={arrowBase ? onUnderLayout : undefined} style={arrowBase ? { paddingHorizontal: pad } : null}>
          <Node node={under} ctx={sctx} />
        </View>
      ) : null}
    </View>
  );
}

function Table({ node, ctx }: { node: MNode; ctx: Ctx }) {
  const rows = node.children.filter((c) => c.tag === 'mtr');
  const columns = Math.max(0, ...rows.map((r) => r.children.length));
  const rowLines = (node.attrs.rowlines ?? '').split(/\s+/);
  const colLines = (node.attrs.columnlines ?? '').split(/\s+/);
  const aligns = (node.attrs.columnalign ?? '').split(/\s+/);
  const cellCtx: Ctx = { ...ctx, display: false };
  const pad = ctx.fs * 0.35;
  const w = stroke(ctx.fs);

  // Columns line up once every cell has reported its width.
  const [widths, setWidths] = useState<number[]>([]);
  const sizes = useRef<number[][]>(rows.map(() => []));
  const report = (r: number, c: number, width: number) => {
    sizes.current[r][c] = width;
    const all = rows.every((row, ri) => row.children.every((_, ci) => sizes.current[ri][ci] !== undefined));
    if (!all) return;
    const next = Array.from({ length: columns }, (_, ci) => Math.ceil(Math.max(0, ...rows.map((_, ri) => sizes.current[ri][ci] ?? 0))));
    setWidths((old) => (old.length === next.length && old.every((v, i) => v === next[i]) ? old : next));
  };

  return (
    <View style={{ marginHorizontal: ctx.fs * 0.05 }}>
      {rows.map((row, r) => (
        <View
          key={r}
          style={[styles.row, { alignItems: 'stretch' }, rowLines[Math.min(r, rowLines.length - 1)] === 'solid' && r < rows.length - 1 ? { borderBottomWidth: w, borderColor: ctx.color } : null]}
        >
          {row.children.map((cell, c) => {
            const align = aligns[Math.min(c, aligns.length - 1)];
            return (
              <View
                key={c}
                onLayout={(e) => report(r, c, e.nativeEvent.layout.width)}
                style={[
                  {
                    minWidth: widths[c] ?? 0,
                    paddingHorizontal: pad,
                    paddingVertical: ctx.fs * 0.12,
                    justifyContent: 'center',
                    alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
                  },
                  colLines[Math.min(c, colLines.length - 1)] === 'solid' && c < columns - 1 ? { borderRightWidth: w, borderColor: ctx.color } : null,
                ]}
              >
                <Row nodes={cell.children} ctx={cellCtx} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function FencedRow({ nodes, ctx }: { nodes: MNode[]; ctx: Ctx }) {
  return (
    <View style={[styles.row, { alignItems: 'stretch' }]}>
      {nodes.map((n, i) =>
        isStretchyFence(n) ? (
          <Fence key={i} glyph={n.text} ctx={ctx} />
        ) : (
          <View key={i} style={{ justifyContent: 'center' }}>
            <Node node={n} ctx={ctx} prev={nodes[i - 1]} />
          </View>
        ),
      )}
    </View>
  );
}

function Node({ node, ctx, prev }: { node: MNode; ctx: Ctx; prev?: MNode }): React.ReactElement | null {
  switch (node.tag) {
    case 'mi':
    case 'mn':
    case 'mo':
    case 'mtext':
    case 'ms':
      return <Token node={node} ctx={ctx} prev={prev} />;
    case 'mspace': {
      const width = em(node.attrs.width, ctx.fs);
      return width >= 0 ? <View style={{ width }} /> : <View style={{ marginRight: width }} />;
    }
    case 'msup':
    case 'msub':
    case 'msubsup':
      return <Scripted node={node} ctx={ctx} />;
    case 'mfrac':
      return <Fraction node={node} ctx={ctx} />;
    case 'msqrt':
    case 'mroot':
      return <Root node={node} ctx={ctx} />;
    case 'mover':
    case 'munder':
    case 'munderover':
      return <OverUnder node={node} ctx={ctx} />;
    case 'mtable':
      return <Table node={node} ctx={ctx} />;
    case 'menclose':
      return (
        <View style={{ borderWidth: stroke(ctx.fs), borderColor: ctx.color, padding: ctx.fs * 0.15, marginHorizontal: ctx.fs * 0.05 }}>
          <Row nodes={node.children} ctx={ctx} />
        </View>
      );
    case 'mpadded':
      return (
        <View style={{ paddingHorizontal: em(node.attrs.lspace, ctx.fs) }}>
          <Row nodes={node.children} ctx={ctx} />
        </View>
      );
    case 'mphantom':
      return (
        <View style={{ opacity: 0 }}>
          <Row nodes={node.children} ctx={ctx} />
        </View>
      );
    case 'mstyle': {
      const display = node.attrs.displaystyle === 'true' ? true : node.attrs.displaystyle === 'false' ? false : ctx.display;
      return <Row nodes={node.children} ctx={{ ...ctx, display }} />;
    }
    default: {
      // mrow, math, mtd and anything unexpected: lay the children out in a row.
      if (node.children.length === 0) return node.text ? <Leaf text={node.text} ctx={ctx} /> : null;
      return <Row nodes={node.children} ctx={ctx} />;
    }
  }
}

// ─── Paragraph ──────────────────────────────────────────────────────────────

type Atom =
  | { kind: 'word'; text: string; joinNext: boolean }
  | { kind: 'math'; node: MNode; prev?: MNode; display: boolean; joinNext: boolean; spaceAfter: boolean }
  | { kind: 'break'; blank: boolean };

/** The top-level pieces of a formula, so a long one can wrap between them. */
function topLevel(math: MNode): MNode[] {
  let nodes = math.children;
  while (nodes.length === 1 && nodes[0].tag === 'mrow' && !nodes[0].children.some(isStretchyFence)) nodes = nodes[0].children;
  return nodes;
}

function toAtoms(text: string): Atom[] {
  const atoms: Atom[] = [];
  const last = () => atoms[atoms.length - 1];
  // Whitespace after an atom: a line may break there, and maths gets a gap.
  const markSpace = () => {
    const a = last();
    if (a && a.kind === 'math') {
      a.joinNext = false;
      a.spaceAfter = true;
    } else if (a && a.kind === 'word') a.joinNext = false;
  };
  const addWords = (value: string) => {
    value.split(/(\n)/).forEach((segment) => {
      if (segment === '\n') {
        const a = last();
        if (a && a.kind === 'break') a.blank = true;
        else if (a) atoms.push({ kind: 'break', blank: false });
        return;
      }
      for (const token of segment.match(/\S+\s*|\s+/g) ?? []) {
        if (!token.trim()) {
          markSpace();
          continue;
        }
        const spaced = /\s$/.test(token);
        atoms.push({ kind: 'word', text: spaced ? token.replace(/\s+$/, ' ') : token, joinNext: !spaced });
      }
    });
  };

  for (const piece of splitLatex(text)) {
    if (piece.kind === 'text') {
      addWords(piece.value);
      continue;
    }
    const tree = mathTree(piece.value, piece.display);
    if (!tree) {
      addWords(piece.value);
      continue;
    }
    if (piece.display) {
      const a = last();
      if (a && a.kind !== 'break') atoms.push({ kind: 'break', blank: false });
      atoms.push({ kind: 'math', node: tree, display: true, joinNext: false, spaceAfter: false });
      atoms.push({ kind: 'break', blank: false });
      continue;
    }
    const nodes = topLevel(tree);
    if (nodes.some(isStretchyFence)) {
      atoms.push({ kind: 'math', node: tree, display: false, joinNext: true, spaceAfter: false });
      continue;
    }
    nodes.forEach((node, i) => {
      const prev = nodes[i - 1];
      const isLast = i === nodes.length - 1;
      atoms.push({ kind: 'math', node, prev, display: false, joinNext: isLast || !breaksAfter(node, prev), spaceAfter: false });
    });
  }
  // A trailing break would leave an empty line under the text.
  while (atoms.length && last()!.kind === 'break') atoms.pop();
  return atoms;
}

/** Atoms with no break between them, kept together on one line. */
function toGroups(atoms: Atom[]): Atom[][] {
  const groups: Atom[][] = [];
  let current: Atom[] = [];
  for (const atom of atoms) {
    if (atom.kind === 'break') {
      if (current.length) groups.push(current);
      groups.push([atom]);
      current = [];
      continue;
    }
    current.push(atom);
    if (!atom.joinNext) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function AtomView({ atom, ctx }: { atom: Atom; ctx: Ctx }) {
  if (atom.kind === 'word') {
    return (
      <Text allowFontScaling={false} style={{ color: ctx.color, fontSize: ctx.fs, lineHeight: Math.round(ctx.fs * WORD_LINE) }}>
        {atom.text}
      </Text>
    );
  }
  if (atom.kind === 'math') {
    const node = <Node node={atom.node} ctx={atom.display ? { ...ctx, display: true } : ctx} prev={atom.prev} />;
    return atom.spaceAfter ? <View style={{ marginRight: ctx.fs * 0.28 }}>{node}</View> : node;
  }
  return null;
}

export type NativeLatexTextProps = {
  text: string;
  fontSize: number;
  color: string;
  style?: object;
};

/** Text with LaTeX maths, drawn with native views. */
export const NativeLatexText = memo(function NativeLatexText({ text, fontSize, color, style }: NativeLatexTextProps) {
  // Every size here is in points, so follow the phone's text-size setting by hand.
  const { fontScale } = useWindowDimensions();
  const fs = fontSize * Math.min(Math.max(fontScale, 0.85), 1.6);
  const groups = useMemo(() => toGroups(toAtoms(text)), [text]);
  const ctx: Ctx = { fs, color, display: false, script: false };
  // Screen readers get the text without TeX markup.
  const label = useMemo(() => text.replace(/\\[()[\]]|\$+/g, '').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, ''), [text]);

  return (
    <View style={[styles.flow, style]} accessible accessibilityLabel={label}>
      {groups.map((group, i) => {
        const first = group[0];
        if (first.kind === 'break') return <View key={i} style={{ width: '100%', height: first.blank ? fs * 0.5 : 0 }} />;
        if (first.kind === 'math' && first.display) {
          // Centred on its own line; a long one wraps between its top-level pieces.
          const dctx = { ...ctx, display: true };
          const nodes = topLevel(first.node);
          if (nodes.some(isStretchyFence)) {
            return (
              <View key={i} style={styles.display}>
                <Node node={first.node} ctx={dctx} />
              </View>
            );
          }
          return (
            <View key={i} style={styles.display}>
              {nodes.map((n, j) => (
                <Node key={j} node={n} ctx={dctx} prev={nodes[j - 1]} />
              ))}
            </View>
          );
        }
        if (group.length === 1) return <AtomView key={i} atom={first} ctx={ctx} />;
        return (
          <View key={i} style={styles.row}>
            {group.map((atom, j) => (
              <AtomView key={j} atom={atom} ctx={ctx} />
            ))}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  display: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
