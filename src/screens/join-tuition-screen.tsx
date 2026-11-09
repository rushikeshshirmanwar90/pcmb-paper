import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import { StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Button, ErrorText, Field, LoadingView, MultiChips, Notice, usePalette, useLoad } from '@/components/kit';
=======
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, ErrorText, Field, Icon, LoadingView, MultiChips, usePalette, useLoad } from '@/components/kit';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { PROGRAM_LABELS, SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { myJoinApi, timeAgo, type JoinPreview, type MyJoinRequest } from '@/services/tuition-api';
import { AuthCard, AuthScreen, AuthTitle, AuthTopBar, StepProgress, Strong, TextLink } from '@/screens/auth-ui';

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
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
    setError(null);
  };

  /** Checks the code and shows where it leads. */
  const check = async () => {
    if (code.length !== 8) return setError('The joining code has 8 letters and numbers.');
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

  const logOut = () => confirmAction('Log out?', 'You can log in again with your email and password.', 'Log out', () => void signOut());

  const waiting = pending && !askAgain;
  const firstName = user.name.split(' ')[0];

  let title = 'Join your tuition';
  let lead: React.ReactNode = `Hi ${firstName}. Enter the joining code your tuition gave you.`;
  if (waiting) {
    title = 'Waiting for approval';
    lead = (
      <>
        Hi {firstName}. <Strong>{request!.tuition.name}</Strong> needs to approve you before you can use the app. This screen updates by itself when they do.
      </>
    );
  } else if (preview) {
    title = 'Is this your tuition?';
    lead = 'Check the details before you ask to join.';
  } else if (askAgain) {
    lead = 'Enter the other joining code.';
  }

  return (
<<<<<<< HEAD
    <AuthScreen>
      <AuthTopBar leading={<StepProgress step={waiting ? 4 : 3} />} trailing={<TextLink label="Log out" onPress={logOut} />} />
      <AuthTitle title={title} lead={loading ? undefined : lead} />

      {loading ? (
        <LoadingView />
      ) : waiting ? (
        <Waiting request={request!} checking={checking} error={error} onCheck={checkNow} onOtherCode={() => setAskAgain(true)} onCancel={cancel} />
      ) : preview ? (
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
        <>
          {request?.status === 'rejected' && !askAgain ? (
            <View style={styles.notice}>
              <Notice tone="danger" title={`${request.tuition.name} didn't approve your request`} text="Check with them, or enter another joining code." />
=======
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.hello, { color: palette.mutedForeground }]}>Hi, {user.name.split(' ')[0]}</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
                {pending && !askAgain ? 'Waiting for approval' : 'Join tuition'}
              </Text>
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
            </View>
          ) : null}
<<<<<<< HEAD
          <AuthCard>
            <Field
              label="Joining code"
              value={code}
              onChangeText={typeCode}
              error={error}
              hint="8 letters and numbers, from your tuition."
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={check}
              editable={!busy}
              style={styles.codeInput}
            />
            <Button label="Continue" onPress={check} loading={busy} />
            {askAgain ? <Button label="Keep my current request" variant="secondary" onPress={() => setAskAgain(false)} /> : null}
          </AuthCard>
        </>
      )}
    </AuthScreen>
=======

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
                    maxLength={8}
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
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
  );
}

function Waiting({
  request,
  checking,
  error,
  onCheck,
  onOtherCode,
  onCancel,
}: {
  request: MyJoinRequest;
  checking: boolean;
  error: string | null;
  onCheck: () => void;
  onOtherCode: () => void;
  onCancel: () => void;
}) {
  const palette = usePalette();
  const details = [
    request.batch?.name,
    request.role === 'teacher' ? `Teacher${request.subjects?.length ? ` · ${request.subjects.join(', ')}` : ''}` : null,
  ].filter(Boolean);
  return (
    <>
      <AuthCard>
        <View style={styles.tuition}>
          <Text style={[styles.tuitionName, { color: palette.foreground }]}>{request.tuition.name}</Text>
          {details.map((line) => (
            <Text key={line} style={[styles.detail, { color: palette.foreground }]}>
              {line}
            </Text>
          ))}
          <Text style={[styles.detail, { color: palette.mutedForeground }]}>Asked {request.createdAt ? timeAgo(request.createdAt) : 'just now'}</Text>
        </View>
        <ErrorText message={error} />
        <Button label="Check now" variant="secondary" onPress={onCheck} loading={checking} />
      </AuthCard>
      <View style={styles.links}>
        <TextLink label="Used the wrong code? Enter another" onPress={onOtherCode} />
        <TextLink label="Cancel request" onPress={onCancel} />
      </View>
    </>
  );
}

/** The institute (and batch) a code leads to, to confirm before asking to join; a teacher code also asks for the subjects. */
function Confirm({
  preview,
  subjects,
  onSubjects,
  busy,
  error,
  onConfirm,
  onBack,
}: {
  preview: JoinPreview;
  subjects: SchoolSubject[];
  onSubjects: (next: SchoolSubject[]) => void;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const palette = usePalette();
  const batch = preview.batch;
  const rows: [string, string][] = [['Institute', preview.institute]];
  if (batch) {
    rows.push(['Batch', batch.name]);
    if (batch.standard) rows.push(['Class', batch.standard]);
    if (batch.program) rows.push(['Program', PROGRAM_LABELS[batch.program]]);
  }
  if (preview.kind === 'teacher') rows.push(['Joining as', 'Teacher']);
  return (
    <AuthCard>
      <View>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.rowLabel, { color: palette.mutedForeground }]}>{label}</Text>
            <Text style={[styles.rowValue, { color: palette.foreground }]}>{value}</Text>
          </View>
        ))}
      </View>
      {preview.kind === 'teacher' ? (
        <>
          <MultiChips label="Subjects you teach" choices={SCHOOL_SUBJECTS} selected={subjects} onChange={onSubjects} />
          <Text style={[styles.detail, { color: palette.mutedForeground }]}>Pick every subject you can teach. Your tuition decides which batches you take.</Text>
        </>
      ) : null}
      <ErrorText message={error} />
      <Button label="Ask to join" onPress={onConfirm} loading={busy} />
      <Button label="Use a different code" variant="secondary" onPress={onBack} disabled={busy} />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 14 },
  codeInput: { fontSize: 22, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
  tuition: { gap: 3 },
  tuitionName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  detail: { fontSize: 14, lineHeight: 20 },
  links: { marginTop: 8 },
  row: { paddingVertical: 10, gap: 2 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 17, fontWeight: '700' },
});
