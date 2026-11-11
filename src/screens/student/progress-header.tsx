import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/app-text';
import { Badge, Button, Card, Icon, Muted, ProgressBar, usePalette } from '@/components/kit';
import { useEngagement } from '@/engagement/engagement-provider';
import type { MeSnapshot } from '@/engagement/engagement-store';
import { goalFill, goalLabel, goalText, levelCaption, levelFill, levelLabel, shouldStack, streakCaption, streakLabel } from '@/engagement/progress-format';

// The top of student Home: streak · today's goal · level, as the server reports
// them. Hidden when the tuition has engagement switched off. Every number is
// also spoken, so colour and the ring are never the only signal.

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
    <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: palette.card, borderColor: palette.border }, style]}>
      {children}
    </View>
  );
}

function StreakChip({ streak, style }: { streak: MeSnapshot['streak']; style: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  const on = streak.current > 0;
  return (
    <Chip label={streakLabel(streak)} style={style}>
      <View style={styles.valueRow}>
        <Icon name={{ ios: 'flame.fill', android: 'local_fire_department' }} color={on ? palette.warning : palette.mutedForeground} size={20} />
        <Text style={[styles.value, { color: palette.foreground }]}>{streak.current}</Text>
      </View>
      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: palette.mutedForeground }]} numberOfLines={1}>
          {streakCaption(streak)}
        </Text>
        {streak.freezes > 0 ? (
          <View style={styles.freezes}>
            <Icon name={{ ios: 'snowflake', android: 'ac_unit' }} color={palette.primary} size={12} />
            <Text style={[styles.caption, { color: palette.mutedForeground }]}>{streak.freezes}</Text>
          </View>
        ) : null}
      </View>
    </Chip>
  );
}

function GoalChip({ today, style }: { today: MeSnapshot['today']; style: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return (
    <Chip label={goalLabel(today)} style={style}>
      <View style={styles.goalRow}>
        <Ring size={34} stroke={4} fill={goalFill(today)} color={today.goalMet ? palette.success : palette.primary} track={palette.secondary}>
          {today.goalMet ? <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.success} size={14} /> : null}
        </Ring>
        <View style={styles.flex}>
          <Text style={[styles.goalValue, { color: palette.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {goalText(today)}
          </Text>
          <Text style={[styles.caption, { color: palette.mutedForeground }]} numberOfLines={1}>
            {today.goalMet ? 'Goal done' : 'XP today'}
          </Text>
        </View>
      </View>
    </Chip>
  );
}

function LevelChip({ xp, style }: { xp: MeSnapshot['xp']; style: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return (
    <Chip label={levelLabel(xp)} style={style}>
      <View style={styles.valueRow}>
        <Icon name={{ ios: 'star.fill', android: 'star' }} color={palette.violet} size={18} />
        <Text style={[styles.value, { color: palette.foreground }]}>L{xp.level}</Text>
      </View>
      <ProgressBar value={levelFill(xp) * 100} />
      <Text style={[styles.caption, { color: palette.mutedForeground }]} numberOfLines={1}>
        {levelCaption(xp)}
      </Text>
    </Chip>
  );
}

/**
 * A progress ring from plain Views (no SVG needed): two half-windows, each
 * showing a half ring rotated into view. `fill` is 0–1.
 */
function Ring({ size, stroke, fill, color, track, children }: { size: number; stroke: number; fill: number; color: string; track: string; children?: React.ReactNode }) {
  const deg = Math.max(0, Math.min(1, fill)) * 360;
  const half = size / 2;
  const circle = { width: size, height: size, borderRadius: half, borderWidth: stroke } as const;
  // A circle with its top and right borders coloured is a half ring from 315° to 135°; +45° makes it 0°–180°.
  const rightHalf = { ...circle, borderColor: 'transparent', borderTopColor: color, borderRightColor: color } as const;
  const leftHalf = { ...circle, borderColor: 'transparent', borderBottomColor: color, borderLeftColor: color } as const;
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants">
      <View style={[styles.abs, circle, { borderColor: track }]} />
      {deg > 0 ? (
        // Right window (0°–180°): the left half ring swings in clockwise.
        <View style={[styles.abs, { left: half, width: half, height: size, overflow: 'hidden' }]}>
          <View style={[styles.abs, leftHalf, { left: -half, transform: [{ rotate: `${45 + Math.min(deg, 180)}deg` }] }]} />
        </View>
      ) : null}
      {deg > 180 ? (
        // Left window (180°–360°): the right half ring swings in.
        <View style={[styles.abs, { left: 0, width: half, height: size, overflow: 'hidden' }]}>
          <View style={[styles.abs, rightHalf, { left: 0, transform: [{ rotate: `${45 + deg - 180}deg` }] }]} />
        </View>
      ) : null}
      <View style={[styles.abs, styles.ringCenter, { width: size, height: size }]}>{children}</View>
    </View>
  );
}

function HeaderSkeleton({ stack }: { stack: boolean }) {
  const palette = usePalette();
  const block = [styles.skeleton, { backgroundColor: palette.secondary }];
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
        <Text style={[styles.retryText, { color: palette.primary }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  abs: { position: 'absolute', top: 0 },
  wrap: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Three across; when stacked, streak and goal share a row and level takes the next.
  third: { flexGrow: 1, flexBasis: '28%' },
  half: { flexGrow: 1, flexBasis: '40%' },
  full: { flexBasis: '100%' },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 4, minHeight: 72, justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  freezes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: 72, borderRadius: 14 },
  errorCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '700' },
});
