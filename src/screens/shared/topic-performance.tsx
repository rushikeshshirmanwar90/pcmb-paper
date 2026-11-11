import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Badge, Card, EmptyView, Muted, ProgressBar, SectionTitle, usePalette } from '@/components/kit';
import { LEVEL_WORDS, groupTopics, notEnoughReason, percentLabel, topicLine, weakEvidence } from '@/screens/shared/result-format';
import type { TopicPerformance, WeakTopic } from '@/services/school-api';

/**
 * Accuracy per topic, grouped by subject, with a bar each. The server rates every topic
 * (strong, average, weak, or "not enough data" when the sample is too small to judge).
 */
export function TopicPerformanceList({ topics, audience }: { topics: TopicPerformance[]; audience: 'batch' | 'student' }) {
  const palette = usePalette();
  if (!topics.length) {
    return (
      <Card>
        <EmptyView icon={{ ios: 'chart.bar', android: 'bar_chart' }} title="No topics yet" text="Topic performance shows once there are answers to look at." />
      </Card>
    );
  }
  return (
    <>
      {groupTopics(topics).map((group) => (
        <View key={group.title} style={styles.group}>
          <Text accessibilityRole="header" style={[styles.subject, { color: palette.mutedForeground }]}>
            {group.title.toUpperCase()}
          </Text>
          <Card>
            {group.topics.map((t) => (
              <View
                key={`${t.chapter}|${t.topic}|${t.label}`}
                accessible
                accessibilityLabel={`${t.label}, ${t.accuracy === null ? 'no answers' : `${percentLabel(t.accuracy)} accuracy`}, ${LEVEL_WORDS[t.level].label}. ${topicLine(t)}`}
                style={styles.topic}
              >
                <View style={styles.top}>
                  <View style={styles.flex}>
                    <Text style={[styles.label, { color: palette.foreground }]} numberOfLines={2}>
                      {t.label}
                    </Text>
                    {t.topic && t.chapter ? (
                      <Text style={[styles.detail, { color: palette.mutedForeground }]} numberOfLines={1}>
                        {t.chapter}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.percent, { color: palette.foreground }]}>{t.accuracy === null ? '–' : percentLabel(t.accuracy)}</Text>
                </View>
                <ProgressBar value={t.accuracy ?? 0} tone={t.level === 'weak' ? 'danger' : t.level === 'strong' ? 'success' : 'primary'} />
                <View style={styles.bottom}>
                  <Text style={[styles.detail, styles.flex, { color: palette.mutedForeground }]}>{topicLine(t)}</Text>
                  <Badge label={LEVEL_WORDS[t.level].label} tone={LEVEL_WORDS[t.level].tone} />
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}
      {topics.some((t) => t.level === 'not-enough') ? <Muted>{notEnoughReason(audience)}</Muted> : null}
    </>
  );
}

/** Topics rated weak, each with the numbers behind it and a plain recommendation. */
export function WeakTopicsSection({ weak, audience }: { weak: WeakTopic[]; audience: 'batch' | 'student' }) {
  const palette = usePalette();
  return (
    <>
      <SectionTitle title="Areas needing improvement" />
      {weak.length ? (
        weak.map((t) => (
          <Card key={`${t.chapter}|${t.topic}`}>
            <View style={styles.top}>
              <Text style={[styles.label, styles.flex, { color: palette.foreground }]}>{t.label}</Text>
              <Badge label="NEEDS WORK" tone="danger" />
            </View>
            {t.topic && t.chapter ? <Text style={[styles.detail, { color: palette.mutedForeground }]}>{t.chapter}</Text> : null}
            <Text style={[styles.evidence, { color: palette.dangerInk }]}>{weakEvidence(t)}</Text>
            <Text style={[styles.recommendation, { color: palette.foreground }]}>
              <Text style={styles.bold}>Recommendation: </Text>
              {t.recommendation}
            </Text>
          </Card>
        ))
      ) : (
        <Muted>No topic is weak on the evidence so far. {notEnoughReason(audience)}</Muted>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  group: { gap: 6 },
  subject: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginTop: 4 },
  topic: { gap: 6, paddingVertical: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 17 },
  percent: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  evidence: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recommendation: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
});
