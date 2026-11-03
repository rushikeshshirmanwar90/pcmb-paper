import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { confirmAction } from '@/components/account-section';
import { Button, Card, EmptyView, ErrorText, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { StackScreen } from '@/components/stack-screen';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { batchHref } from '@/screens/tuition/batch-nav';
import { tuitionOnly, useBatch } from '@/screens/tuition/batch-screens';
import { setScheduleNotice, useScheduleNotice } from '@/screens/tuition/schedule-notice';
import { DAY_SHORT, label12 } from '@/screens/tuition/timetable-draft';
import { WeeklyTimetable } from '@/screens/tuition/weekly-timetable';
import { schoolApi } from '@/services/school-api';
import { tuitionApi } from '@/services/tuition-api';

/** The batch's weekly timetable. Adding and changing classes happen on their own screens. */
export const ScheduleOverviewScreen = tuitionOnly(function ScheduleOverviewScreen({ batchId }: { batchId: string }) {
  const router = useRouter();
  const palette = usePalette();
  const version = useDataVersion();
  const batchLoad = useBatch(batchId);
  const timetable = useLoad(() => schoolApi.timetable(batchId), [batchId, version]);
  const notice = useScheduleNotice();
  // The message from the form that just closed; it fades after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setScheduleNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const batch = batchLoad.data?.batch;

  // The timetable alone fills this screen; the full batch (slower to load) only adds the older class times.
  const entries = (timetable.data ?? []).filter((e) => e.batch.id === batchId);
  const refreshing = batchLoad.refreshing || timetable.refreshing;

  const clearOlder = () =>
    batch &&
    confirmAction(
      'Clear the older class times?',
      "They have no subject, and students and teachers don't see them. Add the classes with their subjects first if you still need them.",
      'Clear',
      async () => {
        setClearing(true);
        setClearError(null);
        try {
          await tuitionApi.updateBatch(batch.id, { schedule: [] });
          bumpDataVersion();
        } catch (e) {
          setClearError(e instanceof Error ? e.message : "Couldn't clear the older class times.");
        } finally {
          setClearing(false);
        }
      }
    );

  return (
    <StackScreen
      title="Schedule"
      subtitle={batch?.name ?? entries[0]?.batch.name}
      onRefresh={() => {
        batchLoad.refresh();
        timetable.refresh();
      }}
      refreshing={refreshing}
      footer={<Button label="Add Class" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push(batchHref(batchId, 'schedule/new'))} />}
    >
      {notice ? <Notice key={notice} tone="success" title={notice} onDismiss={() => setScheduleNotice(null)} live /> : null}
      {timetable.loading ? (
        <LoadingView label="Loading the timetable…" />
      ) : timetable.error && !timetable.data ? (
        <ErrorView message={`Couldn't load the timetable. ${timetable.error}`} onRetry={timetable.reload} />
      ) : entries.length ? (
        <WeeklyTimetable entries={entries} onPressEntry={(entry) => router.push(batchHref(batchId, `schedule/${entry.id}`))} />
      ) : (
        <Card>
          <EmptyView
            icon={{ ios: 'calendar', android: 'calendar_month' }}
            title="No classes yet"
            text="Tap Add Class to put a subject on one or more days. Monday to Saturday are the usual days; Sunday only if you pick it."
          />
        </Card>
      )}

      {batch?.schedule.length ? (
        <>
          <SectionTitle title="Older class times (no subject)" />
          <Card style={styles.listCard}>
            {batch.schedule.map((s, i) => (
              <View key={`${s.day}-${s.start}`} style={[styles.olderRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
                <Text style={[styles.olderDay, { color: palette.foreground }]}>{DAY_SHORT[s.day]}</Text>
                <Text style={[styles.olderTime, { color: palette.mutedForeground }]}>
                  {label12(s.start)} – {label12(s.end)}
                </Text>
              </View>
            ))}
          </Card>
          <Muted>
            Saved before timetables had subjects, so students and teachers don&apos;t see them. They&apos;re kept as they are. Add the classes with their subjects, then clear these.
          </Muted>
          <ErrorText message={clearError} />
          <Button label="Clear older class times" variant="secondary" onPress={clearOlder} loading={clearing} />
        </>
      ) : null}
    </StackScreen>
  );
});

const styles = StyleSheet.create({
  listCard: { paddingVertical: 4 },
  olderRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  olderDay: { width: 40, fontSize: 14, fontWeight: '700' },
  olderTime: { fontSize: 13, marginTop: 1 },
});
