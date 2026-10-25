import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AccountSection } from '@/components/account-section';
import {
  Button,
  Card,
  Chips,
  DetailRow,
  DetailSheet,
  ErrorText,
  ErrorView,
  Field,
  FormSheet,
  ListRow,
  LoadingView,
  Muted,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SUBJECTS_BY_TRACK, TRACK_LABELS, TRACKS, type SchoolSubject, type Track } from '@/constants/school';
import { useAuth } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { tuitionApi, type TuitionDetails, type Weightage } from '@/services/tuition-api';

/** The tuition's details, its chapter weightage, and the account. */
export function TuitionProfileScreen() {
  const version = useDataVersion();
  const { data, error, loading, reload } = useLoad(() => tuitionApi.profile(), [version]);
  const [editing, setEditing] = useState(false);
  const [weightage, setWeightage] = useState(false);

  return (
    <Screen title="Profile" subtitle="Your tuition and account">
      <SectionTitle title="Tuition" />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <Card>
          <DetailRow label="Name" value={data.name} />
          <DetailRow label="Address" value={data.address || 'Not set'} />
          <DetailRow label="Phone" value={data.phone || 'Not set'} />
          <DetailRow label="Contact email" value={data.email || 'Not set'} />
          <Button label="Edit tuition details" variant="secondary" onPress={() => setEditing(true)} />
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

      <AccountSection />

      {data ? <TuitionDetailsForm visible={editing} onClose={() => setEditing(false)} details={data} /> : null}
      {weightage ? <WeightageEditor onClose={() => setWeightage(false)} /> : null}
    </Screen>
  );
}

function TuitionDetailsForm({ visible, onClose, details }: { visible: boolean; onClose: () => void; details: TuitionDetails }) {
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
    if (!form.name.trim()) return setError("Enter the tuition's name.");
    setSaving(true);
    setError(null);
    try {
      await tuitionApi.updateProfile(form);
      bumpDataVersion();
      // The name shows in headers through the signed-in user.
      await refresh().catch(() => {});
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Tuition details" onClose={onClose} submitLabel="Save" onSubmit={save} submitting={saving} error={error}>
      <Field label="Name" value={form.name} onChangeText={set('name')} maxLength={120} />
      <Field label="Address" value={form.address} onChangeText={set('address')} multiline maxLength={300} />
      <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={20} />
      <Field label="Contact email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" hint="Shown to teachers and students. Your login email doesn't change." />
    </FormSheet>
  );
}

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
  const dirty = Object.keys(edits).length > 0;

  const pick = (nextTrack: Track, nextSubject: SchoolSubject) => {
    setEdits({});
    setSaved(false);
    setSaveError(null);
    setTrack(nextTrack);
    setSubject(SUBJECTS_BY_TRACK[nextTrack].includes(nextSubject) ? nextSubject : SUBJECTS_BY_TRACK[nextTrack][0]);
  };

  const save = async () => {
    if (!data) return;
    const changed = data.chapters.filter((c) => edits[keyOf(c)] !== undefined);
    for (const c of changed) {
      const v = edits[keyOf(c)].trim();
      if (v !== '' && !(Number(v) >= 0 && Number(v) <= 1000)) return setSaveError(`Marks for ${c.chapter} must be a number from 0 to 1000.`);
    }
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
      setSaveError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const total = data ? data.chapters.reduce((sum, c) => sum + (Number(valueOf(c)) || 0), 0) : 0;
  const byStandard = (data?.chapters ?? []).reduce<Record<string, Weightage['chapters']>>((acc, c) => {
    (acc[c.standard] ??= []).push(c);
    return acc;
  }, {});

  return (
    <DetailSheet
      visible
      title="Chapter weightage"
      onClose={onClose}
      footer={
        <>
          <ErrorText message={saveError} />
          {saved && !dirty ? <Muted>Saved.</Muted> : null}
          <Button label={`Save · ${total} marks in all`} onPress={save} loading={saving} disabled={!dirty} />
        </>
      }
    >
      <Chips label="Track" choices={TRACKS} selected={track} onChange={(t) => pick(t, subject)} labels={TRACK_LABELS} />
      <Chips label="Subject" choices={SUBJECTS_BY_TRACK[track]} selected={subject} onChange={(s) => pick(track, s)} />
      <Muted>Enter the marks each chapter usually carries in the {track === 'General' ? 'exam' : track} paper. Leave blank if you don&apos;t know.</Muted>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data && data.chapters.length === 0 ? (
        <Muted>No chapters found for {subject} in the question bank yet.</Muted>
      ) : (
        Object.entries(byStandard).map(([standard, chapters]) => (
          <View key={standard} style={styles.group}>
            <SectionTitle title={`${standard} · ${subject}`} />
            <Card style={styles.listCard}>
              {chapters.map((c, i) => (
                <View key={keyOf(c)} style={[styles.chapterRow, i < chapters.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
                  <Text style={[styles.chapter, { color: palette.foreground }]}>{c.chapter}</Text>
                  <TextInput
                    value={valueOf(c)}
                    onChangeText={(v) => {
                      setSaved(false);
                      setEdits((e) => ({ ...e, [keyOf(c)]: v.replace(/[^0-9.]/g, '') }));
                    }}
                    placeholder="—"
                    placeholderTextColor={palette.mutedForeground}
                    keyboardType="numeric"
                    accessibilityLabel={`Marks for ${c.chapter}`}
                    maxLength={4}
                    style={[styles.marks, { color: palette.foreground, borderColor: palette.border, backgroundColor: palette.background }]}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  group: { gap: 8 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  chapter: { flex: 1, fontSize: 14 },
  marks: { width: 64, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
});
