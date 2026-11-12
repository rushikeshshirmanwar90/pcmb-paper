import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/app-text';
import { usePalette } from '@/components/kit';
import { hardShadow, Neo } from '@/design/tokens';
import { face } from '@/design/type';

// What students see while their practice is being made (it can take a few
// seconds): a stack of question cards being dealt, and a few lines on what is
// happening. Each line is true of what the server does; none promises a time
// or shows a made-up percentage. The lines go through once and stop on the
// last, so nothing repeats as if it were stuck. Reduce Motion: the cards stay
// still and the lines just change.

const STEP_MS = 1700;

function linesFor(topics: number, questions: number, minutes: number) {
  return [
    'Picking the best questions for you',
    `Covering all ${topics} topic${topics === 1 ? '' : 's'} you chose`,
    'Mixing easy, medium and hard',
    `Setting your timer: ${minutes} min`,
    `Getting your ${questions} questions ready`,
    'Almost ready…',
  ];
}

export function PreparingPractice({ topics, questions, minutes }: { topics: number; questions: number; minutes: number }) {
  const palette = usePalette();
  const lines = linesFor(topics, questions, minutes);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [lines.length]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: palette.background }]} accessibilityViewIsModal>
      <CardDeck />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.foreground }]} accessibilityRole="header">
          Preparing your practice
        </Text>
        <View style={styles.lineSlot} accessibilityLiveRegion="polite">
          <Animated.View key={index} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(200)} style={styles.lineInner}>
            <Text style={[styles.line, { color: palette.foreground }]} numberOfLines={2}>
              {lines[index]}
            </Text>
          </Animated.View>
        </View>
        <Dots />
        <Text style={[styles.facts, { color: palette.mutedForeground }]}>
          {questions} questions · {topics} topic{topics === 1 ? '' : 's'} · about {minutes} min
        </Text>
      </View>
    </View>
  );
}

/** Three question cards; the front one is dealt off to the side and a new one settles in, over and over. */
function CardDeck() {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const deal = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    deal.value = withRepeat(
      withSequence(
        withDelay(350, withTiming(1, { duration: 480, easing: Easing.in(Easing.cubic) })),
        withTiming(2, { duration: 0 }),
        withTiming(3, { duration: 340, easing: Easing.out(Easing.back(1.6)) }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
  }, [deal, reduce]);

  // 0→1: the front card flies off to the right. 2→3: a fresh one drops into place.
  const front = useAnimatedStyle(() => {
    const v = deal.value;
    if (v <= 1) return { opacity: 1 - v * 0.9, transform: [{ translateX: v * 150 }, { translateY: -v * 24 }, { rotate: `${v * 16}deg` }, { scale: 1 }] };
    const k = Math.min(1, Math.max(0, v - 2));
    return { opacity: k, transform: [{ translateX: 0 }, { translateY: (1 - k) * -18 }, { rotate: '0deg' }, { scale: 0.9 + k * 0.1 }] };
  });
  // The option being picked lights up as each card arrives.
  const picked = useAnimatedStyle(() => ({ opacity: deal.value >= 2 || deal.value === 0 ? 1 : 1 - deal.value }));

  const card = (style: object, children?: React.ReactNode) => (
    <View style={[styles.card, { borderColor: palette.ink, backgroundColor: palette.card }, hardShadow(Neo.shadow.md, palette.ink), style]}>{children}</View>
  );

  return (
    <View style={styles.deck} accessible={false} importantForAccessibility="no-hide-descendants">
      {card({ transform: [{ rotate: '-9deg' }, { translateX: -14 }], backgroundColor: palette.primarySoft })}
      {card({ transform: [{ rotate: '6deg' }, { translateX: 12 }] })}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, front]}>
        {card({}, (
          <>
            <View style={styles.qRow}>
              <View style={[styles.qBadge, { borderColor: palette.ink, backgroundColor: palette.primary }]}>
                <Text style={[styles.qText, { color: palette.ink }]}>Q</Text>
              </View>
              <View style={styles.flex}>
                <View style={[styles.bar, { backgroundColor: palette.ink, width: '92%' }]} />
                <View style={[styles.bar, { backgroundColor: palette.ink, width: '64%', opacity: 0.5 }]} />
              </View>
            </View>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.option, { borderColor: palette.ink }]}>
                {i === 2 ? (
                  <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.primary, borderRadius: Neo.radius.xs }, picked]} />
                ) : null}
                <View style={[styles.optionDot, { borderColor: palette.ink }]} />
                <View style={[styles.bar, styles.optionBar, { backgroundColor: palette.ink, width: `${[58, 44, 66, 38][i]}%` }]} />
              </View>
            ))}
          </>
        ))}
      </Animated.View>
    </View>
  );
}

/** Three dots that hop in turn: it's working. */
function Dots() {
  const palette = usePalette();
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} color={palette.ink} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-7, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 300 })), -1));
  }, [delay, reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const CARD_W = 168;
const CARD_H = 196;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  wrap: { zIndex: 10, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 36 },
  deck: { width: CARD_W + 60, height: CARD_H + 30, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderWidth: Neo.border.width,
    borderRadius: Neo.radius.md,
    padding: 14,
    gap: 9,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  qBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  qText: { fontSize: 13, fontFamily: face.heavy },
  bar: { height: 6, borderRadius: 3 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 26, paddingHorizontal: 8, borderWidth: Neo.border.width, borderRadius: Neo.radius.xs, overflow: 'hidden' },
  optionDot: { width: 10, height: 10, borderRadius: 5, borderWidth: Neo.border.width },
  optionBar: { height: 5, opacity: 0.55 },
  copy: { alignItems: 'center', gap: 14, maxWidth: 340 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: face.heavy, textAlign: 'center' },
  lineSlot: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lineInner: { alignItems: 'center' },
  line: { fontSize: 17, lineHeight: 24, fontFamily: face.semibold, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8, height: 16, alignItems: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  facts: { fontSize: 14, lineHeight: 20, fontFamily: face.medium, textAlign: 'center' },
});
