import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import katex from 'katex';
import { hasLatex, splitLatex } from '@/shared/latex';
import { NativeLatexText } from '@/components/native-math';
import { parseMathNodes, type MathNode, type MathSegment, type AccentType } from '@/shared/mathText';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPalette } from '@/constants/theme';

// Ensure KaTeX CSS is loaded in Web DOM
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const ID = 'katex-stylesheet-cdn';
  if (!document.getElementById(ID)) {
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(link);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Native segment renderers — used for PDF-extracted text without LaTeX
// delimiters (plain superscripts, accents, fractions from bracket markers).
// ────────────────────────────────────────────────────────────────────────────

const ACCENT_GLYPH: Record<AccentType, string> = {
  vector: '→',
  hat: '^',
  tilde: '~',
  acute: '´',
  grave: '`',
};

function PlainSegments({ segments, color }: { segments: MathSegment[]; color: string }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.accent) {
          return (
            <Text key={i} style={{ color, fontWeight: '600' }}>
              {seg.text}{ACCENT_GLYPH[seg.accent]}
            </Text>
          );
        }
        if (seg.sup) {
          return (
            <Text key={i} style={[nativeStyles.superscript, { color }]}>
              {seg.text}
            </Text>
          );
        }
        return (
          <Text key={i} style={{ color }}>
            {seg.text}
          </Text>
        );
      })}
    </>
  );
}

function MathNodeView({ node, color }: { node: MathNode; color: string }) {
  if (node.kind === 'plain') return <PlainSegments segments={node.segments} color={color} />;

  if (node.kind === 'root') {
    return (
      <View style={nativeStyles.rootWrap}>
        <Text style={[nativeStyles.rootSign, { color }]}>√</Text>
        <View style={[nativeStyles.radicandWrap, { borderColor: color }]}>
          {node.radicand.map((n, i) => (
            <MathNodeView key={i} node={n} color={color} />
          ))}
        </View>
      </View>
    );
  }

  // Fraction
  return (
    <View style={nativeStyles.fracWrap}>
      <View style={nativeStyles.fracNum}>
        {node.num.map((n, i) => (
          <MathNodeView key={i} node={n} color={color} />
        ))}
      </View>
      <View style={[nativeStyles.fracBar, { backgroundColor: color }]} />
      <View style={nativeStyles.fracDen}>
        {node.den.map((n, i) => (
          <MathNodeView key={i} node={n} color={color} />
        ))}
      </View>
    </View>
  );
}

function NativeMathText({ text, color, fontSize }: { text: string; color: string; fontSize: number }) {
  const nodes = useMemo(() => parseMathNodes(text), [text]);
  return (
    <Text style={{ color, fontSize, lineHeight: Math.round(fontSize * 1.45) }}>
      {nodes.map((n, i) => (
        <MathNodeView key={i} node={n} color={color} />
      ))}
    </Text>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Web KaTeX Direct HTML renderer — fast, responsive, zero-iframe overhead
// ────────────────────────────────────────────────────────────────────────────

function WebKaTeXRenderer({
  text,
  fontSize,
  color,
  style,
}: {
  text: string;
  fontSize: number;
  color: string;
  style?: any;
}) {
  const pieces = useMemo(() => splitLatex(text), [text]);

  const htmlContent = useMemo(() => {
    return pieces
      .map((p) => {
        if (p.kind === 'text') {
          // Escape HTML
          const escaped = p.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
          return `<span>${escaped}</span>`;
        }
        try {
          const rendered = katex.renderToString(p.value, {
            displayMode: p.display,
            throwOnError: false,
            strict: 'ignore',
            output: 'htmlAndMathml',
          });
          return p.display
            ? `<div class="katex-display-wrap" style="margin: 6px 0;">${rendered}</div>`
            : `<span class="katex-inline-wrap" style="margin: 0 2px;">${rendered}</span>`;
        } catch {
          return `<span>${p.value}</span>`;
        }
      })
      .join('');
  }, [pieces]);

  // Use dangerouslySetInnerHTML on Web
  return (
    <div
      style={{
        color,
        fontSize: `${fontSize}px`,
        lineHeight: 1.5,
        wordBreak: 'break-word',
        fontFamily: 'inherit',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Public component
// ────────────────────────────────────────────────────────────────────────────

export interface MathTextProps {
  /** The text to render — may contain LaTeX delimiters ($...$, $$...$$, \(...\)) or raw math markup. */
  text: string;
  /** Base font size in px. Default: 14. */
  fontSize?: number;
  /** Override text color (defaults to theme foreground). */
  color?: string;
  /** Style applied to wrapper. */
  style?: any;
}

export function MathText({ text: rawText, fontSize = 14, color, style }: MathTextProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const textColor = color ?? palette.foreground;

  // Text extracted from PDFs often ends in stray blank lines, which render as
  // empty rows between a question and its options.
  const text = (rawText || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return null;

  // Web path: render KaTeX directly into DOM
  if (Platform.OS === 'web') {
    if (hasLatex(text)) {
      return <WebKaTeXRenderer text={text} fontSize={fontSize} color={textColor} style={style} />;
    }
    return (
      <Text style={[{ color: textColor, fontSize, lineHeight: Math.round(fontSize * 1.45) }, style]}>
        <NativeMathText text={text} color={textColor} fontSize={fontSize} />
      </Text>
    );
  }

  // Native path: maths drawn with native views (no web view, see native-math.tsx).
  if (hasLatex(text)) {
    return <NativeLatexText text={text} fontSize={fontSize} color={textColor} style={style} />;
  }

  return (
    <Text style={[{ color: textColor, fontSize, lineHeight: Math.round(fontSize * 1.45) }, style]}>
      <NativeMathText text={text} color={textColor} fontSize={fontSize} />
    </Text>
  );
}

const nativeStyles = StyleSheet.create({
  superscript: {
    fontSize: 10,
    lineHeight: 14,
  },
  rootWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rootSign: {
    fontSize: 16,
    marginRight: 1,
  },
  radicandWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 2,
    paddingTop: 1,
  },
  fracWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  fracNum: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  fracBar: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 1,
  },
  fracDen: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
});

export default MathText;
