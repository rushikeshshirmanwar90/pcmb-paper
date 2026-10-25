import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountSection } from '@/components/account-section';
import { Badge, Card, DetailRow, ErrorText, ListRow, Muted, Screen, SectionTitle, StatGrid, StatTile, useLoad } from '@/components/kit';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { schoolApi } from '@/services/school-api';
import { formatMinutes, tuitionApi } from '@/services/tuition-api';

/** The teacher's profile: batches, weekly working hours, their tuition, account. */
export function TeacherProfileScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { setQuestionsMode, goToTab } = useTabNavigation();
  const overview = useLoad(() => schoolApi.teacherOverview(), [version]);
  const tuition = useLoad(() => tuitionApi.profile(), [version]);
  const totals = overview.data?.totals;

  return (
    <Screen title="Profile" subtitle="Your teaching and account" onRefresh={overview.refresh} refreshing={overview.refreshing}>
      <StatGrid>
        <StatTile label="Total batches" value={totals?.batches ?? '–'} icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} />
        <StatTile label="Working hours / week" value={totals ? formatMinutes(totals.weeklyMinutes) : '–'} icon={{ ios: 'clock', android: 'schedule' }} tone="success" />
        <StatTile label="Classes / week" value={totals?.classesThisWeek ?? '–'} icon={{ ios: 'calendar', android: 'calendar_month' }} tone="violet" />
      </StatGrid>
      <ErrorText message={overview.error} />
      {totals && !totals.weeklyMinutes ? <Muted>Working hours add up from your weekly timetable on Home.</Muted> : null}

      <SectionTitle title="Subjects you teach" />
      <View style={styles.badges}>
        {user.subjects.length ? user.subjects.map((s) => <Badge key={s} label={s} tone="violet" />) : <Muted>None yet. Your tuition sets them.</Muted>}
      </View>

      <SectionTitle title="Your batches" />
      {overview.data?.batches.length ? (
        <Card style={styles.listCard}>
          {overview.data.batches.map((b, i, list) => (
            <ListRow key={b.id} title={b.name} subtitle={`${b.mySubjects.join(', ')} · ${b.studentCount} students`} last={i === list.length - 1} />
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

      <SectionTitle title="Your PDFs" />
      <Card style={styles.listCard}>
        <ListRow
          icon={{ ios: 'folder.fill', android: 'folder' }}
          title="See your saved PDFs"
          subtitle="Open, share or print the papers you made"
          onPress={() => {
            setQuestionsMode('pdfs');
            goToTab('questions');
          }}
          last
        />
      </Card>

      <AccountSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
