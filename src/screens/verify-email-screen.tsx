import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, CodeInput, ErrorText, Icon, usePalette } from '@/components/kit';
import { useAuth, useSignedInUser } from '@/context/auth-context';
import { emailApi } from '@/services/email-api';

const RESEND_SECONDS = 60;

/** After registering: the 6-digit code from the email proves the address is theirs. */
export function VerifyEmailScreen() {
  const palette = usePalette();
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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.mark, { backgroundColor: palette.primarySoft }]}>
            <Icon name={{ ios: 'envelope.badge', android: 'mark_email_unread' }} color={palette.primary} size={28} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
            Check your email
          </Text>
          <Text style={[styles.lead, { color: palette.mutedForeground }]}>
            We sent a 6-digit code to <Text style={{ color: palette.foreground, fontWeight: '700' }}>{user.email}</Text>. Enter it to verify your email.
          </Text>

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <CodeInput value={code} onChange={(c) => { setCode(c); setError(null); }} onComplete={(c) => void verify(c)} />
            <ErrorText message={error} />
            {note ? <Text style={[styles.note, { color: palette.successInk }]}>{note}</Text> : null}
            <Button label="Verify email" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
            <Pressable accessibilityRole="button" onPress={resend} disabled={wait > 0 || sending} style={styles.center} hitSlop={8}>
              <Text style={[styles.link, { color: wait > 0 || sending ? palette.mutedForeground : palette.primary }]}>
                {sending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.small, { color: palette.mutedForeground }]}>Can&apos;t find it? Look in Spam or Promotions. The code works for 10 minutes.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => confirmAction('Log out?', 'You can log in again and finish verifying later.', 'Log out', () => void signOut())}
            style={styles.center}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: palette.primary }]}>Wrong email? Log out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12, width: '100%', maxWidth: 440, alignSelf: 'center' },
  mark: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  center: { alignSelf: 'center', paddingVertical: 6 },
  link: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
