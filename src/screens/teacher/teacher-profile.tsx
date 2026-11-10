import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountSection } from '@/components/account-section';
import { useRouter, type Href } from 'expo-router';
import { Badge, Card, DetailRow, ListRow, Muted, Screen, SectionTitle, useLoad } from '@/components/kit';
import { StaleNotice } from '@/components/states';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { schoolApi } from '@/services/school-api';
import { formatMinutes, tuitionApi } from '@/services/tuition-api';

/** The teacher's profile: what they teach (subjects, batches, hours), their tuition, account. Papers are on the Papers tab. */
export function TeacherProfileScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const router = useRouter();
  const overview = useLoad(() => schoolApi.teacherOverview(), [version]);
  const tuition = useLoad(() => tuitionApi.profile(), [version]);
  const totals = overview.data?.totals;

  return (
    <Screen title="Profile" subtitle="Your teaching and account" onRefresh={overview.refresh} refreshing={overview.refreshing}>
      {overview.error ? <StaleNotice message={overview.error} onRetry={overview.reload} /> : null}

      <SectionTitle title="Teaching" />
      <Card>
        <DetailRow label="Batches" value={totals ? String(totals.batches) : '–'} />
        <DetailRow label="Classes a week" value={totals ? String(totals.classesThisWeek) : '–'} />
        <DetailRow label="Hours a week" value={totals ? formatMinutes(totals.weeklyMinutes) || '0' : '–'} />
        {totals && !totals.weeklyMinutes ? <Muted>Hours add up from your weekly timetable (Home → Weekly timetable).</Muted> : null}
      </Card>

      <SectionTitle title="Subjects you teach" />
      <View style={styles.badges}>
        {user.subjects.length ? user.subjects.map((s) => <Badge key={s} label={s} tone="violet" />) : <Muted>None yet. Your tuition sets them.</Muted>}
      </View>

      <SectionTitle title="Your batches" />
      {overview.data?.batches.length ? (
        <Card style={styles.listCard}>
          {overview.data.batches.map((b, i, list) => (
            <ListRow key={b.id} title={b.name} subtitle={`${b.mySubjects.join(', ')} · ${b.studentCount} students`} onPress={() => router.push(`/teach/${b.id}` as Href)} last={i === list.length - 1} />
          ))}
        </Card>
      ) : (
        <Muted>No batches yet.</Muted>
      )}

      <SectionTitle title="Tuition" />
      <Card>
        <DetailRow label="Name" value={tuition.data?.name ?? user.tuition.name} />
        {tuition.data?.address ? <DetailRow label="Address" value={tuition.data.address} /> : null}
        {tuition.data?.phone ? <DetailRow label="Phone" value={tuition.data.phone} /> : null}
        {tuition.data?.email ? <DetailRow label="Email" value={tuition.data.email} /> : null}
      </Card>

      <AccountSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
