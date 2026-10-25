import React from 'react';
import { AccountSection } from '@/components/account-section';
import { Card, DetailRow, Screen, SectionTitle, useLoad } from '@/components/kit';
import { TRACK_LABELS } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { studentApi } from '@/services/student-api';
import { tuitionApi } from '@/services/tuition-api';

/** The student's profile: what they study and where, and their account (edit basic details here). */
export function StudentProfileScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const overview = useLoad(() => studentApi.overview(), [version]);
  const tuition = useLoad(() => tuitionApi.profile(), [version]);

  return (
    <Screen title="Profile" subtitle="Your studies and account">
      <AccountSection />

      <SectionTitle title="Studies" />
      <Card>
        <DetailRow label="Preparing for" value={user.track ? TRACK_LABELS[user.track] : 'Not set'} />
        <DetailRow label="Class" value={user.standard ?? 'Not set'} />
        <DetailRow label="Batch" value={overview.data?.batch?.name ?? 'No batch yet'} />
        <DetailRow label="Subjects" value={(overview.data?.subjects ?? []).join(', ') || '–'} />
      </Card>

      <SectionTitle title="Tuition" />
      <Card>
        <DetailRow label="Name" value={tuition.data?.name ?? user.tuition.name} />
        {tuition.data?.address ? <DetailRow label="Address" value={tuition.data.address} /> : null}
        {tuition.data?.phone ? <DetailRow label="Phone" value={tuition.data.phone} /> : null}
        {tuition.data?.email ? <DetailRow label="Email" value={tuition.data.email} /> : null}
      </Card>
    </Screen>
  );
}
