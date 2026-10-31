import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, ErrorText, Field, Icon, LoadingView, MultiChips, usePalette, useLoad } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { PROGRAM_LABELS, SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { myJoinApi, timeAgo, type JoinPreview, type MyJoinRequest } from '@/services/tuition-api';

const CHECK_EVERY_MS = 20000;

/**
 * Someone with an account but no tuition yet, and nothing else of the app:
 * they enter a joining code, confirm the institute (and batch) it leads to,
 * pick the subjects they teach when it is a teacher code, then wait for the
 * tuition to approve them. The code decides whether they join as a student or
 * a teacher. Once it accepts them,
 * their account gets a role and the app switches to those screens.
 */
export function JoinTuitionScreen() {
  const palette = usePalette();
  const user = useSignedInUser();
  const { signOut, refresh } = useAuth();
  const { data: request, loading, reload, setData } = useLoad(() => myJoinApi.latest(), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [askAgain, setAskAgain] = useState(false);
  /** What the entered code leads to, while the student confirms it. */
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  /** A teacher code asks which PCMB subjects they teach. */
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);

  const pending = request?.status === 'pending';

  // While waiting, check now and then whether the tuition has decided.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      void refresh().catch(() => {});
      reload();
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [pending, refresh, reload]);

  const checkNow = async () => {
    setChecking(true);
    await refresh().catch(() => {});
    reload();
    setChecking(false);
  };

  const typeCode = (value: string) => {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw);
    setError(null);
  };

  /** Checks the code and shows where it leads. */
  const check = async () => {
    if (code.replace('-', '').length !== 8) return setError('The joining code has 8 letters and numbers.');
    setBusy(true);
    setError(null);
    try {
      setSubjects([]);
      setPreview(await myJoinApi.validate(code));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Asks to join what the code led to. */
  const confirm = async () => {
    if (preview?.kind === 'teacher' && !subjects.length) return setError('Pick at least one subject you teach.');
    setBusy(true);
    setError(null);
    try {
      const sent = await myJoinApi.send(code, preview?.kind === 'teacher' ? subjects : undefined);
      setData(() => sent);
      setAskAgain(false);
      setPreview(null);
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () =>
    confirmAction('Cancel your request?', 'You can ask the same or another tuition again with its code.', 'Cancel request', async () => {
      try {
        await myJoinApi.cancel();
        setData(() => null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't cancel.");
      }
    });

  const showForm = !request || request.status !== 'pending' || askAgain;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.hello, { color: palette.mutedForeground }]}>Hi, {user.name.split(' ')[0]}</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
                {pending && !askAgain ? 'Waiting for approval' : 'Join tuition'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmAction('Log out?', 'You can log in again with your email and password.', 'Log out', () => void signOut())}
              hitSlop={8}
            >
              <Text style={[styles.link, { color: palette.primary }]}>Log out</Text>
            </Pressable>
          </View>

          {loading ? (
            <LoadingView />
          ) : pending && !askAgain ? (
            <Waiting request={request!} checking={checking} onCheck={checkNow} onCancel={cancel} />
          ) : null}

          {!loading && showForm ? (
            <>
              {request?.status === 'rejected' && !askAgain ? (
                <View style={[styles.notice, { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder }]}>
                  <Text style={[styles.noticeText, { color: palette.dangerInk }]}>
                    {request.tuition.name} didn&apos;t approve your request. Check with them, or enter another joining code.
                  </Text>
                </View>
              ) : null}
              {preview ? (
                <Confirm
                  preview={preview}
                  subjects={subjects}
                  onSubjects={(next) => {
                    setSubjects(next);
                    setError(null);
                  }}
                  busy={busy}
                  error={error}
                  onConfirm={confirm}
                  onBack={() => {
                    setPreview(null);
                    setError(null);
                  }}
                />
              ) : (
                <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.body, { color: palette.foreground }]}>Enter the joining code provided by your tuition institute.</Text>
                  <Field
                    label="Joining code"
                    value={code}
                    onChangeText={typeCode}
                    placeholder="8-character joining code"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    returnKeyType="go"
                    onSubmitEditing={check}
                    style={styles.codeInput}
                  />
                  <ErrorText message={error} />
                  <Button label="Continue" onPress={check} loading={busy} />
                  {askAgain ? <Button label="Keep my current request" variant="secondary" onPress={() => setAskAgain(false)} /> : null}
                </View>
              )}
              <Steps step={1} />
            </>
          ) : null}
          {pending && !askAgain ? (
            <Pressable accessibilityRole="button" onPress={() => setAskAgain(true)} style={styles.center}>
              <Text style={[styles.link, { color: palette.primary }]}>Wrong code? Use another one</Text>
            </Pressable>
          ) : null}
          <ErrorText message={pending && !askAgain ? error : null} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Waiting({ request, checking, onCheck, onCancel }: { request: MyJoinRequest; checking: boolean; onCheck: () => void; onCancel: () => void }) {
  const palette = usePalette();
  return (
    <>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.tuitionRow}>
          <View style={[styles.tuitionIcon, { backgroundColor: palette.warningSoft }]}>
            <Icon name={{ ios: 'hourglass', android: 'hourglass_top' }} color={palette.warning} size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.tuitionName, { color: palette.foreground }]}>{request.tuition.name}</Text>
            {request.batch ? <Text style={[styles.meta, { color: palette.foreground }]}>{request.batch.name}</Text> : null}
            {request.role === 'teacher' ? <Text style={[styles.meta, { color: palette.foreground }]}>Teacher{request.subjects?.length ? ` · ${request.subjects.join(', ')}` : ''}</Text> : null}
            <Text style={[styles.meta, { color: palette.warningInk }]}>Status: Pending approval</Text>
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>Request sent {request.createdAt ? timeAgo(request.createdAt) : 'just now'}</Text>
          </View>
        </View>
        <Text style={[styles.body, { color: palette.foreground }]}>
          Your tuition needs to approve you before you can use the app. This screen changes by itself when they do.
        </Text>
        <Button label="Refresh Status" onPress={onCheck} loading={checking} />
        <Button label="Cancel request" variant="secondary" onPress={onCancel} />
      </View>
      <Steps step={2} />
    </>
  );
}

