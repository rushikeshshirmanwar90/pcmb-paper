import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { AccountSettings, ProfileHeader } from '@/components/account-section';
import { Badge, Button, Card, Icon, ListRow, Muted, Notice, SectionTitle, Screen, Segmented, useLoad, usePalette, type IconName } from '@/components/kit';
import { TRACK_LABELS } from '@/constants/school';
import { useAppearance, type AppearancePreference } from '@/context/appearance-context';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { classRemindersOn, classRemindersSupported, setClassReminders } from '@/services/notifications';
import { studentApi } from '@/services/student-api';
import { tuitionApi } from '@/services/tuition-api';

/**
 * The student's profile: who they are, what and where they study, settings
 * for this phone (appearance, class reminders), and their account.
 */
export function StudentProfileScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const version = useDataVersion();
  const overview = useLoad(() => studentApi.overview(), [version]);
  const tuition = useLoad(() => tuitionApi.profile(), [version]);
  const batch = overview.data?.batch ?? null;
  const subjects = overview.data?.subjects ?? [];
  const t = tuition.data;

  return (
    <Screen
      title="Profile"
      subtitle="Your studies, settings and account"
      onRefresh={() => {
        overview.refresh();
        tuition.refresh();
      }}
      refreshing={overview.refreshing || tuition.refreshing}
    >
      <ProfileHeader
        badges={
          <>
            {user.track ? <Badge label={TRACK_LABELS[user.track]} tone="primary" /> : null}
            {user.standard ? <Badge label={user.standard} /> : null}
            {batch ? <Badge label={batch.name} tone="violet" /> : null}
          </>
        }
      />

      <SectionTitle title="Academic details" />
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'target', android: 'flag' }} label="Preparing for" value={user.track ? TRACK_LABELS[user.track] : 'Not set'} />
        <InfoRow icon={{ ios: 'graduationcap', android: 'school' }} label="Class" value={user.standard ?? 'Not set'} />
        <InfoRow
          icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
          label="Batch"
          value={batch ? batch.name : overview.loading ? 'Loading…' : 'No batch yet'}
        />
        <View style={styles.infoRow}>
          <InfoIcon icon={{ ios: 'books.vertical', android: 'library_books' }} />
          <View style={styles.flex}>
            <InfoLabel text="Subjects" />
            {subjects.length ? (
              <View style={styles.badges}>
                {subjects.map((s) => (
                  <Badge key={s} label={s} tone="violet" />
                ))}
              </View>
            ) : (
              <InfoValue text={overview.loading ? 'Loading…' : '–'} />
            )}
          </View>
        </View>
      </Card>
      {!batch && overview.data ? <Muted>Your tuition adds you to a batch; then your classes and tests show up.</Muted> : null}

      <SectionTitle title="Tuition" />
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'building.2', android: 'domain' }} label="Name" value={t?.name ?? user.tuition.name} last={!t?.address && !t?.phone && !t?.email} />
        {t?.address ? <InfoRow icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Address" value={t.address} last={!t.phone && !t.email} /> : null}
        {t?.phone ? (
          <ListRow
            icon={{ ios: 'phone', android: 'call' }}
            title={t.phone}
            subtitle="Call your tuition"
            onPress={() => void Linking.openURL(`tel:${t.phone.replace(/[^\d+]/g, '')}`)}
            accessibilityLabel={`Call your tuition, ${t.phone}`}
            last={!t.email}
          />
        ) : null}
        {t?.email ? (
          <ListRow
            icon={{ ios: 'envelope', android: 'mail' }}
            title={t.email}
            subtitle="Email your tuition"
            onPress={() => void Linking.openURL(`mailto:${t.email}`)}
            accessibilityLabel={`Email your tuition, ${t.email}`}
            last
          />
        ) : null}
      </Card>

      <SectionTitle title="Settings on this phone" />
      <Card style={styles.settings}>
        <AppearanceSetting />
        <View style={[styles.divider, { backgroundColor: palette.border }]} />
        <RemindersSetting />
      </Card>

      <SectionTitle title="Account" />
      <AccountSettings />
    </Screen>
  );
}

const APPEARANCE: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function AppearanceSetting() {
  const palette = usePalette();
  const { preference, setPreference } = useAppearance();
  return (
    <View style={styles.setting}>
      <View style={styles.settingTop}>
        <InfoIcon icon={{ ios: 'circle.lefthalf.filled', android: 'contrast' }} />
        <View style={styles.flex}>
          <Text style={[styles.settingTitle, { color: palette.foreground }]}>Appearance</Text>
          <Text style={[styles.settingHint, { color: palette.mutedForeground }]}>System follows your phone&apos;s light or dark setting.</Text>
        </View>
      </View>
      <Segmented label="Appearance" options={APPEARANCE} value={preference} onChange={setPreference} />
    </View>
  );
}

function RemindersSetting() {
  const palette = usePalette();
  const [supported] = useState(() => classRemindersSupported());
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void classRemindersOn().then((v) => !cancelled && setOn(v));
    return () => {
      cancelled = true;
    };
  }, []);

  const change = async (next: boolean) => {
    setBusy(true);
    setBlocked(false);
    const result = await setClassReminders(next);
    setOn(result);
    // Asked to turn on, but the phone doesn't allow notifications for the app.
    if (next && !result) setBlocked(true);
    setBusy(false);
  };

  return (
    <View style={styles.setting}>
      <View style={styles.settingTop}>
        <InfoIcon icon={{ ios: 'bell', android: 'notifications' }} />
        <View style={styles.flex}>
          <Text style={[styles.settingTitle, { color: palette.foreground }]}>Class reminders</Text>
          <Text style={[styles.settingHint, { color: palette.mutedForeground }]}>
            {supported ? 'A notification 15 minutes before each class in your timetable.' : "Reminders aren't available in this version of the app."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Class reminders"
          accessibilityHint="A notification 15 minutes before each class"
          value={!!on}
          onValueChange={(v) => void change(v)}
          disabled={!supported || on === null || busy}
          trackColor={{ false: palette.borderStrong, true: palette.primary }}
          ios_backgroundColor={palette.borderStrong}
        />
      </View>
      {blocked ? (
        <View style={styles.blocked}>
          <Notice tone="warning" title="Notifications are off for this app" text="Allow notifications in your phone's Settings, then turn reminders on again." />
          <Button label="Open Settings" variant="secondary" icon={{ ios: 'gear', android: 'settings' }} onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ icon, label, value, last = false }: { icon: IconName; label: string; value: string; last?: boolean }) {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <InfoIcon icon={icon} />
      <View style={styles.flex}>
        <InfoLabel text={label} />
        <InfoValue text={value} />
      </View>
    </View>
  );
}

function InfoIcon({ icon }: { icon: IconName }) {
  const palette = usePalette();
  return (
    <View style={[styles.iconTile, { backgroundColor: palette.primarySoft }]}>
      <Icon name={icon} color={palette.primary} size={17} />
    </View>
  );
}

function InfoLabel({ text }: { text: string }) {
  const palette = usePalette();
  return <Text style={[styles.infoLabel, { color: palette.mutedForeground }]}>{text}</Text>;
}

function InfoValue({ text }: { text: string }) {
  const palette = usePalette();
  return <Text style={[styles.infoValue, { color: palette.foreground }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  listCard: { paddingVertical: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  iconTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  settings: { gap: 14, padding: 14 },
  setting: { gap: 12 },
  settingTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 15, fontWeight: '700' },
  settingHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  blocked: { gap: 10 },
});
