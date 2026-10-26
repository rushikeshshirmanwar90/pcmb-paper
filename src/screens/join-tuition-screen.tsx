import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, ErrorText, Field, Icon, LoadingView, usePalette, useLoad } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { myJoinApi, timeAgo, type MyJoinRequest } from '@/services/tuition-api';

const CHECK_EVERY_MS = 20000;

/**
 * Someone with an account but no tuition yet: they ask a tuition to let them
 * in with its join code, then wait while it decides. Once it accepts them,
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

  const send = async () => {
    if (code.replace('-', '').length !== 8) return setError('The join code has 8 letters and numbers, like K7Q2-M9TA.');
    setBusy(true);
    setError(null);
    try {
      const sent = await myJoinApi.send(code);
      setData(() => sent);
      setAskAgain(false);
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the request.");
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
                {pending && !askAgain ? 'Waiting for your tuition' : 'Join your tuition'}
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
                    {request.tuition.name} didn&apos;t accept your request. Check with them, or join another tuition.
                  </Text>
                </View>
              ) : null}
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.body, { color: palette.foreground }]}>
                  Ask your tuition for its join code. They find it on the Home tab of their app.
                </Text>
                <Field
                  label="Join code"
                  value={code}
                  onChangeText={typeCode}
                  placeholder="K7Q2-M9TA"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  returnKeyType="send"
                  onSubmitEditing={send}
                  style={styles.codeInput}
                />
                <ErrorText message={error} />
                <Button label="Send request" onPress={send} loading={busy} />
                {askAgain ? <Button label="Keep my current request" variant="secondary" onPress={() => setAskAgain(false)} /> : null}
              </View>
              <Steps step={1} />
            </>
          ) : null}
          {pending && !askAgain ? (
            <Pressable accessibilityRole="button" onPress={() => setAskAgain(true)} style={styles.center}>
              <Text style={[styles.link, { color: palette.primary }]}>Wrong tuition? Use another code</Text>
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
            {request.tuition.address ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{request.tuition.address}</Text> : null}
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>Request sent {request.createdAt ? timeAgo(request.createdAt) : 'just now'}</Text>
          </View>
        </View>
        <Text style={[styles.body, { color: palette.foreground }]}>
          They&apos;ll add you as a student or a teacher. This screen changes by itself when they do.
        </Text>
        <Button label="Check now" onPress={onCheck} loading={checking} />
        <Button label="Cancel request" variant="secondary" onPress={onCancel} />
      </View>
      <Steps step={2} />
    </>
  );
}

/** Where they are in getting in. */
function Steps({ step }: { step: 1 | 2 }) {
  const palette = usePalette();
  const items = ["Enter your tuition's join code", 'Your tuition accepts you as a student or teacher', 'Your classes, tests and syllabus open up'];
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
});
