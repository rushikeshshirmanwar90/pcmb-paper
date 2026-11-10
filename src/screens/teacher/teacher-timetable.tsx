import React, { useState } from 'react';
import { Button, ErrorView, Notice, useLoad } from '@/components/kit';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { StackScreen } from '@/components/stack-screen';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { ClassFormSheet, WeekTimetable } from '@/screens/shared/timetable';
import { schoolApi, type TimetableEntry } from '@/services/school-api';

/**
 * The teacher's week (moved off Home: it's changed rarely): every class, day by
 * day, a tap to change one, and Add a class. Students of the batch see the
 * classes and get reminders.
 */
export function TeacherTimetableScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.teacherOverview(), [version], { enabled: user.role === 'teacher' });
  const [editing, setEditing] = useState<TimetableEntry | null | 'new'>(null);
  const batches = (data?.batches ?? []).map((b) => ({ id: b.id, name: b.name, mySubjects: b.mySubjects }));

  if (user.role !== 'teacher') {
    return (
      <StackScreen title="Weekly timetable">
        <Notice title="For teachers" text="Your timetable is on Home." />
      </StackScreen>
    );
  }
  return (
    <StackScreen
      title="Weekly timetable"
      subtitle={data ? `${data.week.length} class${data.week.length === 1 ? '' : 'es'} a week` : undefined}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        <Button
          label="Add a class"
          icon={{ ios: 'calendar.badge.plus', android: 'calendar_add_on' }}
          onPress={() => setEditing('new')}
          disabled={!batches.length}
          accessibilityLabel={batches.length ? 'Add a class' : "Add a class. You don't teach any batch yet"}
        />
      }
    >
      {loading ? (
        <SkeletonCard rows={5} label="your timetable" />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          <WeekTimetable
            entries={data.week}
            showTeacher={false}
            onEdit={(e) => setEditing(e)}
            emptyText={batches.length ? 'Add your weekly classes; students of the batch see them and get reminders.' : "You don't teach any batch yet. Your tuition assigns you to batches."}
          />
        </>
      ) : null}
      <ClassFormSheet visible={editing !== null} onClose={() => setEditing(null)} batches={batches} entry={editing === 'new' ? null : editing} />
    </StackScreen>
  );
}
