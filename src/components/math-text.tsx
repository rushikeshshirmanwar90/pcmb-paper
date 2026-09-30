import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import katex from 'katex';
import { hasLatex, splitLatex } from '@/shared/latex';
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
// Native WebView KaTeX renderer (for iOS / Android)
// ────────────────────────────────────────────────────────────────────────────

const KATEX_VERSION = '0.16.11';

function buildKaTeXHTML(
  pieces: ReturnType<typeof splitLatex>,
  textColor: string,
  bgColor: string,
  fontSize: number
): string {
  const jsonPieces = JSON.stringify(pieces);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: ${bgColor};
      color: ${textColor};
      font-size: ${fontSize}px;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      -webkit-text-size-adjust: none;
    }
    body { padding: 0; }
    .plain { white-space: pre-wrap; word-break: break-word; }
    .katex { font-size: 1.05em !important; }
    .katex-display-wrap { margin: 4px 0; overflow-x: auto; overflow-y: hidden; }
    .katex-display-wrap > .katex-display { margin: 0 !important; }
    .katex-display > .katex { text-align: left; }
    .katex-inline-wrap { margin: 0 2px; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script id="math-data" type="application/json">${jsonPieces}</script>
  <script>
    try {
      var raw = document.getElementById('math-data').textContent;
      var pieces = JSON.parse(raw);
      var container = document.getElementById('content');
      pieces.forEach(function(p) {
        if (p.kind === 'text') {
          var span = document.createElement('span');
          span.className = 'plain';
          span.textContent = p.value;
          container.appendChild(span);
        } else {
          var span = document.createElement('span');
          span.className = p.display ? 'katex-display-wrap' : 'katex-inline-wrap';
          try {
            katex.render(p.value, span, {
              displayMode: !!p.display,
              throwOnError: false,
              strict: 'ignore',
              // The MathML copy is only hidden once katex.min.css has loaded;
              // until then it renders visibly and inflates the measured height.
              output: 'html'
            });
          } catch(e) {
            span.textContent = p.value;
          }
          container.appendChild(span);
        }
      });
    } catch(err) {
      document.getElementById('content').textContent = '';
    }

    // The first measurement happens before the stylesheet and math fonts have
    // loaded (and sometimes before the view has its final width), so it is
    // usually far too tall. Re-measure whenever the content actually changes
    // size, so the view settles on the real rendered height.
    var lastHeight = -1;
    function sendHeight() {
      var h = Math.ceil(document.getElementById('content').getBoundingClientRect().height);
      if (h === lastHeight || !window.ReactNativeWebView) return;
      lastHeight = h;
      window.ReactNativeWebView.postMessage(JSON.stringify({ height: h }));
    }
    sendHeight();
    if (window.ResizeObserver) {
      new ResizeObserver(sendHeight).observe(document.getElementById('content'));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sendHeight);
    window.addEventListener('load', function() { setTimeout(sendHeight, 50); });
    window.addEventListener('resize', sendHeight);
  <\/script>
</body>
</html>`;
}

function KaTeXView({
  text,
  fontSize,
  textColor,
  bgColor,
  style,
}: {
  text: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  style?: object;
}) {
  const [height, setHeight] = useState(fontSize * 2 + 4);
  const webViewRef = useRef<WebView>(null);

  const pieces = useMemo(() => splitLatex(text), [text]);
  const html = useMemo(
    () => buildKaTeXHTML(pieces, textColor, bgColor, fontSize),
    [pieces, textColor, bgColor, fontSize]
  );

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.height === 'number' && data.height > 0) {
        setHeight(Math.ceil(data.height) + 2);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <View style={[{ height, minHeight: fontSize * 1.5, overflow: 'hidden' }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ backgroundColor: 'transparent', height, opacity: 0.99 }}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
        javaScriptEnabled
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' } : {})}
      />
    </View>
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

  // Native path:
  if (hasLatex(text)) {
    return <KaTeXView text={text} fontSize={fontSize} textColor={textColor} bgColor={'transparent'} style={style} />;
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
