import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AccountSettings, confirmAction, ProfileHeader } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  DetailSheet,
  ErrorText,
  ErrorView,
  Field,
  FormSheet,
  Icon,
  ListRow,
  LoadingView,
  Muted,
  Notice,
  Screen,
  SectionTitle,
  Segmented,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SUBJECTS_BY_TRACK, TRACKS, type SchoolSubject, type Track } from '@/constants/school';
import { useAppearance, type AppearancePreference } from '@/context/appearance-context';
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { FlashNotice, InfoRow, useFlash } from '@/screens/tuition/admin-ui';
import { tuitionApi, type TuitionDetails, type Weightage } from '@/services/tuition-api';

/** The tuition's details, its chapter weightage, settings on this phone, and the account. */
export function TuitionProfileScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.profile(), [version]);
  const [editing, setEditing] = useState(false);
  const [weightage, setWeightage] = useState(false);
  const { flash, show, clear } = useFlash();

  return (
    <Screen title="Profile" subtitle="Your institute, settings and account" onRefresh={refresh} refreshing={refreshing}>
      <ProfileHeader
        badges={
          <>
            <Badge label="Tuition admin" tone="primary" />
            {(data?.name ?? user.tuition.name) ? <Badge label={data?.name ?? user.tuition.name} /> : null}
          </>
        }
      />
      <FlashNotice flash={flash} onDismiss={clear} />

      <SectionTitle title="Institute details" />
      {loading ? (
        <Card>
          <LoadingView label="Loading institute details…" />
        </Card>
      ) : error && !data ? (
        <Card>
          <ErrorView message={`Couldn't load the institute details. ${error}`} onRetry={reload} />
        </Card>
      ) : data ? (
        <Card>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          <View>
            <InfoRow icon={{ ios: 'building.2', android: 'domain' }} label="Institute name" value={data.name} />
            <InfoRow icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Address" value={data.address} />
            <InfoRow icon={{ ios: 'phone', android: 'call' }} label="Phone" value={data.phone} />
            <InfoRow icon={{ ios: 'envelope', android: 'mail' }} label="Contact email" value={data.email} last />
          </View>
          {!data.address || !data.phone || !data.email ? <Muted>Teachers and students see these details on their profile. Fill in any that are missing.</Muted> : null}
          <Button label="Edit institute details" variant="secondary" icon={{ ios: 'pencil', android: 'edit' }} onPress={() => setEditing(true)} />
        </Card>
      ) : null}

      <SectionTitle title="Syllabus" />
      <Card style={styles.listCard}>
        <ListRow
          icon={{ ios: 'chart.bar.doc.horizontal', android: 'bar_chart' }}
          title="Chapter weightage"
          subtitle="Marks each chapter carries; students see it on their roadmap"
          onPress={() => setWeightage(true)}
          last
        />
      </Card>

      <SectionTitle title="Settings on this phone" />
      <Card>
        <AppearanceSetting />
      </Card>

      <SectionTitle title="Account" />
      <AccountSettings />

      {data ? <TuitionDetailsForm visible={editing} onClose={() => setEditing(false)} details={data} onSaved={() => show('Institute details saved.')} /> : null}
      {weightage ? <WeightageEditor onClose={() => setWeightage(false)} /> : null}
    </Screen>
  );
}

const APPEARANCE: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark, or follow the phone. Kept on this phone only. */
function AppearanceSetting() {
  const palette = usePalette();
  const { preference, setPreference } = useAppearance();
  return (
    <View style={styles.setting}>
      <View style={styles.settingTop}>
        <View style={[styles.iconTile, { backgroundColor: palette.primarySoft }]}>
          <Icon name={{ ios: 'circle.lefthalf.filled', android: 'contrast' }} color={palette.primary} size={17} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.settingTitle, { color: palette.foreground }]}>Appearance</Text>
          <Text style={[styles.settingHint, { color: palette.mutedForeground }]}>System follows your phone&apos;s light or dark setting.</Text>
        </View>
      </View>
      <Segmented label="Appearance" options={APPEARANCE} value={preference} onChange={setPreference} />
    </View>
  );
}

