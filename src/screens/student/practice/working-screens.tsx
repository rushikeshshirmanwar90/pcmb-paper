import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
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

// Full screens for the waits students sit through: making a practice test
// and submitting one. Each has its own picture and a few lines on what is
// happening. Every line is true of what the server does; none promises a time
// or shows a made-up percentage. The lines go through once and stop on the
// last, so nothing repeats as if it were stuck. Reduce Motion: the pictures
// stay still and the lines just change.

const STEP_MS = 1700;

/** The shared layout: a picture, a title, lines that change, hopping dots and a line of facts. */
function WorkingScreen({ art, title, lines, facts }: { art: React.ReactNode; title: string; lines: string[]; facts: string }) {
  const palette = usePalette();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [lines.length]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: palette.background }]} accessibilityViewIsModal>
      {art}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.foreground }]} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.lineSlot} accessibilityLiveRegion="polite">
          <Animated.View key={index} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(200)} style={styles.lineInner}>
            <Text style={[styles.line, { color: palette.foreground }]} numberOfLines={2}>
              {lines[Math.min(index, lines.length - 1)]}
            </Text>
          </Animated.View>
        </View>
        <Dots />
        <Text style={[styles.facts, { color: palette.mutedForeground }]}>{facts}</Text>
      </View>
    </View>
  );
}

/** While Start practice makes the test: question cards being dealt. */
export function PreparingPractice({ topics, questions, minutes, mix }: { topics: number; questions: number; minutes: number; /** "40% easy · 40% medium · 20% hard" */ mix: string }) {
  const t = `${topics} topic${topics === 1 ? '' : 's'}`;
  return (
    <WorkingScreen
      art={<CardDeck />}
      title="Preparing your practice"
      lines={['Picking the best questions for you', `Covering all ${t} you chose`, `Mixing ${mix}`, `Setting your timer: ${minutes} min`, `Getting your ${questions} questions ready`, 'Almost ready…']}
      facts={`${questions} questions · ${t} · about ${minutes} min`}
    />
  );
}

/** While a practice test is submitted and marked: an answer sheet being checked. */
export function SubmittingAnswers({ answered, total }: { answered: number; total: number }) {
  return (
    <WorkingScreen
      art={<AnswerSheet />}
      title="Submitting your test"
      lines={['Sending your answers', 'Checking each answer', 'Adding up your score', 'Finding your strong and weak topics', 'Preparing your result', 'Almost done…']}
      facts={`${answered} of ${total} questions answered`}
    />
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

/**
 * An answer sheet being marked: a tick lands on each row in turn, then the
 * score stamp thumps down on the corner; the sheet clears and it starts again.
 */
function AnswerSheet() {
  const palette = usePalette();
  const reduce = useReducedMotion();
  // 0 → 4: the four rows get their ticks; 4 → 5: the stamp; then a short rest and back to 0.
  const p = useSharedValue(reduce ? 5 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(
      withSequence(
        withDelay(250, withTiming(4, { duration: 1500, easing: Easing.linear })),
        withTiming(5, { duration: 320, easing: Easing.out(Easing.back(2)) }),
        withDelay(700, withTiming(5, { duration: 0 })),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
  }, [p, reduce]);

  const stamp = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value - 4));
    return { opacity: k > 0 ? 1 : 0, transform: [{ scale: 1.6 - k * 0.6 }, { rotate: `${-14 + k * 2}deg` }] };
  });
  // A pen glides down the sheet with the ticks.
  const pen = useAnimatedStyle(() => {
    const row = Math.min(p.value, 4);
    return { opacity: p.value >= 4 ? 0 : 1, transform: [{ translateY: Math.floor(Math.min(row, 3.999)) * ROW_STEP }, { translateX: (row % 1) * 6 }, { rotate: '-28deg' }] };
  });

  return (
    <View style={styles.deck} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.card, styles.sheet, { borderColor: palette.ink, backgroundColor: palette.primarySoft, transform: [{ rotate: '-6deg' }, { translateX: -10 }] }]} />
      <View style={[styles.card, styles.sheet, { borderColor: palette.ink, backgroundColor: palette.card }, hardShadow(Neo.shadow.md, palette.ink)]}>
        <View style={styles.sheetHead}>
          <View style={[styles.bar, { backgroundColor: palette.ink, width: '46%' }]} />
          <View style={[styles.bar, { backgroundColor: palette.ink, width: '24%', opacity: 0.5 }]} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <SheetRow key={i} row={i} p={p} filled={[1, 3, 0, 2][i]} />
        ))}
        <Animated.View style={[styles.pen, pen]}>
          <View style={[styles.penBody, { backgroundColor: palette.primary, borderColor: palette.ink }]} />
          <View style={[styles.penTip, { borderTopColor: palette.ink }]} />
        </Animated.View>
        <Animated.View style={[styles.stamp, { borderColor: palette.ink, backgroundColor: palette.primary }, hardShadow(Neo.shadow.sm, palette.ink), stamp]}>
          <Text style={[styles.stampText, { color: palette.ink }]}>✓</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const ROW_STEP = 34;

/** One question on the sheet: four answer bubbles (one filled) and the tick it gets when marked. */
function SheetRow({ row, p, filled }: { row: number; p: SharedValue<number>; filled: number }) {
  const palette = usePalette();
  const tick = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (p.value - row) * 2));
    return { opacity: k, transform: [{ scale: 0.4 + k * 0.6 }] };
  });
  return (
    <View style={styles.sheetRow}>
      <Text style={[styles.rowNum, { color: palette.ink }]}>{row + 1}</Text>
      {[0, 1, 2, 3].map((b) => (
        <View key={b} style={[styles.bubble, { borderColor: palette.ink, backgroundColor: b === filled ? palette.ink : 'transparent' }]} />
      ))}
      <Animated.View style={[styles.tick, { backgroundColor: palette.primary, borderColor: palette.ink }, tick]}>
        <Text style={[styles.tickText, { color: palette.ink }]}>✓</Text>
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
  sheet: { gap: 10, paddingTop: 16 },
  sheetHead: { gap: 6, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 24 },
  rowNum: { width: 12, fontSize: 12, fontFamily: face.heavy },
  bubble: { width: 16, height: 16, borderRadius: 8, borderWidth: Neo.border.width },
  tick: { marginLeft: 'auto', width: 22, height: 22, borderRadius: 11, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  tickText: { fontSize: 12, lineHeight: 14, fontFamily: face.heavy },
  // Placed so the tip, after the tilt, lands just left of row 1's tick.
  pen: { position: 'absolute', right: 40, top: 10, alignItems: 'center' },
  penBody: { width: 10, height: 44, borderWidth: Neo.border.width, borderRadius: 3 },
  penTip: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  stamp: { position: 'absolute', right: -18, bottom: -18, width: 58, height: 58, borderRadius: 29, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  stampText: { fontSize: 26, lineHeight: 30, fontFamily: face.heavy },
});
