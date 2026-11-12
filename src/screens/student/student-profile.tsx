import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/app-text';
import { AccountSettings, ProfileHeader } from '@/components/account-section';
import { Badge, Button, Card, Icon, ListRow, Muted, Notice, SectionTitle, Screen, useLoad, usePalette, type IconName } from '@/components/kit';
import { PROGRAM_LABELS, programOf } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { classRemindersOn, classRemindersSupported, setClassReminders } from '@/services/notifications';
import { studentApi } from '@/services/student-api';
import { tuitionApi } from '@/services/tuition-api';
import { face } from '@/design/type';
import { useVibrationSetting } from '@/design/haptics';
import { PatternBackdrop } from '@/design/illustrations';
import { Neo } from '@/design/tokens';

/**
 * The student's profile: who they are, what and where they study, settings
 * for this phone (appearance, class reminders), and their account.
 */
export function StudentProfileScreen() {
  const user = useSignedInUser();
  const program = programOf(user);
  const palette = usePalette();
  const version = useTabDataVersion('profile');
  const overview = useLoad(() => studentApi.overview(), [version]);
  const tuition = useLoad(() => tuitionApi.profile(), [version]);
  const batch = overview.data?.batch ?? null;
  const subjects = overview.data?.subjects ?? [];
  const t = tuition.data;

  return (
    <Screen
      title="Profile"
      subtitle="You, your settings, help and your account"
      headerArt={<PatternBackdrop />}
      onRefresh={() => {
        overview.refresh();
        tuition.refresh();
      }}
      refreshing={overview.refreshing || tuition.refreshing}
    >
      {/* Program, class and batch are listed just below, so the header stays name and email. */}
      <SectionTitle title="You" />
      <ProfileHeader badges={<></>} />

      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'target', android: 'flag' }} label="Preparing for" value={program ? PROGRAM_LABELS[program] : 'Not set'} />
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

      <SectionTitle title="Settings" />
      <Card style={styles.settings}>
        <VibrationSetting />
        <View style={[styles.divider, { backgroundColor: palette.border }]} />
        <RemindersSetting />
      </Card>

      <SectionTitle title="Help" />
      <Muted>Questions about classes, tests or your batch? Ask your tuition.</Muted>
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

      <SectionTitle title="Account" />
      <AccountSettings />
    </Screen>
  );
}

/** Haptics on the main buttons and chips (on press only). Off silences every one of them. */
function VibrationSetting() {
  const palette = usePalette();
  const [on, setOn] = useVibrationSetting();
  return (
    <View style={styles.setting}>
      <View style={styles.settingTop}>
        <InfoIcon icon={{ ios: 'iphone.radiowaves.left.and.right', android: 'vibration' }} />
        <View style={styles.flex}>
          <Text style={[styles.settingTitle, { color: palette.foreground }]}>Vibration</Text>
          <Text style={[styles.settingHint, { color: palette.mutedForeground }]}>A small tap when you press main buttons and choose answers.</Text>
        </View>
        <Switch
          accessibilityLabel="Vibration"
          value={on}
          onValueChange={setOn}
          trackColor={{ false: palette.borderStrong, true: palette.primary }}
          thumbColor={palette.card}
          ios_backgroundColor={palette.secondary}
        />
      </View>
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
          thumbColor={palette.card}
          ios_backgroundColor={palette.secondary}
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
      style={[styles.infoRow, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }]}
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
    <View style={[styles.iconTile, { backgroundColor: palette.primarySoft, borderColor: palette.ink }]}>
      <Icon name={icon} color={palette.inkSoft} size={17} />
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
  iconTile: { width: 36, height: 36, borderRadius: Neo.radius.sm, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 13, fontFamily: face.medium },
  infoValue: { fontSize: 15, fontFamily: face.semibold, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  settings: { gap: 14, padding: 14 },
  setting: { gap: 12 },
  settingTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 15, fontFamily: face.bold },
  settingHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  divider: { height: Neo.border.width, marginHorizontal: -14 },
  blocked: { gap: 10 },
});