function TuitionDetailsForm({ visible, onClose, details, onSaved }: { visible: boolean; onClose: () => void; details: TuitionDetails; onSaved: () => void }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState(details);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setForm(details);
      setError(null);
    }
  }

  const set = (key: keyof TuitionDetails) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    if (!form.name.trim()) return setError("Enter the institute's name.");
    setSaving(true);
    setError(null);
    try {
      await tuitionApi.updateProfile(form);
      bumpDataVersion();
      // The name shows in headers through the signed-in user.
      await refresh().catch(() => {});
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Institute details" onClose={onClose} submitLabel="Save details" onSubmit={save} submitting={saving} error={error}>
      <Muted>Teachers and students see these on their profile.</Muted>
      <Field label="Institute name" value={form.name} onChangeText={set('name')} maxLength={120} />
      <Field label="Address" value={form.address} onChangeText={set('address')} multiline maxLength={300} placeholder="e.g. 2nd floor, Shanti Plaza, MG Road" />
      <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={20} />
      <Field
        label="Contact email"
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        hint="Shown to teachers and students. Your login email doesn't change."
      />
    </FormSheet>
  );
}

const TRACK_OPTIONS = TRACKS.map((t) => ({ value: t, label: t }));
const SUBJECT_SHORT: Record<SchoolSubject, string> = { Physics: 'Physics', Chemistry: 'Chem', Mathematics: 'Maths', Biology: 'Bio' };

/** A typed mark: blank, or a number from 0 to 1000. */
const validMarks = (v: string) => {
  const t = v.trim();
  return t === '' || (/^\d*\.?\d*$/.test(t) && t !== '.' && Number(t) >= 0 && Number(t) <= 1000);
};

