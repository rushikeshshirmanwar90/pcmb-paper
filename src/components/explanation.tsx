import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { MathText } from './math-text';
import { Diagrams } from './diagrams';
import { parseExplanation, type ExplanationBlock } from '@/shared/explanation';
import { hasLatex } from '@/shared/latex';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ExplanationProps {
  text: string;
  defaultCollapsed?: boolean;
  source?: string;
  correctAnswer?: string;
  /** Figures printed inside the worked solution. */
  diagramUrls?: string[];
}

/**
 * Renders hand-authored explanations containing LaTeX equations and formulas.
 * Handles multiline derivations and special "Note:" callout blocks.
 */
function AuthoredExplanationView({
  text,
  palette,
  dark,
}: {
  text: string;
  palette: ReturnType<typeof getPalette>;
  dark: boolean;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // If text only has single line breaks (derivation steps), split by single line breaks
  const lines =
    paragraphs.length === 1 && text.includes('\n')
      ? text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      : paragraphs;

  return (
    <View style={styles.blocksContainer}>
      {lines.map((para, i) => {
        const noteMatch = para.match(/^Note:\s*([\s\S]*)$/i);
        if (noteMatch) {
          return (
            <View
              key={i}
              style={[
                styles.noteCard,
                {
                  backgroundColor: dark ? '#2A2015' : palette.warningSoft,
                  borderLeftColor: palette.warning,
                },
              ]}
            >
              <Text style={[styles.noteTitle, { color: palette.warningInk }]}>NOTE:</Text>
              <MathText text={noteMatch[1]} fontSize={13.5} color={palette.warningInk} />
            </View>
          );
        }

        return (
          <View key={i} style={styles.paraRow}>
            <MathText text={para} fontSize={13.5} color={palette.foreground} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Renders PDF-extracted explanations with step chips and OCR parsed chunks.
 */
function ExtractedExplanationView({
  blocks,
  palette,
  dark,
}: {
  blocks: ExplanationBlock[];
  palette: ReturnType<typeof getPalette>;
  dark: boolean;
}) {
  return (
    <View style={styles.blocksContainer}>
      {blocks.map((block, i) => {
        if (block.kind === 'step') {
          const combinedText = block.chunks.map((c) => c.value).join(' ');
          return (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepBadge, { backgroundColor: dark ? palette.primarySoft : '#F8ECE5' }]}>
                <Text style={[styles.stepBadgeText, { color: palette.primary }]}>
                  {block.label}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <MathText text={combinedText} fontSize={13.5} color={palette.foreground} />
              </View>
            </View>
          );
        }

        const paraText = block.chunks.map((c) => c.value).join(' ');
        return (
          <View key={i} style={styles.paraRow}>
            <MathText text={paraText} fontSize={13.5} color={palette.foreground} />
          </View>
        );
      })}
    </View>
  );
}

export function Explanation({
  text,
  defaultCollapsed = true,
  source,
  correctAnswer,
  diagramUrls,
}: ExplanationProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!text || !text.trim()) return null;

  const rawText = text.trim();
  const isAuthored = hasLatex(rawText);
  const parsed = parseExplanation(rawText);

  const displayAnswer = correctAnswer || parsed.answerLetter;
  const stepBlocks = !isAuthored && parsed.blocks
    ? parsed.blocks.filter((b) => b.kind === 'step')
    : [];

  return (
    <View style={[styles.container, { borderColor: palette.border, backgroundColor: dark ? palette.card : '#FCFBFA' }]}>
      {/* Toggle Bar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Show solution & explanation' : 'Hide solution & explanation'}
        onPress={() => setCollapsed((v) => !v)}
        style={({ pressed }) => [
          styles.toggleBar,
          {
            backgroundColor: dark ? palette.secondary : '#F5F0EB',
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={styles.toggleLeft}>
          <SymbolView
            name={collapsed ? { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            tintColor={palette.mutedForeground}
            size={14}
          />
          <Text style={[styles.toggleTitle, { color: palette.foreground }]}>
            {isAuthored ? 'Solution & Derivation' : 'Solution & Explanation'}
          </Text>
          {collapsed && stepBlocks.length > 0 && (
            <View style={[styles.stepCountPill, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.stepCountText, { color: palette.primaryInk }]}>
                {stepBlocks.length} step{stepBlocks.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.toggleAction, { color: palette.primary }]}>
          {collapsed ? 'Show' : 'Hide'}
        </Text>
      </Pressable>

      {/* Expandable Body */}
      {!collapsed && (
        <View style={[styles.body, { borderTopColor: palette.border }]}>
          {/* Answer Letter Badge */}
          {displayAnswer && (
            <View
              style={[
                styles.answerBadge,
                {
                  backgroundColor: palette.successSoft,
                  borderColor: palette.successBorder,
                },
              ]}
            >
              <View style={[styles.answerCircle, { backgroundColor: palette.success }]}>
                <Text style={styles.answerCircleText}>{displayAnswer}</Text>
              </View>
              <Text style={[styles.answerLabel, { color: palette.successInk }]}>
                Correct Option ({displayAnswer})
              </Text>
            </View>
          )}

          {/* Render authored vs extracted explanation */}
          {isAuthored ? (
            <AuthoredExplanationView text={rawText} palette={palette} dark={dark} />
          ) : (
            <ExtractedExplanationView blocks={parsed.blocks} palette={palette} dark={dark} />
          )}

          <Diagrams urls={diagramUrls} />

          {/* Source Attribution */}
          {source ? (
            <View style={[styles.sourceFooter, { borderTopColor: palette.border }]}>
              <Text style={[styles.sourceText, { color: palette.mutedForeground }]}>
                Source: {source}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepCountPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stepCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    borderTopWidth: 1,
    padding: 12,
  },
  answerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  answerCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerCircleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  blocksContainer: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  paraRow: {
    marginBottom: 4,
  },
  noteCard: {
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 10,
    marginVertical: 4,
    gap: 4,
  },
  noteTitle: {
    fontWeight: '800',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sourceText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default Explanation;
