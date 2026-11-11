import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/app-text';
import { Badge, Button, Card, Icon, Muted, ProgressBar, usePalette } from '@/components/kit';
import { useEngagement } from '@/engagement/engagement-provider';
import type { MeSnapshot } from '@/engagement/engagement-store';
import { goalFill, goalLabel, levelCaption, levelFill, levelLabel, shouldStack, streakLabel } from '@/engagement/progress-format';
import { CountUp } from '@/design/neo-kit';
import { face } from '@/design/type';
import { hardShadow, Neo } from '@/design/tokens';

// The top of student Home: streak · today's goal · level, as the server reports
// them. Hidden when the tuition has engagement switched off. Every number is
// also spoken, so colour and the bars are never the only signal.

export function ProgressHeader() {
  const { enabled, me, status, error, offline, reload } = useEngagement();
  const { width, fontScale } = useWindowDimensions();
  const stack = shouldStack(width, fontScale);

  if (enabled === false) return null;
  if (!me) {
    if (status === 'error') return <HeaderError message={error} offline={offline} onRetry={reload} />;
    return <HeaderSkeleton stack={stack} />;
  }
  return (
    <View style={styles.wrap}>
      {status === 'error' ? <StaleNote offline={offline} onRetry={reload} /> : null}
      <View style={styles.row}>
        <StreakChip streak={me.streak} style={stack ? styles.half : styles.third} />
        <GoalChip today={me.today} style={stack ? styles.half : styles.third} />
        <LevelChip xp={me.xp} style={stack ? styles.full : styles.third} />
      </View>
    </View>
  );
}

function Chip({ label, style, children }: { label: string; style: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: palette.card, borderColor: palette.border }, hardShadow(Neo.shadow.md, palette.ink), style]}>
      {children}
    </View>
  );
}

/** The three tiles share one layout: icon, a big number that counts up once, an optional bar, and a caption that wraps (never cut off). */
function Tile({ icon, children, bar, caption }: { icon: React.ComponentProps<typeof Icon>['name']; children: React.ReactNode; bar?: number; caption: string }) {
  const palette = usePalette();
  return (
    <>
      <View style={styles.valueRow}>
        <Icon name={icon} color={palette.foreground} size={18} />
        {children}
      </View>
      {bar !== undefined ? <ProgressBar value={bar} /> : null}
      <Text style={[styles.caption, { color: palette.mutedForeground }]} numberOfLines={2}>
        {caption}
      </Text>
    </>
  );
}

function StreakChip({ streak, style }: { streak: MeSnapshot['streak']; style: StyleProp<ViewStyle> }) {
  const freezes = streak.freezes > 0 ? ` · ${streak.freezes} freeze${streak.freezes === 1 ? '' : 's'}` : '';
  return (
    <Chip label={streakLabel(streak)} style={style}>
      <Tile icon={{ ios: streak.current > 0 ? 'flame.fill' : 'flame', android: 'local_fire_department' }} caption={`${streak.current > 0 ? 'day streak' : 'No streak yet'}${freezes}`}>
        <CountUp to={streak.current} />
      </Tile>
    </Chip>
  );
}

function GoalChip({ today, style }: { today: MeSnapshot['today']; style: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return (
    <Chip label={goalLabel(today)} style={style}>
      <Tile icon={{ ios: today.goalMet ? 'checkmark.circle.fill' : 'target', android: today.goalMet ? 'check_circle' : 'track_changes' }} bar={goalFill(today) * 100} caption={today.goalMet ? 'Goal done today' : 'XP today'}>
        <View style={styles.fraction}>
          <CountUp to={Math.max(0, today.xp)} />
          <Text style={[styles.of, { color: palette.mutedForeground }]}>/{today.goal}</Text>
        </View>
      </Tile>
    </Chip>
  );
}

function LevelChip({ xp, style }: { xp: MeSnapshot['xp']; style: StyleProp<ViewStyle> }) {
  return (
    <Chip label={levelLabel(xp)} style={style}>
      <Tile icon={{ ios: 'star.fill', android: 'star' }} bar={levelFill(xp) * 100} caption={levelCaption(xp)}>
        <CountUp to={xp.level} prefix="L" />
      </Tile>
    </Chip>
  );
}

function HeaderSkeleton({ stack }: { stack: boolean }) {
  const palette = usePalette();
  const block = [styles.skeleton, { backgroundColor: palette.card, borderColor: palette.secondary }];
  return (
    <View accessible accessibilityLabel="Loading your progress" style={styles.row}>
      <View style={[block, stack ? styles.half : styles.third]} />
      <View style={[block, stack ? styles.half : styles.third]} />
      <View style={[block, stack ? styles.full : styles.third]} />
    </View>
  );
}

function HeaderError({ message, offline, onRetry }: { message: string | null; offline: boolean; onRetry: () => void }) {
  return (
    <Card style={styles.errorCard}>
      <Muted style={styles.flex}>{offline ? "You're offline. Your streak and XP show here when you're back." : message || "Couldn't load your progress."}</Muted>
      <Button label="Try again" variant="secondary" onPress={onRetry} accessibilityLabel="Try loading your progress again" />
    </Card>
  );
}

/** The numbers are the last known ones: say so, with a retry. */
function StaleNote({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const palette = usePalette();
  return (
    <View style={styles.stale}>
      <Badge label={offline ? 'Offline' : 'Not updated'} tone="neutral" />
      <Text style={[styles.caption, styles.flex, { color: palette.mutedForeground }]}>Showing your last numbers</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry loading your progress" onPress={onRetry} hitSlop={8} style={styles.retry}>
        <Text style={[styles.retryText, { color: palette.foreground }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  wrap: { gap: 8 },
  // 12 apart (8 clear of each 4-point shadow), like every card.
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  // Three across; when stacked, streak and goal share a row and level takes the next.
  third: { flexGrow: 1, flexBasis: '28%' },
  half: { flexGrow: 1, flexBasis: '40%' },
  full: { flexBasis: '100%' },
  chip: { borderWidth: Neo.border.width, borderRadius: Neo.radius.lg, paddingHorizontal: 12, paddingVertical: 12, gap: 6, minHeight: 96, justifyContent: 'flex-start', marginRight: Neo.shadow.md, marginBottom: Neo.shadow.md },
  fraction: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, minWidth: 0 },
  of: { fontSize: 14, fontFamily: face.semibold, fontVariant: ['tabular-nums'] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontFamily: face.medium },
  skeleton: { height: 96, borderRadius: Neo.radius.lg, borderWidth: Neo.border.width, marginRight: Neo.shadow.md, marginBottom: Neo.shadow.md },
  errorCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 14, fontFamily: face.bold, textDecorationLine: 'underline' },
});