/** The institute (and batch) a code leads to, to confirm before asking to join; a teacher code also asks for the subjects. */
function Confirm({ preview, subjects, onSubjects, busy, error, onConfirm, onBack }: { preview: JoinPreview; subjects: SchoolSubject[]; onSubjects: (next: SchoolSubject[]) => void; busy: boolean; error: string | null; onConfirm: () => void; onBack: () => void }) {
  const palette = usePalette();
  const batch = preview.batch;
  const rows: [string, string][] = [['Institute', preview.institute]];
  if (batch) {
    rows.push(['Batch', batch.name]);
    if (batch.standard) rows.push(['Class', batch.standard]);
    if (batch.program) rows.push(['Program', PROGRAM_LABELS[batch.program]]);
  }
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.body, { color: palette.foreground }]}>Is this your tuition?</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.confirmRow}>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>{label}</Text>
          <Text style={[styles.confirmValue, { color: palette.foreground }]}>{value}</Text>
        </View>
      ))}
      {preview.kind === 'teacher' ? (
        <>
          <MultiChips label="Teaching subjects" choices={SCHOOL_SUBJECTS} selected={subjects} onChange={onSubjects} />
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>Pick every subject you can teach. Your tuition decides which batches you take.</Text>
        </>
      ) : null}
      <ErrorText message={error} />
      <Button label="Confirm Join" onPress={onConfirm} loading={busy} />
      <Button label="Use a different code" variant="secondary" onPress={onBack} disabled={busy} />
    </View>
  );
}

/** Where they are in getting in. */
function Steps({ step }: { step: 1 | 2 }) {
  const palette = usePalette();
  const items = ['Enter your joining code and confirm your institute', 'Your tuition approves you', 'Your classes, tests and syllabus open up'];
  return (
    <View style={styles.steps}>
      {items.map((text, i) => {
        const done = i < step - 1;
        const now = i === step - 1;
        return (
          <View key={text} style={styles.stepRow}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: done ? palette.success : now ? palette.primary : palette.secondary },
              ]}
            >
              {done ? (
                <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={13} />
              ) : (
                <Text style={[styles.stepNum, { color: now ? palette.onPrimary : palette.mutedForeground }]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepText, { color: now ? palette.foreground : palette.mutedForeground, fontWeight: now ? '700' : '500' }]}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 14, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, marginBottom: 4 },
  hello: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  link: { fontSize: 15, fontWeight: '700' },
  center: { alignSelf: 'center', paddingVertical: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  body: { fontSize: 15, lineHeight: 22 },
  codeInput: { fontSize: 22, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  noticeText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  tuitionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tuitionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tuitionName: { fontSize: 18, fontWeight: '800' },
  meta: { fontSize: 13, marginTop: 1 },
  steps: { gap: 12, marginTop: 8, paddingHorizontal: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontWeight: '800' },
  stepText: { fontSize: 14, flex: 1 },
  confirmRow: { gap: 2 },
  confirmValue: { fontSize: 17, fontWeight: '700' },
});
