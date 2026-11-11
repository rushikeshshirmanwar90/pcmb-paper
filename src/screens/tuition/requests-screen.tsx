import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Button, Card, EmptyView, ErrorView, Icon, Notice, Segmented, useLoad, usePalette } from '@/components/kit';
import { SkeletonCard, StaleNotice, useToast } from '@/components/states';
import { StackScreen } from '@/components/stack-screen';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { InviteStudentsPicker, InviteTeachersSheet } from '@/screens/tuition/invite-students';
import { RequestCard } from '@/screens/tuition/join-requests';
import { PendingEnrollments } from '@/screens/tuition/pending-enrollments';
import { useJoinRequests } from '@/screens/tuition/tuition-notifications';
import { enrollmentsApi, tuitionApi } from '@/services/tuition-api';

type Side = 'students' | 'teachers';

/** Students waiting to be enrolled (joining code or admin-added), shared by Home, People and this inbox. */
export function usePendingStudents() {
  const version = useDataVersion();
  return useLoad(() => enrollmentsApi.pending(), [version], { cacheKey: 'pending-enrollments' });
}

/**
 * One inbox for everyone waiting to join (it was split: students at the top of
 * People, teachers in the bell's sheet): Students | Teachers with counts, each
 * request accepted or rejected right here, and the joining codes one tap away.
 * Opened from the bell, Home's Needs attention and People's "waiting" rows.
 */
export function RequestsScreen() {
  const user = useSignedInUser();
  const router = useRouter();
  const toast = useToast();
  const { show } = useLocalSearchParams<{ show?: string }>();
  const students = usePendingStudents();
  const teachers = useJoinRequests();
  const studentCount = students.data?.length ?? 0;
  const teacherCount = teachers.data?.length ?? 0;
  // Opens on the side asked for, else the one with someone waiting.
  const [side, setSide] = useState<Side>(() => (show === 'teachers' ? 'teachers' : 'students'));
  const [picked, setPicked] = useState(false);
  if (!picked && show !== 'students' && show !== 'teachers' && students.data && teachers.data && !studentCount && teacherCount && side === 'students') {
    setPicked(true);
    setSide('teachers');
  }
  const [inviting, setInviting] = useState<Side | null>(null);
  const batches = useLoad(() => tuitionApi.batches(), [], { cacheKey: 'batches', enabled: inviting === 'students' });
  const message = (text: string, tone?: 'danger') => toast.show({ message: text, kind: tone === 'danger' ? 'error' : 'success' });

  if (user.role !== 'tuition') {
    return (
      <StackScreen title="Join requests">
        <Notice title="For the tuition account" text="Join requests are handled by your tuition." />
      </StackScreen>
    );
  }
  return (
    <StackScreen
      title="Join requests"
      subtitle={studentCount + teacherCount ? `${studentCount + teacherCount} waiting` : 'No one waiting'}
      onRefresh={() => {
        students.refresh();
        teachers.refresh();
      }}
      refreshing={students.refreshing || teachers.refreshing}
    >
      <Segmented
        label="Students or teachers"
        value={side}
        onChange={setSide}
        options={[
          { value: 'students', label: 'Students', count: studentCount },
          { value: 'teachers', label: 'Teachers', count: teacherCount },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={side === 'students' ? 'Invite students with a joining code' : 'Invite teachers with the teacher code'}
        onPress={() => setInviting(side)}
        style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
      >
        <InviteLine side={side} />
      </Pressable>

      {side === 'students' ? (
        students.loading ? (
          <SkeletonCard rows={3} label="students waiting" />
        ) : students.error && !students.data ? (
          <ErrorView message={students.error} onRetry={students.reload} />
        ) : studentCount ? (
          <>
            {students.error ? <StaleNotice message={students.error} onRetry={students.reload} /> : null}
            <PendingEnrollments onDone={message} />
          </>
        ) : (
          <Card>
            <EmptyView icon={{ ios: 'person.crop.circle.badge.checkmark', android: 'how_to_reg' }} title="No students waiting" text="Students who join with a batch's code show here to approve." />
          </Card>
        )
      ) : teachers.loading ? (
        <SkeletonCard rows={2} label="teachers waiting" />
      ) : teachers.error && !teachers.data ? (
        <ErrorView message={teachers.error} onRetry={teachers.reload} />
      ) : teacherCount ? (
        <>
          {teachers.error ? <StaleNotice message={teachers.error} onRetry={teachers.reload} /> : null}
          {teachers.data!.map((r) => (
            <RequestCard key={r.id} request={r} onDone={teachers.reload} onMessage={message} />
          ))}
        </>
      ) : (
        <Card>
          <EmptyView icon={{ ios: 'person.crop.circle.badge.checkmark', android: 'how_to_reg' }} title="No teachers waiting" text="Teachers who join with your teacher code show here to approve." />
        </Card>
      )}

      <Button label="Done" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
      {inviting === 'students' && batches.data ? <InviteStudentsPicker batches={batches.data} onClose={() => setInviting(null)} /> : null}
      {inviting === 'teachers' ? <InviteTeachersSheet onClose={() => setInviting(null)} /> : null}
    </StackScreen>
  );
}

function InviteLine({ side }: { side: Side }) {
  const palette = usePalette();
  return (
    <View style={[styles.inviteRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Icon name={{ ios: 'qrcode', android: 'qr_code_2' }} color={palette.primary} size={20} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: palette.foreground }]}>{side === 'students' ? 'Invite students' : 'Invite teachers'}</Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{side === 'students' ? "Share a batch's joining code" : 'Share your teacher code'}</Text>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </View>
  );
}

/**
 * "3 waiting to join ›" for People's Students or Teachers: shown only while
 * someone is waiting; opens the inbox on that side.
 */
export function WaitingToJoinRow({ side }: { side: Side }) {
  const palette = usePalette();
  const router = useRouter();
  const students = usePendingStudents();
  const teachers = useJoinRequests();
  const count = side === 'students' ? students.data?.length ?? 0 : teachers.data?.length ?? 0;
  if (!count) return null;
  const label = `${count} ${count === 1 ? (side === 'students' ? 'student' : 'teacher') : side} waiting to join`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Opens join requests`}
      onPress={() => router.push(`/requests?show=${side}` as Href)}
      style={({ pressed }) => [styles.waiting, { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder }, pressed && styles.pressed]}
    >
      <Icon name={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_add' }} color={palette.warningInk} size={20} />
      <Text style={[styles.title, styles.flex, { color: palette.warningInk }]}>{label}</Text>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.warningInk} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  invite: {},
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minHeight: 56 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 1 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
});
