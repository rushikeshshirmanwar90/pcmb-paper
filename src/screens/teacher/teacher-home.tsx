import React, { useEffect, useState } from 'react';
import { Card, ErrorView, LoadingView, Muted, Screen, SectionTitle, StatGrid, StatTile, Button, useLoad } from '@/components/kit';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { syncClassReminders } from '@/services/notifications';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { ClassFormSheet, ClassRow, WeekTimetable } from '@/screens/shared/timetable';
import { schoolApi, type TimetableEntry } from '@/services/school-api';
import { formatMinutes } from '@/services/tuition-api';

/** A teacher's day: today's classes, the weekly timetable and announcements. */
export function TeacherHomeScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.teacherOverview(), [version]);
  // Reminders 15 minutes before each weekly class.
  const week = data?.week;
  useEffect(() => {
    if (week) void syncClassReminders(week);
  }, [week]);
  const [editing, setEditing] = useState<TimetableEntry | null | 'new'>(null);
  const batches = (data?.batches ?? []).map((b) => ({ id: b.id, name: b.name, mySubjects: b.mySubjects }));

  return (
    <Screen title={`Hello, ${user.name.split(' ')[0]}`} subtitle={user.tuition.name} onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          <StatGrid>
            <StatTile label="Batches" value={data.totals.batches} icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} />
            <StatTile label="Students" value={data.totals.students} icon={{ ios: 'person.3.fill', android: 'groups' }} tone="violet" />
            <StatTile label="Hours a week" value={data.totals.weeklyMinutes ? formatMinutes(data.totals.weeklyMinutes) : '0'} icon={{ ios: 'clock', android: 'schedule' }} tone="success" />
          </StatGrid>

          <SectionTitle title="Today's classes" />
          <Card>
            {data.today.length ? data.today.map((e) => <ClassRow key={e.id} entry={e} showTeacher={false} />) : <Muted>No classes today.</Muted>}
          </Card>

          <SectionTitle title="Your timetable" />
          <Button label="Add a class" variant="secondary" icon={{ ios: 'calendar.badge.plus', android: 'calendar_add_on' }} onPress={() => setEditing('new')} disabled={!batches.length} />
          <WeekTimetable
            entries={data.week}
            showTeacher={false}
            onEdit={(e) => setEditing(e)}
            emptyText={batches.length ? 'Add your weekly classes; students of the batch see them and get reminders.' : "You don't teach any batch yet. Your tuition assigns you to batches."}
          />

          <AnnouncementsSection batches={batches} canPost={batches.length > 0} allowAllBatches={false} />

          <ClassFormSheet visible={editing !== null} onClose={() => setEditing(null)} batches={batches} entry={editing === 'new' ? null : editing} />
        </>
      ) : null}
    </Screen>
  );
}