/** Marks per chapter, for one track's subject at a time. */
function WeightageEditor({ onClose }: { onClose: () => void }) {
  const palette = usePalette();
  const [track, setTrack] = useState<Track>('NEET');
  const [subject, setSubject] = useState<SchoolSubject>('Physics');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { data, error, loading, reload, setData } = useLoad(() => tuitionApi.weightage(track, subject), [track, subject]);

  const keyOf = (c: Weightage['chapters'][number]) => `${c.standard}|${c.chapter}`;
  const valueOf = (c: Weightage['chapters'][number]) => edits[keyOf(c)] ?? (c.marks === null ? '' : String(c.marks));
  const changed = data ? data.chapters.filter((c) => edits[keyOf(c)] !== undefined && edits[keyOf(c)] !== (c.marks === null ? '' : String(c.marks))) : [];
  const dirty = changed.length > 0;

  // Leaving with unsaved marks asks first.
  const leave = (go: () => void) =>
    dirty ? confirmAction('Discard unsaved marks?', `You changed ${changed.length} chapter${changed.length === 1 ? '' : 's'} without saving.`, 'Discard', go) : go();

  const pick = (nextTrack: Track, nextSubject: SchoolSubject) =>
    leave(() => {
      setEdits({});
      setSaved(false);
      setSaveError(null);
      setTrack(nextTrack);
      setSubject(SUBJECTS_BY_TRACK[nextTrack].includes(nextSubject) ? nextSubject : SUBJECTS_BY_TRACK[nextTrack][0]);
    });

  const save = async () => {
    if (!data) return;
    const bad = changed.find((c) => !validMarks(edits[keyOf(c)]));
    if (bad) return setSaveError(`Marks for ${bad.chapter} must be a number from 0 to 1000.`);
    setSaving(true);
    setSaveError(null);
    try {
      const result = await tuitionApi.saveWeightage(
        track,
        subject,
        changed.map((c) => ({ standard: c.standard, chapter: c.chapter, marks: edits[keyOf(c)].trim() === '' ? null : Number(edits[keyOf(c)]) }))
      );
      setData(() => result);
      setEdits({});
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const chapters = data?.chapters ?? [];
  const sum = (list: Weightage['chapters']) => list.reduce((n, c) => n + (validMarks(valueOf(c)) ? Number(valueOf(c)) || 0 : 0), 0);
  const total = sum(chapters);
  const filled = chapters.filter((c) => valueOf(c).trim() !== '').length;
  const byStandard = chapters.reduce<Record<string, Weightage['chapters']>>((acc, c) => {
    (acc[c.standard] ??= []).push(c);
    return acc;
  }, {});

  return (
    <DetailSheet
      visible
      title="Chapter weightage"
      onClose={() => leave(onClose)}
      footer={
        <>
          <ErrorText message={saveError} />
          {saved && !dirty ? <Notice tone="success" title="Marks saved." live /> : null}
          {dirty ? <Muted>{`${changed.length} unsaved change${changed.length === 1 ? '' : 's'}`}</Muted> : null}
          <Button label={dirty ? `Save · ${total} marks in all` : 'No changes to save'} onPress={save} loading={saving} disabled={!dirty} />
        </>
      }
    >
      <View style={styles.pickers}>
        <Segmented label="Track" options={TRACK_OPTIONS} value={track} onChange={(t) => pick(t, subject)} />
        <Segmented
          label="Subject"
          options={SUBJECTS_BY_TRACK[track].map((s) => ({ value: s, label: SUBJECT_SHORT[s] }))}
          value={subject}
          onChange={(s) => pick(track, s)}
        />
      </View>
      <Muted>
        Enter the marks each {subject} chapter usually carries in the {track === 'General' ? 'exam' : track} paper. Leave blank if you don&apos;t know.
      </Muted>

      {loading ? (
        <LoadingView label="Loading chapters…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the chapters. ${error}`} onRetry={reload} />
      ) : data && chapters.length === 0 ? (
        <Card>
          <Muted>No chapters found for {subject} in the question bank yet.</Muted>
        </Card>
      ) : (
        <>
          <View style={[styles.summary, { backgroundColor: palette.secondary }]} accessible accessibilityLabel={`${total} marks in all, ${filled} of ${chapters.length} chapters filled`}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: palette.foreground }]}>{total}</Text>
              <Text style={[styles.summaryLabel, { color: palette.mutedForeground }]}>marks in all</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: palette.foreground }]}>
                {filled}/{chapters.length}
              </Text>
              <Text style={[styles.summaryLabel, { color: palette.mutedForeground }]}>chapters filled</Text>
            </View>
          </View>
          {Object.entries(byStandard).map(([standard, list]) => (
            <View key={standard} style={styles.group}>
              <SectionTitle title={`${standard} · ${subject}`} action={<Text style={[styles.subtotal, { color: palette.mutedForeground }]}>{sum(list)} marks</Text>} />
              <Card style={styles.listCard}>
                {list.map((c, i) => {
                  const value = valueOf(c);
                  const invalid = !validMarks(value);
                  const edited = edits[keyOf(c)] !== undefined && edits[keyOf(c)] !== (c.marks === null ? '' : String(c.marks));
                  return (
                    <View key={keyOf(c)} style={[styles.chapterRow, i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
                      <View style={styles.flex}>
                        <Text style={[styles.chapter, { color: palette.foreground }]}>{c.chapter}</Text>
                        {invalid ? <Text style={[styles.chapterNote, { color: palette.dangerInk }]}>0 to 1000</Text> : edited ? <Text style={[styles.chapterNote, { color: palette.primary }]}>Not saved</Text> : null}
                      </View>
                      <TextInput
                        value={value}
                        onChangeText={(v) => {
                          setSaved(false);
                          setSaveError(null);
                          setEdits((e) => ({ ...e, [keyOf(c)]: v.replace(/[^0-9.]/g, '') }));
                        }}
                        placeholder="—"
                        placeholderTextColor={palette.mutedForeground}
                        keyboardType="numeric"
                        accessibilityLabel={`Marks for ${c.chapter}`}
                        maxLength={4}
                        selectTextOnFocus
                        style={[
                          styles.marks,
                          {
                            color: palette.foreground,
                            borderColor: invalid ? palette.danger : edited ? palette.primary : palette.border,
                            backgroundColor: palette.background,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}
        </>
      )}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  listCard: { paddingVertical: 0 },
  setting: { gap: 12 },
  settingTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: 15, fontWeight: '700' },
  settingHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  pickers: { gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  subtotal: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  group: { gap: 8 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 52 },
  chapter: { fontSize: 14, lineHeight: 19 },
  chapterNote: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  marks: { width: 68, borderWidth: 1.2, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
});
