import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Button, Card, Chips, ErrorText, FormSheet, Icon, Muted, MultiChips, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { SCHOOL_STANDARDS, SCHOOL_SUBJECTS, SUBJECTS_BY_TRACK, TRACK_LABELS, TRACKS, type SchoolSubject, type Track } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { joinRequestsApi, timeAgo, tuitionApi, type JoinRequest } from '@/services/tuition-api';

/**
 * The tuition's door: its join code to share, and the people who asked to
 * join with it, each accepted as a student or a teacher (or rejected).
 */
export function JoinRequestsSection() {
  const version = useDataVersion();
  const { data, error, reload } = useLoad(() => joinRequestsApi.pending(), [version]);
  const [accepting, setAccepting] = useState<{ request: JoinRequest; as: 'student' | 'teacher' } | null>(null);
  const requests = data ?? [];

  return (
    <>
      {requests.length ? <SectionTitle title={`Asking to join (${requests.length})`} /> : null}
      <ErrorText message={error} />
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} onAccept={(as) => setAccepting({ request: r, as })} onDone={reload} />
      ))}
      <JoinCodeCard waiting={requests.length} />
      <AcceptSheet accepting={accepting} onClose={() => setAccepting(null)} />
    </>
  );
}

export function RequestCard({ request, onAccept, onDone }: { request: JoinRequest; onAccept: (as: 'student' | 'teacher') => void; onDone: () => void }) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reject = () =>
    confirmAction(`Reject ${request.person.name}?`, 'They can ask again with your code, or join another tuition.', 'Reject', async () => {
      setBusy(true);
      setError(null);
      try {
        await joinRequestsApi.reject(request.id);
        bumpDataVersion();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reject.");
        setBusy(false);
      }
    });

  return (
    <Card>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: palette.warningSoft }]}>
          <Icon name={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_add' }} color={palette.warning} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: palette.foreground }]}>{request.person.name}</Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>{request.person.email}</Text>
          {request.person.phone ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{request.person.phone}</Text> : null}
        </View>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{timeAgo(request.createdAt)}</Text>
      </View>
      <ErrorText message={error} />
      <View style={styles.row}>
        <Button label="As student" icon={{ ios: 'graduationcap', android: 'school' }} onPress={() => onAccept('student')} disabled={busy} style={styles.flex} />
        <Button label="As teacher" icon={{ ios: 'person.crop.rectangle', android: 'co_present' }} onPress={() => onAccept('teacher')} disabled={busy} style={styles.flex} />
      </View>
      <Button label="Reject" variant="secondary" onPress={reject} loading={busy} />
    </Card>
  );
}

/** Accepting someone: as a student (track, class, batch) or a teacher (subjects). */
export function AcceptSheet({ accepting, onClose }: { accepting: { request: JoinRequest; as: 'student' | 'teacher' } | null; onClose: () => void }) {
  const version = useDataVersion();
  const visible = !!accepting;
  const { data: batches } = useLoad(() => tuitionApi.batches(), [version, visible], { enabled: visible });
  const [as, setAs] = useState<'student' | 'teacher'>('student');
  const [track, setTrack] = useState<Track>('NEET');
  const [standard, setStandard] = useState<string>('none');
  const [batchId, setBatchId] = useState<string>('none');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = accepting ? `${accepting.request.id}|${accepting.as}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (accepting) {
      setAs(accepting.as);
      setTrack('NEET');
      setStandard('none');
      setBatchId('none');
      setSubjects([]);
      setError(null);
    }
  }
  if (!accepting) return null;
  const person = accepting.request.person;

  // The student's track's batches first.
  const sorted = [...(batches ?? [])].sort((a, b) => Number(b.track === track) - Number(a.track === track) || a.name.localeCompare(b.name));

  const save = async () => {
    if (as === 'teacher' && !subjects.length) return setError('Pick the subjects they teach.');
    setSaving(true);
    setError(null);
    try {
      await joinRequestsApi.accept(
        accepting.request.id,
        as === 'student'
          ? { as, track, standard: standard === 'none' ? null : (standard as (typeof SCHOOL_STANDARDS)[number]), batchId: batchId === 'none' ? null : batchId }
          : { as, subjects }
      );
      bumpDataVersion();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't accept them.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={`Accept ${person.name}`}
      onClose={onClose}
      submitLabel={as === 'student' ? 'Accept as student' : 'Accept as teacher'}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <Chips label="Joins as" choices={['student', 'teacher'] as const} selected={as} onChange={setAs} labels={{ student: 'Student', teacher: 'Teacher' }} />
      {as === 'student' ? (
        <>
          <Chips label="Preparing for" choices={TRACKS} selected={track} onChange={setTrack} labels={TRACK_LABELS} />
          <Muted>Subjects: {SUBJECTS_BY_TRACK[track].join(', ')}</Muted>
          <Chips label="Class" choices={['none', ...SCHOOL_STANDARDS]} selected={standard} onChange={setStandard} labels={{ none: 'Not set' }} />
          <Chips
            label="Batch"
            choices={['none', ...sorted.map((b) => b.id)]}
            selected={batchId}
            onChange={setBatchId}
            labels={Object.fromEntries([['none', 'Later'], ...sorted.map((b) => [b.id, b.track === track ? b.name : `${b.name} (${b.track})`])])}
          />
        </>
      ) : (
        <>
          <MultiChips label="Subjects they teach" choices={SCHOOL_SUBJECTS} selected={subjects} onChange={setSubjects} />
          <Muted>You give them batches from the Batches tab, as with any teacher.</Muted>
        </>
      )}
      <Muted>
        {person.name} ({person.email}) logs in with their own password; their app switches to the {as} screens.
      </Muted>
    </FormSheet>
  );
}

/** The code people join with: share it, or make a new one. */
export function JoinCodeCard({ waiting }: { waiting: number }) {
  const palette = usePalette();
  const user = useSignedInUser();
  const { data: code, error, setData } = useLoad(() => tuitionApi.joinCode(), []);
  const [busy, setBusy] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const share = () =>
    code &&
    Share.share({
      message: `Join ${user.tuition.name} on the PCMB app: create an account, tap "Join a tuition" and enter the code ${code}.`,
    }).catch(() => {});

  const renew = () =>
    confirmAction('Make a new join code?', "The current code stops working. People who already joined aren't affected.", 'Make new code', async () => {
      setBusy(true);
      setRenewError(null);
      try {
        const next = await tuitionApi.renewJoinCode();
        setData(() => next);
      } catch (e) {
        setRenewError(e instanceof Error ? e.message : "Couldn't make a new code.");
      } finally {
        setBusy(false);
      }
    });

  return (
    <Card>
      <Text style={[styles.codeTitle, { color: palette.foreground }]}>Your join code</Text>
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>
        Students and teachers create an account in the app and ask to join with this code. {waiting ? 'Accept them above.' : 'Their requests show here.'}
      </Text>
      <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Text selectable accessibilityLabel={`Join code ${code ?? ''}`} style={[styles.code, { color: palette.foreground }]}>
          {code ?? '····-····'}
        </Text>
      </View>
      <ErrorText message={error ?? renewError} />
      <View style={styles.row}>
        <Button label="Share code" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={share} disabled={!code} style={styles.flex2} />
        <Button label="New code" variant="secondary" onPress={renew} loading={busy} disabled={!code} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  row: { flexDirection: 'row', gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 19 },
  codeTitle: { fontSize: 16, fontWeight: '700' },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
});
