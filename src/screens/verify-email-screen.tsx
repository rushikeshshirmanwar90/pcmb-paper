import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import { confirmAction } from '@/components/account-section';
import { Button, CodeInput, ErrorText, Notice } from '@/components/kit';
=======
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, CodeInput, ErrorText, Icon, usePalette } from '@/components/kit';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { emailApi } from '@/services/email-api';
import { AuthCard, AuthScreen, AuthTitle, AuthTopBar, FinePrint, StepProgress, Strong, TextLink } from '@/screens/auth-ui';

const RESEND_SECONDS = 60;

/** After registering: the 6-digit code from the email proves the address is theirs. */
export function VerifyEmailScreen() {
  const user = useSignedInUser();
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Registration just sent a code, so the first resend waits a minute.
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = async (value = code) => {
    if (value.length !== 6) return setError('Enter the 6-digit code from the email.');
    setBusy(true);
    setError(null);
    try {
      await emailApi.verify(value);
      // The app moves on to "Join your tuition".
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the code.");
      setCode('');
      setBusy(false);
    }
  };

  const resend = async () => {
    setSending(true);
    setError(null);
    setNote(null);
    try {
      const { resendAfter } = await emailApi.sendVerification();
      setWait(resendAfter || RESEND_SECONDS);
      setNote(`A new code is on its way to ${user.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a new code.");
    } finally {
      setSending(false);
    }
  };

  const logOut = () => confirmAction('Log out?', 'You can log in again and finish verifying later.', 'Log out', () => void signOut());

  return (
<<<<<<< HEAD
    <AuthScreen>
      <AuthTopBar leading={<StepProgress step={2} />} trailing={<TextLink label="Log out" onPress={logOut} />} />
      <AuthTitle
        title="Check your email"
        lead={
          <>
            Enter the 6-digit code sent to <Strong>{user.email}</Strong>.
          </>
        }
      />
=======
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={[styles.mark, { backgroundColor: palette.primarySoft }]}>
            <Icon name={{ ios: 'envelope.badge', android: 'mark_email_unread' }} color={palette.primary} size={28} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
            Check your email
          </Text>
          <Text style={[styles.lead, { color: palette.mutedForeground }]}>
            We sent a 6-digit code to <Text style={{ color: palette.foreground, fontWeight: '700' }}>{user.email}</Text>. Enter it to verify your email.
          </Text>
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052

      <AuthCard>
        <CodeInput
          value={code}
          onChange={(c) => {
            setCode(c);
            setError(null);
          }}
          onComplete={(c) => void verify(c)}
        />
        <ErrorText message={error} />
        {note ? <Notice tone="success" text={note} live /> : null}
        <Button label="Verify email" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
        <TextLink
          label={sending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          onPress={resend}
          disabled={wait > 0 || sending}
          align="center"
        />
      </AuthCard>

<<<<<<< HEAD
      <FinePrint>
        Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes. Typed the wrong email? Log out, then create your account again.
      </FinePrint>
    </AuthScreen>
=======
          <Text style={[styles.small, { color: palette.mutedForeground }]}>Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => confirmAction('Log out?', 'You can log in again and finish verifying later.', 'Log out', () => void signOut())}
            style={styles.center}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: palette.primary }]}>Wrong email? Log out</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
>>>>>>> 8ce38ca54eb9706ddc3736c1b82fd445f3e61052
  );
}
